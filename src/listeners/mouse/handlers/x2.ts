import { mouse } from "@winput/mouse";
import { keyboard } from "@winput/keyboard";
import { gameStates, programStates, robloxStates } from "@states";
import { getConfig } from "@config";
import { createHandler, waitFor } from "@utils";

const isEnabled = () => programStates.get("is_enabled");
const isActive = () => robloxStates.get("is_active");
const isOnGround = () => gameStates.get("is_on_ground");
const isShiftLock = () => gameStates.get("is_shift_lock");
const isSkillToggle = () => gameStates.get("skill_toggle");
const isSkillReady = () => gameStates.get("is_skill_ready");

const shouldAbortX2 = () =>
  !isEnabled() || !isActive() || (isOnGround() && !mouse.isPressed("x2"));

export default createHandler("x2", {
  down: async () => {
    const config = getConfig();

    while (mouse.isPressed("x2")) {
      await Bun.sleep(1);

      if (!isEnabled() || !isActive() || mouse.isPressed("x1")) break;

      if (isOnGround()) {
        const shiftLocked = isShiftLock();

        if (!shiftLocked) {
          keyboard.press("shift");
          await Bun.sleep(20);
        }

        if (
          config.skill_mode === "boomjump" &&
          isSkillToggle() &&
          isSkillReady()
        ) {
          keyboard.tap("ctrl");
        } else {
          keyboard.tap("space");
        }

        await waitFor(() => !isOnGround(), shouldAbortX2);

        if (!shiftLocked) {
          keyboard.release("shift");
          keyboard.tap("shift");
        }
      }
    }
  },
  up: async () => {
    if (mouse.isPressed("x1")) return;

    await waitFor(() => !isOnGround(), shouldAbortX2);

    const config = getConfig();
    if (config.skill_mode === "normal" && isSkillToggle() && isSkillReady()) {
      keyboard.tap("ctrl");
      await keyboard.waitForRelease("ctrl");
    }
    mouse.click();
  },
});
