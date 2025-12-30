import { programStates } from "../../states";
import { createHandler } from "../types";
import { withLock } from "../utils";

export default createHandler("f5", {
  down: async () => {
    await withLock("f5", async () => {
      const current = programStates.get("is_enabled");
      programStates.set("is_enabled", !current);
      console.log(
        `---- Program toggle is now ${!current ? "ENABLED" : "DISABLED"} ----`,
      );
    });
  },
});
