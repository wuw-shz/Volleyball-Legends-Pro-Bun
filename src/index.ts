import "./global";
import "./listeners";
import { robloxDetection, gameDetection, terminateWorkers } from "./workers";
import { releaseDesktopDC } from "./utils";

function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down...`);
  terminateWorkers();
  releaseDesktopDC();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

(async () => {
  try {
    const [robloxReady, gameReady] = await Promise.all([
      new Promise<boolean>((res) => {
        robloxDetection.addEventListener(
          "message",
          (ev) => res(ev.data.ready),
          { once: true },
        );
      }),
      new Promise<boolean>((res) => {
        gameDetection.addEventListener("message", (ev) => res(ev.data.ready), {
          once: true,
        });
      }),
    ]);

    if (!robloxReady || !gameReady) {
      logger.error("Failed to initialize worker(s)");
      return process.exit(1);
    }

    logger.info("Waiting for Roblox (Fullscreen) ...");
  } catch (error) {
    logger.error("Failed to start:", error);
    terminateWorkers();
    process.exit(1);
  }
})();
