import packageJson from "../../package.json" with { type: "json" };
import { spawn } from "child_process";
import { tmpdir } from "os";
import { join, dirname, basename } from "path";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { createInterface } from "readline";

// ---------------------------
// Helpers
// ---------------------------

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

// ---------------------------
// Version Compare
// ---------------------------

function compareVersions(v1: string, v2: string): number {
  const normalize = (v: string) =>
    v
      .replace(/^v/, "")
      .split(".")
      .map((n) => Number(n) || 0);

  const [a1, b1, c1] = normalize(v1);
  const [a2, b2, c2] = normalize(v2);

  return a1 - a2 || b1 - b2 || c1 - c2 || 0;
}

// ---------------------------
// Fetch Latest Release Info
// ---------------------------

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

    const zipAsset = release.assets.find((a) =>
      a.name.toLowerCase().endsWith(".zip"),
    );

    if (!zipAsset) {
      logger.warn("Latest release has no .zip asset");
      return null;
    }

    return {
      version: latestVersion,
      downloadUrl: zipAsset.browser_download_url,
      assetName: zipAsset.name,
    };
  } catch (err) {
    logger.warn("Update check failed:", err);
    return null;
  }
}

// ---------------------------
// Download Update
// ---------------------------

function createTempDir(): string {
  const dir = join(tmpdir(), "vbl-pro-update");
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

export async function downloadUpdate(url: string): Promise<string> {
  const tempDir = createTempDir();
  const zipPath = join(tempDir, "update.zip");

  logger.info("Downloading update...");

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: HTTP ${resp.status}`);

  await Bun.write(zipPath, await resp.arrayBuffer());

  logger.info("Download complete");
  return zipPath;
}

// ---------------------------
// Extract Update
// ---------------------------

export async function extractUpdate(zipPath: string): Promise<string> {
  const tempDir = join(tmpdir(), "vbl-pro-update");
  const extractDir = join(tempDir, "extracted");

  if (existsSync(extractDir)) rmSync(extractDir, { recursive: true });
  mkdirSync(extractDir);

  logger.info("Extracting update...");

  const ps = Bun.spawn(
    [
      "powershell",
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${extractDir}' -Force`,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  const exit = await ps.exited;
  if (exit !== 0) {
    const stderr = await new Response(ps.stderr).text();
    throw new Error(`Extraction failed: ${stderr}`);
  }

  const files = await Array.fromAsync(
    new Bun.Glob("*.exe").scan({ cwd: extractDir }),
  );

  if (!files.length) {
    throw new Error("Update zip contains no .exe file");
  }

  logger.info("Extraction complete");

  return join(extractDir, files[0]);
}

// ---------------------------
// Apply Update
// ---------------------------

export async function applyUpdate(
  newExePath: string,
  newVersion: string,
): Promise<void> {
  const oldExePath = process.execPath;
  const oldDir = dirname(oldExePath);
  const parentDir = dirname(oldDir);
  const oldFolderName = basename(oldDir);

  const newFolderName = `vbl-pro-bun-v${newVersion}`;
  const newFolderPath = join(parentDir, newFolderName);

  const oldExeName = basename(oldExePath);
  const newExeName = oldExeName.replace(/v[\d.]+\.exe$/i, `v${newVersion}.exe`);

  const finalExePath = join(newFolderPath, newExeName);

  const tempDir = join(tmpdir(), "vbl-pro-update");
  const batchPath = join(tempDir, "update.bat");

  const script = `
@echo off
title VBL Pro Updater

echo Waiting for application to close...
:waitloop
tasklist /FI "PID eq ${process.pid}" 2>nul | find /I "PID" >nul
if %errorlevel%==0 (
  timeout /t 1 >nul
  goto waitloop
)

echo Renaming folder...
ren "${oldDir}" "${newFolderName}"
if %errorlevel% neq 0 (
  echo Folder rename failed!
  pause
  exit /b 1
)

echo Copying new version...
copy /Y "${newExePath}" "${finalExePath}" >nul
if %errorlevel% neq 0 (
  echo EXE copy failed!
  pause
  exit /b 1
)

echo Starting new version...
start "" "${finalExePath}"

echo Cleaning up...
timeout /t 2 >nul
rd /s /q "${tempDir}"
exit
`.trim();

  writeFileSync(batchPath, script, "utf8");

  logger.info(
    `Applying update → renaming folder to "${newFolderName}" and restarting...`,
  );

  spawn("cmd.exe", ["/c", batchPath], {
    detached: true,
    stdio: "ignore",
  }).unref();

  await Bun.sleep(300);
  process.exit(0);
}

// ---------------------------
// Main Entry
// ---------------------------

export async function runUpdateCheck() {
  logger.info("Checking for updates...");

  try {
    const info = await checkForUpdates();
    if (!info) return;

    logger.info(`New version available: v${info.version}`);

    const ans = await promptUser("Update now? (y/n): ");
    if (!["y", "yes"].includes(ans)) {
      logger.info("Update canceled by user.");
      return;
    }

    const zip = await downloadUpdate(info.downloadUrl);
    const exe = await extractUpdate(zip);
    await applyUpdate(exe, info.version);
  } catch (err) {
    logger.warn("Update failed, continuing normally:", err);
  }
}
