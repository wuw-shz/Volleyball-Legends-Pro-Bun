import { runGitCommit } from "./github/commit";

export async function runCommit(): Promise<boolean> {
  console.time("commit");
  console.log("Committing...");

  try {
    const success = await runGitCommit();
    if (success) {
      console.log("Commit Complete.");
    }
    console.timeEnd("commit");
    console.log();
    return success;
  } catch (error) {
    console.error("Commit Failed:");
    console.error(error);
    console.timeEnd("commit");
    console.log();
    return false;
  }
}
