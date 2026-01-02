declare var self: Worker;
import "../global";
import {
  gameStates,
  robloxStates,
  type GameStateShape,
  type RobloxStateShape,
} from "../states";
import { GAME_WATCHER_CONFIGS, type GameWatchConfig } from "./config";
import {
  createStateAccessor,
  type StateAccessor,
  type StateKey,
} from "./shared-state";
import path from "path";

const workerLog = new Logger(["Worker", "cyan"], ["Game", "gray"]);

let sharedStateAccessor: StateAccessor | undefined;

interface WatcherThread {
  worker: Worker;
  config: GameWatchConfig;
}

const watcherThreads: Map<string, WatcherThread> = new Map();
let isActive = false;
let sharedBuffer: SharedArrayBuffer | undefined;

const isCompiled =
  !path.basename(process.execPath).toLowerCase().startsWith("bun") ||
  import.meta.dir.includes("/dist") ||
  import.meta.dir.includes("\\dist");

const workerExt = isCompiled ? ".js" : ".ts";
const workerDir = import.meta.dir.replace(/\\/g, "/");

const WATCHER_THREAD_PATH = `${workerDir}/threads/game${workerExt}`;

function startWatcher(config: GameWatchConfig): void {
  if (watcherThreads.has(config.name)) {
    return;
  }

  try {
    const worker = new Worker(WATCHER_THREAD_PATH, { type: "module" });

    worker.onerror = (event: ErrorEvent): void => {
      workerLog.error(`Watcher "${config.name}" error:`, event.message);
      stopWatcher(config.name);
    };

    worker.onmessage = ({
      data,
    }: MessageEvent<{ name?: string; value?: boolean }>): void => {
      if (!data.name || data.value === undefined) {
        return;
      }

      if (!(data.name in gameStates.toObject())) {
        return;
      }

      const stateName = data.name as keyof GameStateShape;
      const lastValue = gameStates.get(stateName);

      if (lastValue !== data.value) {
        gameStates.set(stateName, data.value);

        if (sharedStateAccessor) {
          sharedStateAccessor.set(stateName as StateKey, data.value);
        }
      }
    };

    watcherThreads.set(config.name, { worker, config });

    // Send SharedArrayBuffer to watcher thread first
    if (sharedBuffer) {
      worker.postMessage({ type: "init", sharedBuffer });
    }

    worker.postMessage({
      type: "start",
      config,
    });
  } catch (error: unknown) {
    workerLog.error(`Failed to start watcher "${config.name}":`, error);
  }
}

function stopWatcher(name: string): void {
  const watcher = watcherThreads.get(name);
  if (!watcher) {
    return;
  }

  watcher.worker.postMessage({ type: "stop" });
  watcher.worker.terminate();
  watcherThreads.delete(name);
}

function startAllWatchers(): void {
  stopAllWatchers();

  for (const config of GAME_WATCHER_CONFIGS) {
    startWatcher(config);
  }
}

function stopAllWatchers(): void {
  for (const [name] of watcherThreads) {
    stopWatcher(name);
  }
  gameStates.reset();
}

async function watchRoblox(): Promise<never> {
  if (!sharedStateAccessor) {
    throw new Error("SharedStateAccessor not initialized");
  }

  while (true) {
    // Wait for is_active state change
    await sharedStateAccessor.waitAsync(100);

    const robloxActive = sharedStateAccessor.get("is_active");
    if (robloxActive !== isActive) {
      isActive = robloxActive;
      if (isActive) {
        workerLog.info("started");
        startAllWatchers();
      } else {
        workerLog.info("stopped");
        stopAllWatchers();
      }
    }
  }
}

function init(): void {
  watchRoblox();
  workerLog.info("running");
  self.postMessage({ ready: true });
}

interface InitMessage {
  type: "init";
  sharedBuffer: SharedArrayBuffer;
}

function isInitMessage(data: unknown): data is InitMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === "init" &&
    "sharedBuffer" in data &&
    data.sharedBuffer instanceof SharedArrayBuffer
  );
}

self.onmessage = ({ data }: MessageEvent<unknown>): void => {
  if (isInitMessage(data)) {
    sharedBuffer = data.sharedBuffer;
    sharedStateAccessor = createStateAccessor(data.sharedBuffer);
    init();
  }
};
