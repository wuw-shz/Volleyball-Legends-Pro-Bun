import { pauseListeners, resumeListeners, LoggerClass } from "../utils";

const logger = new LoggerClass(["WORKER", "cyan"]);
import {
  gameStates,
  robloxStates,
  type GameStateShape,
  type RobloxStateShape,
} from "../states";
import path from "path";

interface WorkerMessage<T> {
  name: keyof T;
  value: T[keyof T];
}

type RobloxWorkerMessage = WorkerMessage<RobloxStateShape>;
type GameWorkerMessage = WorkerMessage<GameStateShape>;

interface WorkerState {
  isReady: boolean;
  hasError: boolean;
  lastError: Error | null;
}

const isCompiled = !path
  .basename(process.execPath)
  .toLowerCase()
  .startsWith("bun");

const workerExt = isCompiled ? ".js" : ".ts";
const workerDir = isCompiled
  ? path.dirname(Bun.main).replace(/\\/g, "/") + "/workers"
  : import.meta.dir.replace(/\\/g, "/");
const WORKER_PATHS = {
  roblox: `${workerDir}/roblox${workerExt}`,
  game: `${workerDir}/game${workerExt}`,
} as const;

const workerStates: Map<string, WorkerState> = new Map();

function initWorkerState(name: string): void {
  workerStates.set(name, {
    isReady: false,
    hasError: false,
    lastError: null,
  });
}

function setWorkerReady(name: string): void {
  const state = workerStates.get(name);
  if (state) {
    state.isReady = true;
  }
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

  worker.onerror = (event: ErrorEvent) => {
    const error = new Error(`Worker "${name}" error: ${event.message}`);
    setWorkerError(name, error);
    logger.error(`[${name}] Error:`, event.message);
  };

  setWorkerReady(name);

  return worker;
}

function handleRobloxMessage(data: RobloxWorkerMessage): void {
  const stateObj = robloxStates.toObject();
  if (data.name in stateObj) {
    robloxStates.set(data.name, data.value as boolean);
    if (data.name === "is_active") {
      if (data.value) {
        resumeListeners();
      } else {
        pauseListeners();
      }
    }
  }
}

function handleGameMessage(data: GameWorkerMessage): void {
  const stateObj = gameStates.toObject();
  if (data.name in stateObj) {
    gameStates.set(data.name, data.value as boolean);
  }
}

export let robloxDetection: Worker;
export let gameDetection: Worker;

export async function startWorkers(): Promise<{
  robloxReady: boolean;
  gameReady: boolean;
}> {
  try {
    [robloxDetection, gameDetection] = await Promise.all([
      createWorker("roblox", WORKER_PATHS.roblox, { type: "module" }),
      createWorker("game", WORKER_PATHS.game, { type: "module" }),
    ]);

    const robloxReadyPromise = new Promise<boolean>((res) => {
      robloxDetection.addEventListener(
        "message",
        (ev) => {
          if (ev.data.ready !== undefined) res(ev.data.ready);
        },
        { once: true },
      );
    });

    const gameReadyPromise = new Promise<boolean>((res) => {
      gameDetection.addEventListener(
        "message",
        (ev) => {
          if (ev.data.ready !== undefined) res(ev.data.ready);
        },
        { once: true },
      );
    });

    const { port1, port2 } = new MessageChannel();
    robloxDetection.postMessage(port1, [port1]);
    gameDetection.postMessage(port2, [port2]);

    robloxDetection.onmessage = ({
      data,
    }: MessageEvent<RobloxWorkerMessage>) => {
      handleRobloxMessage(data);
    };

    gameDetection.onmessage = ({ data }: MessageEvent<GameWorkerMessage>) => {
      handleGameMessage(data);
    };

    logger.success("Initialized successfully");

    // Wait for ready messages
    const [robloxReady, gameReady] = await Promise.all([
      robloxReadyPromise,
      gameReadyPromise,
    ]);

    return { robloxReady, gameReady };
  } catch (error) {
    logger.error("Failed to initialize:", error);
    throw error;
  }
}

export function terminateWorkers(): void {
  try {
    if (robloxDetection) {
      robloxDetection.terminate();
      logger.info("[roblox] Terminated");
    }
    if (gameDetection) {
      gameDetection.terminate();
      logger.info("[game] Terminated");
    }
    workerStates.clear();
  } catch (error) {
    logger.error("Error during termination:", error);
  }
}

process.on("beforeExit", () => {
  terminateWorkers();
});
