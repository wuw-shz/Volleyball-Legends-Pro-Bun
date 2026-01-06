import { keyboard } from "@winput/keyboard";
import { gameStates } from "@states";
import { getConfig } from "@config";
import { createHandler } from "@utils";

export default createHandler("q", {
  down: async () => {
    if (
      getConfig().skill_mode == "stealblock" &&
      gameStates.get("skill_toggle") &&
      gameStates.get("is_skill_ready")
    ) {
      keyboard.tap("ctrl");
      await keyboard.waitForRelease("ctrl");
    }
  },
});
