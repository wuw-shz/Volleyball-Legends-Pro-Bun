import { keyboard } from "winput";
import { createHandler } from "../types";
import { withLock } from "../utils";

export default createHandler("f1", {
   down: async () => {
      await withLock("f1", async () => {
         keyboard.tap("esc");
         await Bun.sleep(50);
         keyboard.tap("r");
         await Bun.sleep(50);
         keyboard.tap("enter");
      });
   },
});
