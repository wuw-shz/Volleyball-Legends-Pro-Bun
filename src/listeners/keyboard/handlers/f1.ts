import { keyboard } from "@winput/keyboard";
import { createHandler } from "@utils";

export default createHandler("f1", {
  down: async () => {
    keyboard.tap("esc");
    await Bun.sleep(50);
    keyboard.tap("r");
    await Bun.sleep(50);
    keyboard.tap("enter");
  },
});
