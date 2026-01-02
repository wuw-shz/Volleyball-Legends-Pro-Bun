import { keyboard, mouse } from "winput";
import { gameStates, programStates, robloxStates } from "../../states";
import { createHandler } from "../types";
import { waitFor, withLock } from "../utils";

function shouldAbortDown(): boolean {
  return (
    !programStates.get("is_enabled") ||
    !robloxStates.get("is_active") ||
    gameStates.get("is_toss") ||
    (gameStates.get("is_on_ground") && !mouse.isPressed("x1"))
  );
}

function shouldAbortUp(): boolean {
  return (
    !programStates.get("is_enabled") ||
    !robloxStates.get("is_active") ||
    gameStates.get("is_toss")
  );
}

export default createHandler("x1", {
  down: async () => {
    await withLock("x1", async () => {
      if (gameStates.get("is_toss")) return;
      if (!mouse.isPressed("x2")) {
        keyboard.tap("space");
      }
      if (
        await waitFor(() => !gameStates.get("is_on_ground"), shouldAbortDown)
      ) {
        keyboard.press("e");
      }
    });
  },
  up: async () => {
    await withLock("x1", async () => {
      if (gameStates.get("is_toss")) return;
      if (
        await waitFor(
          () => !gameStates.get("is_on_ground") || !mouse.isPressed("x1"),
          shouldAbortUp,
        )
      ) {
        keyboard.release("e");
      }
    });
  },
});
