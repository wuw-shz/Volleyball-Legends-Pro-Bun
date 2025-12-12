/**
 * Unified Rollback Manager
 *
 * Centralizes rollback logic for the release pipeline.
 * Tracks completed stages and executes rollback actions in reverse order.
 */

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

/**
 * Register a rollback action for a specific stage.
 * The action will be executed during rollback if the stage is marked complete.
 */
export function registerRollback(
  stage: RollbackStage,
  action: () => Promise<void>,
): void {
  // Remove any existing action for this stage
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

/**
 * Mark a stage as complete. Only completed stages will be rolled back.
 */
export function markStageComplete(stage: RollbackStage): void {
  const action = rollbackActions.find((r) => r.stage === stage);
  if (action) {
    action.completed = true;
  }
}

/**
 * Execute all registered rollback actions in reverse order.
 * Only stages marked as complete will be rolled back.
 */
export async function executeRollback(): Promise<void> {
  if (isRollingBack) return;
  isRollingBack = true;

  console.error("\n🔄 Initiating rollback...");

  // Get completed actions in reverse order
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

/**
 * Setup global SIGINT handler for graceful rollback on Ctrl+C.
 */
export function setupSigintHandler(): void {
  if (sigintHandlerRegistered) return;
  sigintHandlerRegistered = true;

  process.on("SIGINT", async () => {
    console.log("\n⚠️  Process terminated by user.");
    await executeRollback();
    process.exit(1);
  });
}

/**
 * Clear all registered rollback actions. Call on successful completion.
 */
export function cleanup(): void {
  rollbackActions.length = 0;
}

/**
 * Get the current state of registered rollback actions (for debugging).
 */
export function getRollbackState(): {
  stage: RollbackStage;
  completed: boolean;
}[] {
  return rollbackActions.map(({ stage, completed }) => ({ stage, completed }));
}
