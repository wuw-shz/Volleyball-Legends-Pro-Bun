declare var self: Worker;
let gamePort: MessagePort;
import "../global";
import { robloxStates, type RobloxStateShape } from "../states";
import { ROBLOX_WATCHER_CONFIGS, type RobloxWatchConfig } from "./config";
import path from "path";

const workerLog = new Logger(["Worker", "cyan"], ["Roblox", "gray"]);

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

function startWatcher(config: RobloxWatchConfig) {
  if (watcherThreads.has(config.name)) {
    return;
  }

  try {
    const worker = new Worker(WATCHER_THREAD_PATH, { type: "module" });

    worker.onerror = (event: ErrorEvent) => {
      workerLog.error(`Watcher "${config.name}" error:`, event.message);
      stopWatcher(config.name);
    };

    worker.onmessage = ({ data }) => {
      if (data.name && data.value !== undefined) {
        const lastValue = robloxStates.get(data.name);
        if (lastValue !== data.value) {
          robloxStates.set(data.name, data.value);

          self.postMessage({
            name: data.name,
            value: data.value,
          });

          gamePort.postMessage({
            name: data.name,
            value: data.value,
          });

          workerLog.info(`${data.value ? "active" : "inactive"}`);
        }
      }
    };

    watcherThreads.set(config.name, { worker, config });

    worker.postMessage({
      type: "start",
      pollRate: config.pollRate,
    });
  } catch (error) {
    workerLog.error(`Failed to start watcher "${config.name}":`, error);
  }
}

function stopWatcher(name: string) {
  const watcher = watcherThreads.get(name);
  if (watcher) {
    watcher.worker.postMessage({ type: "stop" });
    watcher.worker.terminate();
    watcherThreads.delete(name);
  }
}

function startAllWatchers() {
  stopAllWatchers();

  for (const config of ROBLOX_WATCHER_CONFIGS) {
    startWatcher(config);
  }
}

function stopAllWatchers() {
  for (const [name] of watcherThreads) {
    stopWatcher(name);
  }
  robloxStates.reset();
}

function init() {
  startAllWatchers();
  workerLog.info("running");
  self.postMessage({ ready: true });
}

self.onmessage = ({ data }) => {
  if (data instanceof MessagePort) {
    gamePort = data;
    init();
  }
};
