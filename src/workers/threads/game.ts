declare var self: Worker;
import "../../global";
import { screen, type RGB } from "winput";
import type { GameStateShape } from "../../states";
import {
  createStateAccessor,
  type StateAccessor,
  type StateKey,
} from "../shared-state";

export interface WatcherThreadConfig {
  name: keyof GameStateShape;
  point: [number, number];
  target: [number, number, number];
  tolerance: number;
  pollRate: number;
  conditions?: {
    name: keyof GameStateShape;
    value: boolean;
  }[];
}

interface InitMessage {
  type: "init";
  sharedBuffer: SharedArrayBuffer;
}

interface StartMessage {
  type: "start";
  config: WatcherThreadConfig;
}

interface StopMessage {
  type: "stop";
}

type WatcherMessage = InitMessage | StartMessage | StopMessage;

let abortController: AbortController | null = null;
let currentConfig: WatcherThreadConfig | null = null;
let sharedStateAccessor: StateAccessor | undefined;

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

function checkConditions(
  conditions?: WatcherThreadConfig["conditions"],
): boolean {
  if (!conditions || !sharedStateAccessor) return true;
  for (const c of conditions) {
    const cValue = sharedStateAccessor.get(c.name as StateKey);
    if (cValue !== c.value) return false;
  }
  return true;
}

async function runWatcher(config: WatcherThreadConfig, signal: AbortSignal) {
  if (!sharedStateAccessor) {
    throw new Error("SharedStateAccessor not initialized");
  }

  const [x, y] = config.point;
  let lastMatch: boolean | undefined = undefined;

  while (!signal.aborted) {
    await Bun.sleep(config.pollRate);

    if (signal.aborted) break;

    if (!checkConditions(config.conditions)) continue;

    const rgb = screen.getPixel(x, y);

    if (!rgb) continue;

    const isMatch = matchesTarget(rgb, config.target, config.tolerance);

    if (isMatch !== lastMatch) {
      // Write directly to SharedArrayBuffer instead of postMessage
      sharedStateAccessor.set(config.name as StateKey, isMatch);
      lastMatch = isMatch;
    }
  }
}

function handleInit(sharedBuffer: SharedArrayBuffer) {
  sharedStateAccessor = createStateAccessor(sharedBuffer);
}

function handleStart(config: WatcherThreadConfig) {
  if (abortController) {
    abortController.abort();
  }

  currentConfig = config;
  abortController = new AbortController();

  runWatcher(config, abortController.signal).catch((err) => {
    if (err.name !== "AbortError") {
      console.error(`Watcher "${config.name}" failed:`, err);
    }
  });
}

function handleStop() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  currentConfig = null;
}

self.onmessage = ({ data }: MessageEvent<WatcherMessage>) => {
  switch (data.type) {
    case "init":
      handleInit(data.sharedBuffer);
      break;
    case "start":
      handleStart(data.config);
      break;
    case "stop":
      handleStop();
      break;
  }
};
