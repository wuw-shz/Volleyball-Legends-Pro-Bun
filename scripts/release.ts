import { $ } from "bun";
import packageJson from "../package.json" with { type: "json" };
import { handleRelease } from "./github/release";
import { registerRollback, markStageComplete } from "./rollback";

export async function runRelease(args: string[]): Promise<void> {
  await $`bun run scripts/github/release.ts ${args}`;
}

export async function runZipAndRelease(): Promise<boolean> {
  console.time("zip");
  console.log("Creating ZIP archive...");

  const version = packageJson.version;
  const exePath = `build/vbl-pro-bun-v${version}.exe`;
  const zipPath = `build/vbl-pro-bun-v${version}.zip`;

  registerRollback("zip", async () => {
    const zipFile = Bun.file(zipPath);
    if (await zipFile.exists()) {
      await zipFile.delete();
      console.log(`Deleted ${zipPath}`);
    }
  });

  const zipResult =
    await $`powershell Compress-Archive -Path ${exePath} -DestinationPath ${zipPath} -Force`
      .quiet()
      .nothrow();

  if (zipResult.exitCode === 0) {
    markStageComplete("zip");
    const exeSize = (await Bun.file(exePath).size) / 1024 / 1024;
    const zipSize = (await Bun.file(zipPath).size) / 1024 / 1024;
    console.log(
      `ZIP Created: ${exeSize.toFixed(1)}MB -> ${zipSize.toFixed(1)}MB (${((1 - zipSize / exeSize) * 100).toFixed(0)}% reduction)`,
    );
  } else {
    console.warn("ZIP Creation Failed:", zipResult.stderr.toString());
    console.timeEnd("zip");
    return false;
  }

  console.timeEnd("zip");
  console.log();

  const releaseSuccess = await handleRelease();
  return releaseSuccess;
}
