declare var self: Worker;
import "../../global";
import { screen, type RGB } from "winput";
import type { GameStateShape } from "../../states";

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

interface StartMessage {
  type: "start";
  config: WatcherThreadConfig;
}

interface StopMessage {
  type: "stop";
}

interface StateUpdateMessage {
  type: "state_update";
  states: Partial<GameStateShape>;
}

type WatcherMessage = StartMessage | StopMessage | StateUpdateMessage;

let abortController: AbortController | null = null;
let currentConfig: WatcherThreadConfig | null = null;
let cachedStates: Partial<GameStateShape> = {};

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
  if (!conditions) return true;
  for (const c of conditions) {
    const cValue = cachedStates[c.name];
    if (cValue !== c.value) return false;
  }
  return true;
}

async function runWatcher(config: WatcherThreadConfig, signal: AbortSignal) {
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
      self.postMessage({
        name: config.name,
        value: isMatch,
      });
      lastMatch = isMatch;
    }
  }
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
  cachedStates = {};
}

function handleStateUpdate(states: Partial<GameStateShape>) {
  cachedStates = { ...cachedStates, ...states };
}

self.onmessage = ({ data }: MessageEvent<WatcherMessage>) => {
  switch (data.type) {
    case "start":
      handleStart(data.config);
      break;
    case "stop":
      handleStop();
      break;
    case "state_update":
      handleStateUpdate(data.states);
      break;
  }
};
