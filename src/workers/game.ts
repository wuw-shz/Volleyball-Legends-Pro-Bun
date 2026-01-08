declare var self: Worker;
import { Logger } from "@utils";
import { screen } from "@winput/screen";
import { gameStates } from "@states";
import { GAME_WATCHER_CONFIGS, GAME_POLL_RATE } from "./config";
import {
  createStateAccessor,
  type StateAccessor,
  type StateKey,
} from "./shared-state";

const workerLog = new Logger(["Worker", "cyan"], ["Game", "gray"]);

const ENABLE_PROFILING = false;
const PROFILE_INTERVAL_MS = 1000;

let sharedStateAccessor: StateAccessor | undefined;
let isActive = false;
let watcherAbort: AbortController | undefined;
let useDxgi = screen.isDxgiAvailable();

async function runWatcherLoop(signal: AbortSignal): Promise<void> {
  if (!sharedStateAccessor) {
    throw new Error("SharedStateAccessor not initialized");
  }

  const accessor = sharedStateAccessor;
  const watcherCount = GAME_WATCHER_CONFIGS.length;

  const xs: number[] = new Array(watcherCount);
  const ys: number[] = new Array(watcherCount);
  const trs: number[] = new Array(watcherCount);
  const tgs: number[] = new Array(watcherCount);
  const tbs: number[] = new Array(watcherCount);
  const tolerances: number[] = new Array(watcherCount);
  const stateKeys: StateKey[] = new Array(watcherCount);
  const conditionKeys: (StateKey[] | null)[] = new Array(watcherCount);
  const conditionValues: (boolean[] | null)[] = new Array(watcherCount);
  const lastMatches: (boolean | undefined)[] = new Array(watcherCount);

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (let i = 0; i < watcherCount; i++) {
    const cfg = GAME_WATCHER_CONFIGS[i];
    const px = cfg.point[0];
    const py = cfg.point[1];
    xs[i] = px;
    ys[i] = py;
    trs[i] = cfg.target[0];
    tgs[i] = cfg.target[1];
    tbs[i] = cfg.target[2];
    tolerances[i] = cfg.tolerance ?? 0;
    stateKeys[i] = cfg.name as StateKey;
    lastMatches[i] = undefined;

    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;

    if (cfg.conditions && cfg.conditions.length > 0) {
      const keys: StateKey[] = new Array(cfg.conditions.length);
      const vals: boolean[] = new Array(cfg.conditions.length);
      for (let j = 0; j < cfg.conditions.length; j++) {
        keys[j] = cfg.conditions[j].name as StateKey;
        vals[j] = cfg.conditions[j].value;
      }
      conditionKeys[i] = keys;
      conditionValues[i] = vals;
    } else {
      conditionKeys[i] = null;
      conditionValues[i] = null;
    }
  }

  const captureX = minX;
  const captureY = minY;
  const captureW = maxX - minX + 1;
  const captureH = maxY - minY + 1;

  const relativeXs: number[] = new Array(watcherCount);
  const relativeYs: number[] = new Array(watcherCount);
  for (let i = 0; i < watcherCount; i++) {
    relativeXs[i] = xs[i] - captureX;
    relativeYs[i] = ys[i] - captureY;
  }

  if (useDxgi) {
    workerLog.info("Using DXGI capture (GPU-accelerated)");
  } else {
    workerLog.info("Using GDI capture (DXGI unavailable)");
  }

  let loopCount = 0;
  let totalLoopNs = 0;
  let totalCaptureNs = 0;
  let lastProfileTime = Date.now();

  while (!signal.aborted) {
    await Bun.sleep(GAME_POLL_RATE);
    if (signal.aborted) break;

    const loopStart = ENABLE_PROFILING ? Bun.nanoseconds() : 0;

    const captureStart = ENABLE_PROFILING ? Bun.nanoseconds() : 0;
    const imageData = useDxgi
      ? screen.captureDXGI(captureX, captureY, captureW, captureH)
      : screen.captureReuse(captureX, captureY, captureW, captureH);
    const captureTimeNs = ENABLE_PROFILING
      ? Bun.nanoseconds() - captureStart
      : 0;

    if (!imageData) continue;

    const buffer = imageData.buffer;
    const width = imageData.width;

    for (let i = 0; i < watcherCount; i++) {
      const cKeys = conditionKeys[i];
      if (cKeys !== null) {
        const cVals = conditionValues[i]!;
        let skip = false;
        for (let j = 0; j < cKeys.length; j++) {
          if (accessor.get(cKeys[j]) !== cVals[j]) {
            skip = true;
            break;
          }
        }
        if (skip) continue;
      }

      const pixelIndex = (relativeYs[i] * width + relativeXs[i]) * 4;
      const b = buffer[pixelIndex];
      const g = buffer[pixelIndex + 1];
      const r = buffer[pixelIndex + 2];

      const tol = tolerances[i];
      const dr = r - trs[i];
      const dg = g - tgs[i];
      const db = b - tbs[i];

      const isMatch =
        dr >= -tol &&
        dr <= tol &&
        dg >= -tol &&
        dg <= tol &&
        db >= -tol &&
        db <= tol;

      if (isMatch !== lastMatches[i]) {
        accessor.set(stateKeys[i], isMatch);
        lastMatches[i] = isMatch;
      }
    }

    if (ENABLE_PROFILING) {
      const loopEnd = Bun.nanoseconds();
      totalLoopNs += loopEnd - loopStart;
      totalCaptureNs += captureTimeNs;
      loopCount++;

      const now = Date.now();
      if (now - lastProfileTime >= PROFILE_INTERVAL_MS) {
        const avgLoopUs = (totalLoopNs / loopCount / 1000).toFixed(1);
        const avgCaptureUs = (totalCaptureNs / loopCount / 1000).toFixed(1);
        const capturePct = ((totalCaptureNs / totalLoopNs) * 100).toFixed(1);
        workerLog.info(
          `Profile: ${loopCount} loops, avg ${avgLoopUs}µs/loop, capture ${avgCaptureUs}µs (${capturePct}%)`,
        );
        loopCount = 0;
        totalLoopNs = 0;
        totalCaptureNs = 0;
        lastProfileTime = now;
      }
    }
  }
}

function startWatchers(): void {
  stopWatchers();
  watcherAbort = new AbortController();
  runWatcherLoop(watcherAbort.signal).catch((err) => {
    if (err.name !== "AbortError") {
      workerLog.error("Watcher loop failed:", err);
    }
  });
}

function stopWatchers(): void {
  if (watcherAbort) {
    watcherAbort.abort();
    watcherAbort = undefined;
  }
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
