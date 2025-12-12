import { runBuild } from "./scripts/build";
import { runCommit } from "./scripts/commit";
import { runCompile } from "./scripts/compile";
import { runPrettier } from "./scripts/prettier";
import { runRelease, runZipAndRelease } from "./scripts/release";
import { runApp } from "./scripts/run";
import {
  getBumpType,
  runBumpVersion,
  rollbackVersion,
  cleanupVersionBackup,
} from "./scripts/version";
import {
  registerRollback,
  markStageComplete,
  executeRollback,
  setupSigintHandler,
  cleanup,
} from "./scripts/rollback";

const args = process.argv.slice(2);

type TaskResult = { success: boolean; type: string };
const results: TaskResult[] = [];

// Setup global SIGINT handler for unified rollback
setupSigintHandler();

const bumpType = getBumpType(args);
if (bumpType) {
  // Register version rollback action
  registerRollback("version", async () => {
    await rollbackVersion();
  });

  await runBumpVersion(bumpType);
  markStageComplete("version");
}

async function handleFailure(step: string): Promise<never> {
  console.error(`\n${step} failed!`);
  await executeRollback();
  process.exit(1);
}

for (const arg of args) {
  switch (arg) {
    case "--release":
      await runRelease(args);
      break;
    case "--prettier":
      const prettierSuccess = await runPrettier();
      results.push({ success: prettierSuccess, type: "prettier" });
      if (!prettierSuccess) await handleFailure("Prettier");
      break;
    case "--build":
      const buildSuccess = await runBuild();
      results.push({ success: buildSuccess, type: "build" });
      if (!buildSuccess) await handleFailure("Build");
      break;
    case "--compile":
      const compileSuccess = await runCompile();
      results.push({ success: compileSuccess, type: "compile" });
      if (!compileSuccess) await handleFailure("Compile");
      break;
    case "--commit":
      const commitSuccess = await runCommit();
      results.push({ success: commitSuccess, type: "commit" });
      if (!commitSuccess) await handleFailure("Commit");
      break;
  }
}

const allBuildSuccess =
  results.find((r) => r.type === "build")?.success ?? true;
const allCompileSuccess =
  results.find((r) => r.type === "compile")?.success ?? true;
const allCommitSuccess =
  results.find((r) => r.type === "commit")?.success ?? true;

if (args.includes("--release") && allBuildSuccess && allCompileSuccess) {
  try {
    const releaseSuccess = await runZipAndRelease();
    if (!releaseSuccess) {
      await handleFailure("Release");
    }
    await cleanupVersionBackup();
    cleanup();
  } catch {
    await handleFailure("Release");
  }
} else if (bumpType) {
  await cleanupVersionBackup();
  cleanup();
}

if (
  args.includes("--run") &&
  allBuildSuccess &&
  allCompileSuccess &&
  allCommitSuccess
) {
  if (args.includes("--build")) await runApp("build");
  else if (args.includes("--compile")) await runApp("compile");
  else await runApp("dev");
}
