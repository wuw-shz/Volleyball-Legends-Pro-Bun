declare var self: Worker;
import "../global";
import { screen, type RGB } from "winput";
import { gameStates, type GameStateShape } from "../states";
import { GAME_WATCHER_CONFIGS, type GameWatchConfig } from "./config";
import {
  createStateAccessor,
  type StateAccessor,
  type StateKey,
} from "./shared-state";

const workerLog = new Logger(["Worker", "cyan"], ["Game", "gray"]);

let sharedStateAccessor: StateAccessor | undefined;
let isActive = false;
let abortController: AbortController | null = null;

function matchesTarget(
  rgb: RGB,
  target: [number, number, number],
  tolerance: number,
): boolean {
  const rDiff = Math.abs(rgb.r - target[0]);
  const gDiff = Math.abs(rgb.g - target[1]);
  const bDiff = Math.abs(rgb.b - target[2]);
  return rDiff <= tolerance && gDiff <= tolerance && bDiff <= tolerance;
}

function checkConditions(conditions?: GameWatchConfig["conditions"]): boolean {
  if (!conditions || !sharedStateAccessor) return true;
  for (const c of conditions) {
    const cValue = sharedStateAccessor.get(c.name as StateKey);
    if (cValue !== c.value) return false;
  }
  return true;
}

async function runAllWatchers(signal: AbortSignal): Promise<void> {
  if (!sharedStateAccessor) {
    throw new Error("SharedStateAccessor not initialized");
  }

  const lastMatches = new Map<keyof GameStateShape, boolean | undefined>();

  while (!signal.aborted) {
    await Bun.sleep(1);

    if (signal.aborted) break;

    for (const config of GAME_WATCHER_CONFIGS) {
      if (!checkConditions(config.conditions)) continue;

      const [x, y] = config.point;
      const rgb = screen.getPixel(x, y);

      if (!rgb) continue;

      const tolerance = config.tolerance ?? 0;
      const isMatch = matchesTarget(rgb, config.target, tolerance);
      const lastMatch = lastMatches.get(config.name);

      if (isMatch !== lastMatch) {
        sharedStateAccessor.set(config.name as StateKey, isMatch);
        lastMatches.set(config.name, isMatch);
      }
    }
  }
}

function startWatchers(): void {
  if (abortController) {
    abortController.abort();
  }

  abortController = new AbortController();

  runAllWatchers(abortController.signal).catch((err) => {
    if (err.name !== "AbortError") {
      workerLog.error("Game watcher failed:", err);
    }
  });
}

function stopWatchers(): void {
  if (abortController) {
    abortController.abort();
    abortController = null;
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
