import { $ } from "bun";
import packageJson from "../package.json" with { type: "json" };

export async function runRelease(args: string[]): Promise<void> {
  await $`bun run scripts/github/release.ts ${args}`;
}

export async function runZipAndRelease(): Promise<void> {
  console.time("zip");
  console.log("Creating ZIP archive...");

  const version = packageJson.version;
  const exePath = `build/vbl-pro-bun-v${version}.exe`;
  const zipPath = `build/vbl-pro-bun-v${version}.zip`;

  const zipResult =
    await $`powershell Compress-Archive -Path ${exePath} -DestinationPath ${zipPath} -Force`
      .quiet()
      .nothrow();

  if (zipResult.exitCode === 0) {
    const exeSize = (await Bun.file(exePath).size) / 1024 / 1024;
    const zipSize = (await Bun.file(zipPath).size) / 1024 / 1024;
    console.log(
      `ZIP Created: ${exeSize.toFixed(1)}MB -> ${zipSize.toFixed(1)}MB (${((1 - zipSize / exeSize) * 100).toFixed(0)}% reduction)`,
    );
  } else {
    console.warn("ZIP Creation Failed:", zipResult.stderr.toString());
  }

  console.timeEnd("zip");
  console.log();

  await $`bun run scripts/github/release.ts --create`;
}
