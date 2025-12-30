import { build, BuildConfig } from "bun";

export const buildConfig: BuildConfig = {
  entrypoints: [
    "./src/index.ts",
    "./src/workers/roblox.ts",
    "./src/workers/game.ts",
    "./src/workers/threads/game.ts",
    "./src/workers/threads/roblox.ts",
  ],
  minify: true,
  splitting: true,
  root: "src",
  target: "bun",
  sourcemap: "external",
};

export async function runBuild(): Promise<boolean> {
  console.time("build");
  console.log("Building...");

  const config = { ...buildConfig, outdir: "dist" };
  const result = await build(config);

  if (!result.success) {
    console.error("Build Failed:");
    console.error(result.logs);
  } else {
    console.log("Build Complete.");
  }

  console.timeEnd("build");
  console.log();
  return result.success;
}
