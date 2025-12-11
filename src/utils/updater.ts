import packageJson from "../../package.json" with { type: "json" };
import { spawn } from "child_process";
import { tmpdir } from "os";
import { join, dirname, basename } from "path";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { createInterface } from "readline";

function promptUser(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

const GITHUB_API_URL =
  "https://api.github.com/repos/wuw-shz/Volleyball-Legends-Pro-Bun/releases/latest";

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  assets: GitHubAsset[];
}

interface UpdateInfo {
  version: string;
  downloadUrl: string;
  assetName: string;
}

function compareVersions(v1: string, v2: string): number {
  const normalize = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [major1, minor1, patch1] = normalize(v1);
  const [major2, minor2, patch2] = normalize(v2);

  if (major1 !== major2) return major1 > major2 ? 1 : -1;
  if (minor1 !== minor2) return minor1 > minor2 ? 1 : -1;
  if (patch1 !== patch2) return patch1 > patch2 ? 1 : -1;
  return 0;
}

export async function checkForUpdates(): Promise<UpdateInfo | null> {
  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "VBL-Pro-Bun-Updater",
      },
    });

    if (!response.ok) {
      logger.warn(`Update check failed: HTTP ${response.status}`);
      return null;
    }

    const release: GitHubRelease = await response.json();
    const latestVersion = release.tag_name.replace(/^v/, "");
    const currentVersion = packageJson.version;

    if (compareVersions(latestVersion, currentVersion) <= 0) {
      logger.info(`Already on latest version (v${currentVersion})`);
      return null;
    }

    const zipAsset = release.assets.find((asset) =>
      asset.name.endsWith(".zip"),
    );

    if (!zipAsset) {
      logger.warn("No zip asset found in latest release");
      return null;
    }

    return {
      version: latestVersion,
      downloadUrl: zipAsset.browser_download_url,
      assetName: zipAsset.name,
    };
  } catch (error) {
    logger.warn("Update check failed:", error);
    return null;
  }
}

export async function downloadUpdate(url: string): Promise<string> {
  const tempDir = join(tmpdir(), "vbl-pro-update");

  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true });
  }
  mkdirSync(tempDir, { recursive: true });

  const zipPath = join(tempDir, "update.zip");

  logger.info("Downloading update...");
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  await Bun.write(zipPath, buffer);

  logger.info("Download complete");
  return zipPath;
}

export async function extractUpdate(zipPath: string): Promise<string> {
  const tempDir = join(tmpdir(), "vbl-pro-update");
  const extractDir = join(tempDir, "extracted");

  if (existsSync(extractDir)) {
    rmSync(extractDir, { recursive: true });
  }
  mkdirSync(extractDir, { recursive: true });

  logger.info("Extracting update...");

  const proc = Bun.spawn(
    [
      "powershell",
      "-NoProfile",
      "-Command",
      `Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force`,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Extraction failed: ${stderr}`);
  }

  const files = await Array.fromAsync(
    new Bun.Glob("*.exe").scan({ cwd: extractDir }),
  );
  if (files.length === 0) {
    throw new Error("No exe file found in the update");
  }

  const exePath = join(extractDir, files[0]);
  logger.info("Extraction complete");
  return exePath;
}

export async function applyUpdate(
  newExePath: string,
  newVersion: string,
): Promise<void> {
  const currentExePath = process.execPath;
  const currentDir = dirname(currentExePath);
  const currentExeName = basename(currentExePath);

  const newExeName = currentExeName.replace(
    /v[\d.]+\.exe$/i,
    `v${newVersion}.exe`,
  );
  const targetExePath = join(currentDir, newExeName);

  const tempDir = join(tmpdir(), "vbl-pro-update");
  const batchPath = join(tempDir, "update.bat");

  const batchScript = `
@echo off
title VBL Pro Updater
echo Waiting for application to close...
timeout /t 2 /nobreak > nul

:waitloop
tasklist /FI "PID eq ${process.pid}" 2>NUL | find "${process.pid}" >NUL
if "%ERRORLEVEL%"=="0" (
    timeout /t 1 /nobreak > nul
    goto waitloop
)

echo Applying update...
copy /Y "${newExePath}" "${targetExePath}"
if %ERRORLEVEL% neq 0 (
    echo Update failed!
    pause
    exit /b 1
)

if not "${currentExePath}"=="${targetExePath}" (
    echo Removing old version...
    del /F "${currentExePath}"
)

echo Update complete! Starting application...
start "" "${targetExePath}"

echo Cleaning up...
timeout /t 2 /nobreak > nul
rd /s /q "${tempDir}"
exit
`.trim();

  writeFileSync(batchPath, batchScript, { encoding: "utf8" });

  logger.info("Applying update - application will restart...");

  spawn("cmd.exe", ["/c", batchPath], {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  }).unref();

  await Bun.sleep(500);

  process.exit(0);
}

export async function runUpdateCheck(): Promise<void> {
  try {
    logger.info("Checking for updates...");

    const updateInfo = await checkForUpdates();

    if (!updateInfo) {
      return;
    }

    logger.info(`New version available: v${updateInfo.version}`);

    const answer = await promptUser("Do you want to update? (y/n): ");

    if (answer !== "y" && answer !== "yes") {
      logger.info("Update skipped by user.");
      return;
    }

    const zipPath = await downloadUpdate(updateInfo.downloadUrl);
    const exePath = await extractUpdate(zipPath);
    await applyUpdate(exePath, updateInfo.version);
  } catch (error) {
    logger.warn("Update failed, continuing with current version:", error);
  }
}
