const startTime = Date.now();

import packageJson from "../package.json" with { type: "json" };
process.stdout.write(`\x1b]0;VBL Pro v${packageJson.version}\x07`);

import "./global";
import { loadConfig } from "./config";
import { LoggerClass } from "./utils";
import { robloxStates } from "./states";

loadConfig();

const logger = new LoggerClass(["Main", "cyan"]);

let terminateWorkers: (() => void) | undefined;
let listenersInitialized = false;
let overlayInitialized = false;

robloxStates.onChange(async (name, value) => {
  if (name === "is_active" && value === true) {
    if (!listenersInitialized) {
      const { initializeListeners } = await import("./listeners");
      await initializeListeners();
      listenersInitialized = true;
    }

    if (!overlayInitialized) {
      const { startOverlay } = await import("./overlay");
      startOverlay();
      overlayInitialized = true;
    }
  }
});

type ShutdownSignal = "SIGINT" | "SIGTERM";

async function shutdown(signal: ShutdownSignal): Promise<never> {
  logger.info(`Received ${signal}, shutting down...`);

  if (overlayInitialized) {
    const { stopOverlay } = await import("./overlay");
    stopOverlay();
  }

  terminateWorkers?.();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

async function main(): Promise<void> {
  try {
    const { startWorkers, terminateWorkers: terminate } =
      await import("./workers");
    terminateWorkers = terminate;

    const { robloxReady, gameReady } = await startWorkers();

    if (!robloxReady || !gameReady) {
      logger.error("Failed to initialize worker(s)");
      process.exit(1);
    }

    logger.info(`Startup time: ${Date.now() - startTime}ms`);
    logger.info("Waiting for Roblox (Fullscreen) ...");
  } catch (error: unknown) {
    logger.error("Failed to start:", error);
    terminateWorkers?.();
    process.exit(1);
  }
}

main();
