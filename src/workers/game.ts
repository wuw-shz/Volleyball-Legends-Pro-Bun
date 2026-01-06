declare var self: Worker;
import { Logger } from "@utils";
import { screen } from "@winput/screen";
import { gameStates } from "@states";
import { GAME_WATCHER_CONFIGS, type GameWatchConfig } from "./config";
import {
  createStateAccessor,
  type StateAccessor,
  type StateKey,
} from "./shared-state";

const workerLog = new Logger(["Worker", "cyan"], ["Game", "gray"]);

let sharedStateAccessor: StateAccessor | undefined;
let isActive = false;
let watcherAborts: AbortController[] = [];

async function runWatcher(
  config: GameWatchConfig,
  signal: AbortSignal,
): Promise<void> {
  if (!sharedStateAccessor) {
    throw new Error("SharedStateAccessor not initialized");
  }

  const [x, y] = config.point;
  const [tr, tg, tb] = config.target;
  const tolerance = config.tolerance ?? 0;
  const conditions = config.conditions;
  let lastMatch: boolean | undefined;

  while (!signal.aborted) {
    await Bun.sleep(config.pollRate);
    if (signal.aborted) break;

    if (conditions) {
      let skip = false;
      for (const c of conditions) {
        if (sharedStateAccessor.get(c.name as StateKey) !== c.value) {
          skip = true;
          break;
        }
      }
      if (skip) continue;
    }

    const rgb = screen.getPixel(x, y);
    if (!rgb) continue;

    const isMatch =
      Math.abs(rgb.r - tr) <= tolerance &&
      Math.abs(rgb.g - tg) <= tolerance &&
      Math.abs(rgb.b - tb) <= tolerance;

    if (isMatch !== lastMatch) {
      sharedStateAccessor.set(config.name as StateKey, isMatch);
      lastMatch = isMatch;
    }
  }
}

function startWatchers(): void {
  stopWatchers();

  for (const config of GAME_WATCHER_CONFIGS) {
    const abort = new AbortController();
    watcherAborts.push(abort);

    runWatcher(config, abort.signal).catch((err) => {
      if (err.name !== "AbortError") {
        workerLog.error(`Watcher "${config.name}" failed:`, err);
      }
    });
  }
}

function stopWatchers(): void {
  for (const abort of watcherAborts) {
    abort.abort();
  }
  watcherAborts = [];
  gameStates.reset();
}

async function watchRoblox(): Promise<never> {
  if (!sharedStateAccessor) {
    throw new Error("SharedStateAccessor not initialized");
  }

  while (true) {
    await sharedStateAccessor.waitAsync(100);

    const robloxActive = sharedStateAccessor.get("is_active");
    if (robloxActive !== isActive) {
      isActive = robloxActive;
      if (isActive) {
        workerLog.info("started");
        startWatchers();
      } else {
        workerLog.info("stopped");
        stopWatchers();
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
    sharedStateAccessor = createStateAccessor(data.sharedBuffer);
    init();
  }
};
