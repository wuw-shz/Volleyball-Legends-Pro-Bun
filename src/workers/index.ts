import { pauseListeners, resumeListeners, Logger } from "@utils";
import {
  createSharedStateBuffer,
  createStateAccessor,
  STATE_KEYS,
  type StateKey,
} from "./shared-state";
import { gameStates, robloxStates, type GameStateShape } from "@states";
import path from "path";

const logger = new Logger(["Worker", "cyan"]);

interface WorkerState {
  isReady: boolean;
  hasError: boolean;
  lastError: Error | null;
}

const isCompiled =
  !path.basename(process.execPath).toLowerCase().startsWith("bun") ||
  import.meta.dir.includes("/dist") ||
  import.meta.dir.includes("\\dist");

const workerExt = isCompiled ? ".js" : ".ts";
const workerDir = isCompiled
  ? `${import.meta.dir.replace(/\\/g, "/")}/workers`
  : import.meta.dir.replace(/\\/g, "/");

const WORKER_PATHS = {
  roblox: `${workerDir}/roblox${workerExt}`,
  game: `${workerDir}/game${workerExt}`,
} as const;

const workerStates = new Map<string, WorkerState>();

function initWorkerState(name: string): void {
  workerStates.set(name, {
    isReady: false,
    hasError: false,
    lastError: null,
  });
}

function setWorkerReady(name: string): void {
  const state = workerStates.get(name);
  if (state) state.isReady = true;
}

function setWorkerError(name: string, error: Error): void {
  const state = workerStates.get(name);
  if (state) {
    state.hasError = true;
    state.lastError = error;
  }
}

export function areWorkersReady(): boolean {
  for (const state of workerStates.values()) {
    if (!state.isReady || state.hasError) return false;
  }
  return true;
}

export function getWorkerState(name: string): WorkerState | undefined {
  return workerStates.get(name);
}

async function createWorker(
  name: string,
  filePath: string,
  options?: WorkerOptions,
): Promise<Worker> {
  initWorkerState(name);

  const worker = new Worker(filePath, options);

  worker.onerror = (event: ErrorEvent): void => {
    const error = new Error(`Worker "${name}" error: ${event.message}`);
    setWorkerError(name, error);
    logger.error(`[${name}] Error:`, event.message);
  };

  setWorkerReady(name);
  return worker;
}

export let robloxDetection: Worker;
export let gameDetection: Worker;

let stateWatcherAbort: AbortController | undefined;

function waitForReady(worker: Worker): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    worker.addEventListener(
      "message",
      (ev: MessageEvent<{ ready?: boolean }>) => {
        if (ev.data.ready !== undefined) {
          resolve(ev.data.ready);
        }
      },
      { once: true },
    );
  });
}

export async function startWorkers(): Promise<{
  robloxReady: boolean;
  gameReady: boolean;
}> {
  try {
    [robloxDetection, gameDetection] = await Promise.all([
      createWorker("roblox", WORKER_PATHS.roblox, { type: "module" }),
      createWorker("game", WORKER_PATHS.game, { type: "module" }),
    ]);

    const sharedBuffer = createSharedStateBuffer();

    robloxDetection.postMessage({ type: "init", sharedBuffer });
    gameDetection.postMessage({ type: "init", sharedBuffer });

    startStateWatcher(sharedBuffer);

    logger.info("Initialized successfully");

    const [robloxReady, gameReady] = await Promise.all([
      waitForReady(robloxDetection),
      waitForReady(gameDetection),
    ]);

    return { robloxReady, gameReady };
  } catch (error: unknown) {
    logger.error("Failed to initialize:", error);
    throw error;
  }
}

function startStateWatcher(buffer: SharedArrayBuffer): void {
  if (stateWatcherAbort) {
    stateWatcherAbort.abort();
  }

  stateWatcherAbort = new AbortController();
  const accessor = createStateAccessor(buffer);
  const signal = stateWatcherAbort.signal;

  const prevStates = new Map<StateKey, boolean>();
  for (const key of STATE_KEYS) {
    prevStates.set(key, accessor.get(key));
  }

  async function watchLoop(): Promise<void> {
    while (!signal.aborted) {
      try {
        await accessor.waitAsync(1000);
      } catch (err) {
        logger.error("waitAsync failed:", err);
        await Bun.sleep(10);
      }

      if (signal.aborted) break;

      for (const key of STATE_KEYS) {
        const current = accessor.get(key);
        const prev = prevStates.get(key);

        if (current !== prev) {
          prevStates.set(key, current);

          if (key === "is_active") {
            robloxStates.set(key, current);

            if (current) {
              const { loadConfig } = await import("../config");
              await loadConfig();
              resumeListeners();
            } else {
              pauseListeners();
            }
          } else {
            gameStates.set(key as keyof GameStateShape, current);
          }
        }
      }
    }
  }

  watchLoop().catch((err) => {
    if (!signal.aborted) {
      logger.error("State watcher failed:", err);
    }
  });
}

export function terminateWorkers(): void {
  try {
    if (stateWatcherAbort) {
      stateWatcherAbort.abort();
      stateWatcherAbort = undefined;
    }

    if (robloxDetection) {
      robloxDetection.terminate();
      logger.info("[roblox] Terminated");
    }
    if (gameDetection) {
      gameDetection.terminate();
      logger.info("[game] Terminated");
    }
    workerStates.clear();
  } catch (error: unknown) {
    logger.error("Error during termination:", error);
  }
}

process.on("beforeExit", terminateWorkers);
