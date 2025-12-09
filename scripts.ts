import { runBuild } from "./scripts/build";
import { runClean } from "./scripts/clean";
import { runCommit } from "./scripts/commit";
import { runCompile } from "./scripts/compile";
import { runPrettier } from "./scripts/prettier";
import { runRelease, runZipAndRelease } from "./scripts/release";
import { runApp } from "./scripts/run";

const args = process.argv.slice(2);
const shouldPrettier = args.includes("--prettier");
const shouldBuild = args.includes("--build");
const shouldClean = args.includes("--clean");
const shouldCompile = args.includes("--compile");
const shouldCommit = args.includes("--commit");
const shouldRelease = args.includes("--release");
const shouldRun = args.includes("--run");

if (shouldRelease) {
  await runRelease(args);
}

let prettierSuccess = true;
if (shouldPrettier) {
  prettierSuccess = await runPrettier();
}

let buildSuccess = true;
if (shouldBuild) {
  buildSuccess = await runBuild();
}

let cleanSuccess = true;
if (shouldClean) {
  cleanSuccess = await runClean();
}

let compileSuccess = true;
if (shouldCompile) {
  compileSuccess = await runCompile();
}

let commitSuccess = true;
if (shouldCommit) {
  commitSuccess = await runCommit();
}

if (shouldRelease && buildSuccess && compileSuccess) {
  await runZipAndRelease();
}

if (shouldRun && buildSuccess && compileSuccess && commitSuccess) {
  if (shouldBuild) await runApp("build");
  else if (shouldCompile) await runApp("compile");
  else await runApp("dev");
}
