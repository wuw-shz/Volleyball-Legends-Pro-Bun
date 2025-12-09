import { $ } from "bun";
import packageJson from "../package.json" with { type: "json" };

const args = process.argv.slice(2);
const shouldPatch = args.includes("--patch");
const shouldMinor = args.includes("--minor");
const shouldMajor = args.includes("--major");
const shouldCreate = args.includes("--create");

type BumpType = "major" | "minor" | "patch";
const bumpType: BumpType | undefined = shouldMajor
  ? "major"
  : shouldMinor
    ? "minor"
    : shouldPatch
      ? "patch"
      : undefined;

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

async function handleBump() {
  if (bumpType) {
    await Bun.write(".version_backup", packageJson.version);

    const newVersion = bumpVersion(packageJson.version, bumpType);
    console.log(`Bumping version: ${packageJson.version} -> ${newVersion}`);

    packageJson.version = newVersion;
    await Bun.write("package.json", JSON.stringify(packageJson, null, 3));
  }
}

async function handleRelease() {
  const updatedPackageJson = await Bun.file("package.json").json();
  const version = updatedPackageJson.version;
  const tagName = `v${version}`;

  console.time("release");
  console.log("Releasing...");

  const { exitCode } = await $`gh release view ${tagName}`.quiet().nothrow();

  const rollback = async () => {
    const backupFile = Bun.file(".version_backup");
    if (await backupFile.exists()) {
      console.log("\nRolling back version...");
      const originalVersion = await backupFile.text();

      const currentPackageJson = await Bun.file("package.json").json();
      currentPackageJson.version = originalVersion;
      await Bun.write(
        "package.json",
        JSON.stringify(currentPackageJson, null, 3),
      );
      await backupFile.delete();

      console.log(`Rolled back version to ${originalVersion}`);
    }
  };

  process.on("SIGINT", async () => {
    console.log("\nProcess terminated by user.");
    await rollback();
    process.exit(1);
  });

  if (exitCode === 0) {
    console.log(`Release ${tagName} already exists.`);
    const backupFile = Bun.file(".version_backup");
    if (await backupFile.exists()) {
      await backupFile.delete();
    }
  } else {
    console.log(`Creating release "${tagName}" ...`);
    const result =
      await $`gh release create ${tagName} vbl-pro-bun.zip --generate-notes`;

    if (result.exitCode !== 0) {
      console.error("Release Failed:");
      console.error(result.stderr.toString());

      await rollback();

      process.exit(1);
    } else {
      console.log("Release Created.");
      const backupFile = Bun.file(".version_backup");
      if (await backupFile.exists()) {
        await backupFile.delete();
      }
    }
  }
  console.timeEnd("release");
}

if (bumpType) {
  await handleBump();
}

if (shouldCreate) {
  await handleRelease();
}
