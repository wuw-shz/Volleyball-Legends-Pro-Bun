import { mouse, keyboard } from "winput";
import { gameStates, programStates, robloxStates } from "../../states";
import { createHandler } from "../types";
import { waitFor, withLock } from "../utils";
import { getConfig } from "../../config";

function shouldAbort(): boolean {
  return (
    !programStates.get("is_enabled") ||
    !robloxStates.get("is_active") ||
    gameStates.get("is_toss") ||
    (gameStates.get("is_on_ground") && !mouse.isPressed("x2"))
  );
}

export default createHandler("x2", {
  down: async () => {
    await withLock("x2", async () => {
      if (gameStates.get("is_toss")) return;

      while (mouse.isPressed("x2")) {
        await Bun.sleep(1);

        if (
          !programStates.get("is_enabled") ||
          !robloxStates.get("is_active") ||
          gameStates.get("is_toss") ||
          mouse.isPressed("x1")
        )
          break;

        if (gameStates.get("is_on_ground") && !gameStates.get("is_on_air")) {
          const isShift = gameStates.get("is_shift_lock");

          if (!isShift) {
            keyboard.press("shift");
            await Bun.sleep(20);
          }

          if (
            getConfig().skill_mode == "boomjump" &&
            gameStates.get("skill_toggle") &&
            gameStates.get("is_skill_ready")
          ) {
            keyboard.tap("ctrl");
          } else {
            keyboard.tap("space");
          }
          await waitFor(() => gameStates.get("is_on_air"), shouldAbort);

          if (!isShift) {
            keyboard.release("shift");
            keyboard.tap("shift");
          }
        }
      }
    });
  },
  up: async () => {
    await withLock("x2", async () => {
      if (gameStates.get("is_toss")) return;
      if (!mouse.isPressed("x1")) {
        await waitFor(() => gameStates.get("is_on_air"), shouldAbort);
        if (
          getConfig().skill_mode == "normal" &&
          gameStates.get("skill_toggle") &&
          gameStates.get("is_skill_ready")
        ) {
          keyboard.tap("ctrl");
          await keyboard.waitForRelease("ctrl");
        }
        mouse.click();
      }
    });
  },
});
