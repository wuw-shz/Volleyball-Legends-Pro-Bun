export type RollbackStage =
  | "version"
  | "commit"
  | "compile"
  | "zip"
  | "release";

interface RollbackAction {
  stage: RollbackStage;
  action: () => Promise<void>;
  completed: boolean;
}

const rollbackActions: RollbackAction[] = [];
let isRollingBack = false;
let sigintHandlerRegistered = false;

export function registerRollback(
  stage: RollbackStage,
  action: () => Promise<void>,
): void {
  const existingIndex = rollbackActions.findIndex((r) => r.stage === stage);
  if (existingIndex !== -1) {
    rollbackActions.splice(existingIndex, 1);
  }

  rollbackActions.push({
    stage,
    action,
    completed: false,
  });
}

export function markStageComplete(stage: RollbackStage): void {
  const action = rollbackActions.find((r) => r.stage === stage);
  if (action) {
    action.completed = true;
  }
}

export async function executeRollback(): Promise<void> {
  if (isRollingBack) return;
  isRollingBack = true;

  console.error("\n🔄 Initiating rollback...");

  const completedActions = rollbackActions.filter((r) => r.completed).reverse();

  if (completedActions.length === 0) {
    console.log("No stages to rollback.");
    isRollingBack = false;
    return;
  }

  for (const { stage, action } of completedActions) {
    try {
      console.log(`  ↩️  Rolling back ${stage}...`);
      await action();
      console.log(`  ✅ ${stage} rolled back successfully`);
    } catch (error) {
      console.error(`  ❌ Failed to rollback ${stage}:`, error);
    }
  }

  console.log("🔄 Rollback complete.\n");
  isRollingBack = false;
}

export function setupSigintHandler(): void {
  if (sigintHandlerRegistered) return;
  sigintHandlerRegistered = true;

  process.on("SIGINT", () => {
    console.log("\n⚠️  Process terminated by user.");
    setImmediate(async () => {
      try {
        await executeRollback();
      } catch (error) {
        console.error("Rollback error:", error);
      } finally {
        process.exit(1);
      }
    });
  });
}

export function cleanup(): void {
  rollbackActions.length = 0;
}

export function getRollbackState(): {
  stage: RollbackStage;
  completed: boolean;
}[] {
  return rollbackActions.map(({ stage, completed }) => ({ stage, completed }));
}
