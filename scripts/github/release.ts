import { $ } from "bun";
import { registerRollback, markStageComplete } from "../rollback";

export async function handleRelease(): Promise<boolean> {
  const packageJson = await Bun.file("package.json").json();
  const version = packageJson.version;
  const tagName = `v${version}`;

  console.time("release");
  console.log("Releasing...");

  const { exitCode } = await $`gh release view ${tagName}`.quiet().nothrow();

  if (exitCode === 0) {
    console.log(`Release ${tagName} already exists.`);
    console.timeEnd("release");
    return true;
  }

  registerRollback("release", async () => {
    console.log(`Deleting release ${tagName}...`);
    await $`gh release delete ${tagName} --yes`.quiet().nothrow();
    await $`git push --delete origin ${tagName}`.quiet().nothrow();
  });

  console.log(`Creating release "${tagName}" ...`);
  const zipPath = `build/vbl-pro-bun-v${version}.zip`;
  const result =
    await $`gh release create ${tagName} ${zipPath} --generate-notes`;

  if (result.exitCode !== 0) {
    console.error("Release Failed:");
    console.error(result.stderr.toString());
    return false;
  }

  markStageComplete("release");
  console.log("Release Created.");
  console.timeEnd("release");
  return true;
}

const args = process.argv.slice(2);
if (args.includes("--create")) {
  const success = await handleRelease();
  if (!success) process.exit(1);
}
