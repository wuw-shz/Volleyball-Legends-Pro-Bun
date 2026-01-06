import { mouse } from "@winput/mouse";
import { keyboard } from "@winput/keyboard";
import { gameStates, programStates, robloxStates } from "@states";
import { getConfig } from "@config";
import { createHandler, waitFor } from "@utils";

export default createHandler("x2", {
  down: async () => {
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

      if (gameStates.get("is_on_ground")) {
        const isShift = gameStates.get("is_shift_lock");
        const config = getConfig();

        if (!isShift) {
          keyboard.press("shift");
          await Bun.sleep(20);
        }

        if (
          config.skill_mode === "boomjump" &&
          gameStates.get("skill_toggle") &&
          gameStates.get("is_skill_ready")
        ) {
          keyboard.tap("ctrl");
        } else {
          keyboard.tap("space");
        }

        await waitFor(
          () => !gameStates.get("is_on_ground"),
          () =>
            !programStates.get("is_enabled") ||
            !robloxStates.get("is_active") ||
            gameStates.get("is_toss") ||
            (gameStates.get("is_on_ground") && !mouse.isPressed("x2")),
        );

        if (!isShift) {
          keyboard.release("shift");
          keyboard.tap("shift");
        }
      }
    }
  },
  up: async () => {
    if (gameStates.get("is_toss")) return;
    if (mouse.isPressed("x1")) return;

    await waitFor(
      () => !gameStates.get("is_on_ground"),
      () =>
        !programStates.get("is_enabled") ||
        !robloxStates.get("is_active") ||
        gameStates.get("is_toss") ||
        (gameStates.get("is_on_ground") && !mouse.isPressed("x2")),
    );

    const config = getConfig();
    if (
      config.skill_mode === "normal" &&
      gameStates.get("skill_toggle") &&
      gameStates.get("is_skill_ready")
    ) {
      keyboard.tap("ctrl");
      await keyboard.waitForRelease("ctrl");
    }
    mouse.click();
  },
});
