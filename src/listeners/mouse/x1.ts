import { keyboard } from "winput";
import { gameStates } from "../../states";
import { createHandler } from "../types";
import { withLock } from "../utils";

export default createHandler("x1", {
  down: async () => {
    await withLock("x1", async () => {
      if (gameStates.get("is_toss")) return;
      keyboard.tap("space");
      await keyboard.waitForRelease("space");
      keyboard.press("e");
    });
  },
  up: async () => {
    await withLock("x1", async () => {
      if (gameStates.get("is_toss")) return;
      keyboard.release("e");
    });
  },
});
