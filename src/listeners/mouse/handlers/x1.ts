import { mouse } from "@winput/mouse";
import { keyboard } from "@winput/keyboard";
import { gameStates, programStates, robloxStates } from "@states";
import { createHandler, waitFor } from "@utils";

export default createHandler("x1", {
  down: async () => {
    if (gameStates.get("is_toss")) return;
    if (!mouse.isPressed("x2")) {
      keyboard.tap("space");
    }
    const success = await waitFor(
      () => !gameStates.get("is_on_ground"),
      () =>
        !programStates.get("is_enabled") ||
        !robloxStates.get("is_active") ||
        gameStates.get("is_toss") ||
        (gameStates.get("is_on_ground") && !mouse.isPressed("x1")),
    );
    if (success) {
      keyboard.press("e");
    }
  },
  up: async () => {
    if (gameStates.get("is_toss")) return;
    const success = await waitFor(
      () => !gameStates.get("is_on_ground") || !mouse.isPressed("x1"),
      () =>
        !programStates.get("is_enabled") ||
        !robloxStates.get("is_active") ||
        gameStates.get("is_toss"),
    );
    if (success) {
      keyboard.release("e");
    }
  },
});
