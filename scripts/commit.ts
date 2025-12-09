import { $ } from "bun";

export async function runCommit(): Promise<boolean> {
  console.time("commit");
  console.log("Committing...");

  const result = await $`bun run git/commit.ts`;
  const success = result.exitCode === 0;

  if (!success) {
    console.error("Commit Failed:");
    console.error(result.stderr.toString());
  } else {
    console.log("Commit Complete.");
  }

  console.timeEnd("commit");
  console.log();
  return success;
}
