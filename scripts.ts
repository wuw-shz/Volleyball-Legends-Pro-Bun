import { build, $, BuildConfig, CompileBuildConfig } from "bun";

const args = process.argv.slice(2);
const shouldBuild = args.includes("--build");
const shouldCompile = args.includes("--compile");
const shouldCommit = args.includes("--commit");
const shouldRelease = args.includes("--release");
const shouldRun = args.includes("--run");

if (shouldRelease) {
  await $`bun run git/release.ts ${args}`;
}

let buildConfig: BuildConfig = {
  entrypoints: [
    "./src/index.ts",
    "./src/workers/roblox.ts",
    "./src/workers/game.ts",
  ],

  minify: true,
  splitting: true,
  root: "src",
  target: "bun",
  sourcemap: "external",
};

let buildSuccess = true;

if (shouldBuild) {
  console.time("build");
  console.log("Building...");
  buildConfig.outdir = "dist";
  const result = await build(buildConfig);

  buildSuccess = result.success;

  if (!buildSuccess) {
    console.error("Build Failed:");
    console.error(result.logs);
  } else {
    console.log("Build Complete.");
  }
  console.timeEnd("build");
  console.log();
}

let compileSuccess = true;

if (shouldCompile) {
  console.time("compile");
  console.log("Compiling...");

  buildConfig.sourcemap = "none";

  (<CompileBuildConfig>buildConfig).compile = {
    target: "bun-windows-x64",
    outfile: "vbl-pro-bun",
    windows: {
      title: "VBL Pro",
    },
  };
  const result = await build(buildConfig);

  compileSuccess = result.success;

  if (!compileSuccess) {
    console.error("Compile Failed:");
    console.error(result.logs);
  } else {
    console.log("Compile Complete.");
  }
  console.timeEnd("compile");
  console.log();
}

let commitSuccess = true;

if (shouldCommit) {
  console.time("commit");
  console.log("Committing...");
  const result = await $`bun run git/commit.ts`;

  commitSuccess = result.exitCode === 0;

  if (!commitSuccess) {
    console.error("Commit Failed:");
    console.error(result.stderr.toString());
  } else {
    console.log("Commit Complete.");
  }
  console.timeEnd("commit");
  console.log();
}

if (shouldRelease && buildSuccess && compileSuccess) {
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

if (shouldRun && buildSuccess && compileSuccess && commitSuccess) {
  if (shouldBuild) await $`bun run dist/index.js`;
  else if (shouldCompile) await $`./vbl-pro-bun.exe`;
  else await $`bun run src/index.ts`;
}
