import packageJson from "../package.json" with { type: "json" };
import { wasCommitPushed } from "./github/commit";

export type BumpType = "major" | "minor" | "patch";

function parseVersion(version: string): [number, number, number] {
  const [major, minor, patch] = version.split(".").map(Number);
  return [major, minor, patch];
}

function bumpVersion(current: string, type: BumpType): string {
  const [major, minor, patch] = parseVersion(current);
  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      if (minor + 1 >= 10) {
        return `${major + 1}.0.0`;
      }
      return `${major}.${minor + 1}.0`;
    case "patch":
      if (patch + 1 >= 10) {
        if (minor + 1 >= 10) {
          return `${major + 1}.0.0`;
        }
        return `${major}.${minor + 1}.0`;
      }
      return `${major}.${minor}.${patch + 1}`;
  }
}

export function getBumpType(args: string[]): BumpType | undefined {
  if (args.includes("--major")) return "major";
  if (args.includes("--minor")) return "minor";
  if (args.includes("--patch")) return "patch";
  return undefined;
}

export async function runBumpVersion(bumpType: BumpType): Promise<boolean> {
  await Bun.write(".version_backup", packageJson.version);
  const newVersion = bumpVersion(packageJson.version, bumpType);
  console.log(`Bumping version: ${packageJson.version} -> ${newVersion}`);
  packageJson.version = newVersion;
  await Bun.write("package.json", JSON.stringify(packageJson, null, 2));
  return true;
}

export async function rollbackVersion(): Promise<void> {
  const backupFile = Bun.file(".version_backup");
  if (await backupFile.exists()) {
    console.log("\nRolling back version...");
    const originalVersion = await backupFile.text();
    const currentPackageJson = await Bun.file("package.json").json();
    currentPackageJson.version = originalVersion;
    await Bun.write(
      "package.json",
      JSON.stringify(currentPackageJson, null, 2),
    );
    await backupFile.delete();
    console.log(`Rolled back version to ${originalVersion}`);

    if (wasCommitPushed()) {
      await commitVersionRollback(originalVersion);
    }
  }
}

async function run(cmd: string[]): Promise<string> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;
  if (proc.exitCode !== 0) {
    throw new Error(stderr || stdout || `Command failed: ${cmd.join(" ")}`);
  }
  return stdout.trim();
}

async function commitVersionRollback(version: string): Promise<void> {
  try {
    await run(["git", "add", "package.json"]);
    await run(["git", "commit", "-m", `Rollback version to ${version}`]);
    await run(["git", "push", "origin", "main"]);
    console.log("Version rollback committed and pushed.");
  } catch (error) {
    console.error("Failed to commit version rollback:", error);
  }
}

export async function cleanupVersionBackup(): Promise<void> {
  const backupFile = Bun.file(".version_backup");
  if (await backupFile.exists()) {
    await backupFile.delete();
  }
}
