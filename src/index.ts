import "./global";
import { runUpdateCheck } from "./utils/updater";
await runUpdateCheck();
import "./config";
import "./listeners";
import { releaseDesktopDC } from "./utils";
import packageJson from "../package.json" with { type: "json" };

process.stdout.write(`\x1b]0;VBL Pro v${packageJson.version}\x07`);

let terminateWorkers: (() => void) | undefined = undefined;

function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down...`);
  terminateWorkers?.();
  releaseDesktopDC();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

(async () => {
  try {
    const { startWorkers, terminateWorkers: terminate } =
      await import("./workers");
    terminateWorkers = terminate;

    const { robloxReady, gameReady } = await startWorkers();

    if (!robloxReady || !gameReady) {
      logger.error("Failed to initialize worker(s)");
      return process.exit(1);
    }

    logger.info("Waiting for Roblox (Fullscreen) ...");
  } catch (error) {
    logger.error("Failed to start:", error);
    terminateWorkers?.();
    process.exit(1);
  }
})();
