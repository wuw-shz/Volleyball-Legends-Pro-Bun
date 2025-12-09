import { $ } from "bun";

export async function runRelease(args: string[]): Promise<void> {
  await $`bun run git/release.ts ${args}`;
}

export async function runZipAndRelease(): Promise<void> {
  console.time("zip");
  console.log("Creating ZIP archive...");

  const zipResult =
    await $`powershell Compress-Archive -Path vbl-pro-bun.exe -DestinationPath vbl-pro-bun.zip -Force`
      .quiet()
      .nothrow();

  if (zipResult.exitCode === 0) {
    const exeSize = (await Bun.file("vbl-pro-bun.exe").size) / 1024 / 1024;
    const zipSize = (await Bun.file("vbl-pro-bun.zip").size) / 1024 / 1024;
    console.log(
      `ZIP Created: ${exeSize.toFixed(1)}MB -> ${zipSize.toFixed(1)}MB (${((1 - zipSize / exeSize) * 100).toFixed(0)}% reduction)`,
    );
  } else {
    console.warn("ZIP Creation Failed:", zipResult.stderr.toString());
  }

  console.timeEnd("zip");
  console.log();

  await $`bun run git/release.ts --create`;
}
