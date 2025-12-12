import { registerRollback, markStageComplete } from "../rollback";

async function run(cmd: string[]) {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;
  if (proc.exitCode !== 0) {
    throw new Error(stderr || stdout || `Command failed: ${cmd.join(" ")}`);
  }
  return stdout.trim();
}
async function hasChanges(): Promise<boolean> {
  const status = await run(["git", "status", "--porcelain"]);
  return status.length > 0;
}
async function getUsername(): Promise<string> {
  try {
    const name = await run(["git", "config", "user.name"]);
    if (name) return name.replace(/\s+/g, "_");
  } catch (_) {}
  return process.env.USER || process.env.USERNAME || "unknown";
}
async function getCommitCount(): Promise<number> {
  try {
    const count = await run(["git", "rev-list", "--count", "HEAD"]);
    return Number(count);
  } catch {
    return 0;
  }
}
function formatDate(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

export async function runGitCommit(): Promise<boolean> {
  const username = await getUsername();
  console.time("Staging all changes...");
  await run(["git", "add", "."]);
  console.timeEnd("Staging all changes...");

  if (!(await hasChanges())) {
    console.log("Nothing to commit.");
    return true;
  }

  const count = await getCommitCount();
  const date = formatDate();
  const message = `@${username} ${date} x${count}`;

  // Register rollback action for staged changes
  registerRollback("commit", async () => {
    await run(["git", "reset", "HEAD~1"]);
  });

  console.time(`Committing "${message}" ...`);
  await run(["git", "commit", "-m", message]);
  markStageComplete("commit");
  console.timeEnd(`Committing "${message}" ...`);

  console.time("Pushing to origin main...");
  await run(["git", "push", "origin", "main"]);
  console.timeEnd("Pushing to origin main...");

  return true;
}

// Run standalone if executed directly
if (import.meta.main) {
  runGitCommit().catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
}
