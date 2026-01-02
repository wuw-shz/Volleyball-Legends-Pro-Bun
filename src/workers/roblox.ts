declare var self: Worker;
import "../global";
import { robloxStates, type RobloxStateShape } from "../states";
import { ROBLOX_WATCHER_CONFIGS, type RobloxWatchConfig } from "./config";
import {
  createStateAccessor,
  type StateAccessor,
  type StateKey,
} from "./shared-state";
import path from "path";

const workerLog = new Logger(["Worker", "cyan"], ["Roblox", "gray"]);

let sharedStateAccessor: StateAccessor | undefined;

interface WatcherThread {
  worker: Worker;
  config: RobloxWatchConfig;
}

const watcherThreads: Map<string, WatcherThread> = new Map();

const isCompiled =
  !path.basename(process.execPath).toLowerCase().startsWith("bun") ||
  import.meta.dir.includes("/dist") ||
  import.meta.dir.includes("\\dist");

const workerExt = isCompiled ? ".js" : ".ts";
const workerDir = import.meta.dir.replace(/\\/g, "/");

const WATCHER_THREAD_PATH = `${workerDir}/threads/roblox${workerExt}`;

function startWatcher(config: RobloxWatchConfig): void {
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

      if (!(data.name in robloxStates.toObject())) {
        return;
      }

      const stateName = data.name as keyof RobloxStateShape;
      const lastValue = robloxStates.get(stateName);

      if (lastValue !== data.value) {
        robloxStates.set(stateName, data.value);

        if (sharedStateAccessor) {
          sharedStateAccessor.set(stateName as StateKey, data.value);
        }

        if (stateName === "is_active") {
          workerLog.info(`${data.value ? "active" : "inactive"}`);
        }
      }
    };

    watcherThreads.set(config.name, { worker, config });

    worker.postMessage({
      type: "start",
      pollRate: config.pollRate,
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

  for (const config of ROBLOX_WATCHER_CONFIGS) {
    startWatcher(config);
  }
}

function stopAllWatchers(): void {
  for (const [name] of watcherThreads) {
    stopWatcher(name);
  }
  robloxStates.reset();
}

function init(): void {
  startAllWatchers();
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
    sharedStateAccessor = createStateAccessor(data.sharedBuffer);
    init();
  }
};
