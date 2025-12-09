declare var self: Worker;
let robloxPort: MessagePort;
import "../global";
import { gameStates, robloxStates, type GameStateShape } from "../states";
import { getMultiplePixelRGB, type RGB } from "../utils";

const workerLog = new Logger(["WORKER", "magenta"], ["GAME", "gray"]);

export interface WatchConfig {
  name: keyof GameStateShape;
  point: [number, number];
  target: [number, number, number];
  tolerance?: number;
  conditions?: {
    name: keyof GameStateShape;
    value: boolean;
  }[];
}

const watchers: WatchConfig[] = [
  {
    name: "is_on_ground",
    point: [942, 1003],
    target: [255, 225, 148],
  },
  {
    name: "is_shift_lock",
    point: [1807, 969],
    target: [47, 85, 104],
    tolerance: 10,
  },
  {
    name: "is_skill_ready",
    point: [1029, 903],
    target: [255, 255, 255],
  },
];

let isActive = false;
let watcherAbortController: AbortController | null = null;

function checkConditions(conditions?: WatchConfig["conditions"]): boolean {
  if (!conditions) return true;
  for (const c of conditions) {
    const cValue = gameStates.get(c.name);
    if (cValue !== c.value) return false;
  }
  return true;
}

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

async function runBatchedWatchers(signal: AbortSignal) {
  const points = watchers.map((w) => w.point);

  while (!signal.aborted && isActive) {
    await Bun.sleep(1);

    if (signal.aborted) break;

    const results = getMultiplePixelRGB(points);

    for (let i = 0; i < watchers.length; i++) {
      const config = watchers[i];
      const rgb = results[i];

      if (!rgb || !checkConditions(config.conditions)) continue;

      const isMatch = matchesTarget(rgb, config.target, config.tolerance ?? 0);
      const lastMatch = gameStates.get(config.name);

      if (isMatch !== lastMatch) {
        self.postMessage({
          name: config.name,
          value: isMatch,
        });
        gameStates.set(config.name, isMatch);
      }
    }
  }
}

function startAllWatchers() {
  stopAllWatchers();
  watcherAbortController = new AbortController();

  runBatchedWatchers(watcherAbortController.signal).catch((err) => {
    if (err.name !== "AbortError") {
      workerLog.error("Batched watcher failed:", err);
    }
  });
}

function stopAllWatchers() {
  if (watcherAbortController) {
    watcherAbortController.abort();
    watcherAbortController = null;
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
