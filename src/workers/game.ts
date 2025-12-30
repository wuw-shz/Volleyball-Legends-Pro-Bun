declare var self: Worker;
let robloxPort: MessagePort;
import "../global";
import { gameStates, robloxStates, type GameStateShape } from "../states";
import { GAME_WATCHER_CONFIGS, type GameWatchConfig } from "./config";
import path from "path";

const workerLog = new Logger(["Worker", "cyan"], ["Game", "gray"]);

interface WatcherThread {
  worker: Worker;
  config: GameWatchConfig;
}

const watcherThreads: Map<string, WatcherThread> = new Map();
let isActive = false;

const isCompiled =
  !path.basename(process.execPath).toLowerCase().startsWith("bun") ||
  import.meta.dir.includes("/dist") ||
  import.meta.dir.includes("\\dist");

const workerExt = isCompiled ? ".js" : ".ts";
const workerDir = import.meta.dir.replace(/\\/g, "/");

const WATCHER_THREAD_PATH = `${workerDir}/threads/game${workerExt}`;

function startWatcher(config: GameWatchConfig) {
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
        const lastValue = gameStates.get(data.name);
        if (lastValue !== data.value) {
          gameStates.set(data.name, data.value);

          self.postMessage({
            name: data.name,
            value: data.value,
          });

          broadcastStateUpdate({ [data.name]: data.value });
        }
      }
    };

    watcherThreads.set(config.name, { worker, config });

    worker.postMessage({
      type: "start",
      config,
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

function broadcastStateUpdate(states: Partial<GameStateShape>) {
  for (const [_, watcher] of watcherThreads) {
    watcher.worker.postMessage({
      type: "state_update",
      states,
    });
  }
}

function startAllWatchers() {
  stopAllWatchers();

  for (const config of GAME_WATCHER_CONFIGS) {
    startWatcher(config);
  }
}

function stopAllWatchers() {
  for (const [name] of watcherThreads) {
    stopWatcher(name);
  }
  gameStates.reset();
}

async function watchRoblox() {
  while (true) {
    await Bun.sleep(100);
    const robloxActive = robloxStates.get("is_active");
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

function init() {
  watchRoblox();
  workerLog.info("running");
  self.postMessage({ ready: true });
}

self.onmessage = ({ data }) => {
  if (data instanceof MessagePort) {
    robloxPort = data;
    robloxPort.onmessage = ({ data }) => {
      if (data.name in robloxStates.toObject()) {
        robloxStates.set(data.name, data.value);
      }
    };
    init();
  }
};
