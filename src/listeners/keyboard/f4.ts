import { gameStates } from "../../states";
import { createHandler } from "../types";
import { withLock } from "../utils";

export default createHandler("f4", {
   down: async () => {
      await withLock("f4", async () => {
         const current = gameStates.get("skill_toggle");
         gameStates.set("skill_toggle", !current);
         console.log(`---- Skill toggle is now ${!current ? "ENABLED" : "DISABLED"} ----`);
      });
   },
});
