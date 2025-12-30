import { keyboard, mouse } from "winput";
import { gameStates, robloxStates } from "../../states";
import { createHandler } from "../types";
import { waitFor, withLock } from "../utils";

function shouldAbort(): boolean {
  return !robloxStates.get("is_active") || gameStates.get("is_toss");
}

export default createHandler("x1", {
  down: async () => {
    await withLock("x1", async () => {
      if (gameStates.get("is_toss")) return;
      if (!mouse.isPressed("x2")) {
        keyboard.tap("space");
      }
      await waitFor(() => !gameStates.get("is_on_ground"), shouldAbort);
      keyboard.press("e");
    });
  },
  up: async () => {
    await withLock("x1", async () => {
      if (gameStates.get("is_toss")) return;
      await waitFor(() => !gameStates.get("is_on_ground"), shouldAbort);
      keyboard.release("e");
    });
  },
});
