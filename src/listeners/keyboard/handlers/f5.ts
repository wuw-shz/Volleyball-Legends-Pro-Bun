import { programStates } from "@states";
import { createHandler } from "@utils";

export default createHandler("f5", {
  down: async () => {
    const current = programStates.get("is_enabled");
    programStates.set("is_enabled", !current);
    console.log(
      `---- Aim line toggle is now ${!current ? "ENABLED" : "DISABLED"} ----`,
    );
  },
});
