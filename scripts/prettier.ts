import { $ } from "bun";

export async function runPrettier(): Promise<boolean> {
  console.time("prettier");
  console.log("Formatting...");

  const result = await $`bunx prettier --write .`;
  const success = result.exitCode === 0;

  if (!success) {
    console.error("Prettier Failed:");
    console.error(result.stderr.toString());
  } else {
    console.log("Prettier Complete.");
  }

  console.timeEnd("prettier");
  console.log();
  return success;
}
