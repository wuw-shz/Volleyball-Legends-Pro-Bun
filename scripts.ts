import { build, Glob, $, BuildConfig, CompileBuildConfig } from "bun";

const args = process.argv.slice(2);
const shouldBuild = args.includes("--build");
const shouldCompile = args.includes("--compile");
const shouldCommit = args.includes("--commit");
const shouldRun = args.includes("--run");

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
}

let compileSuccess = true;

if (shouldCompile) {
   console.time("compile");
   console.log("Compiling...");
   (<CompileBuildConfig>buildConfig).compile = {
      target: "bun-windows-x64",
      outfile: "vvb",
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
}

if (shouldRun && buildSuccess && compileSuccess && commitSuccess) {
   if (shouldBuild) await $`bun run dist/index.js`;
   else if (shouldCompile) await $`./vvb.exe`;
}
