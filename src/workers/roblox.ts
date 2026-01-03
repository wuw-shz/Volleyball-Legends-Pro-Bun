declare var self: Worker;
import "../global";
import { robloxStates, type RobloxStateShape } from "../states";
import { ROBLOX_WATCHER_CONFIGS } from "./config";
import {
  createStateAccessor,
  type StateAccessor,
  type StateKey,
} from "./shared-state";
import { isRobloxActiveFullscreen } from "../utils";

const workerLog = new Logger(["Worker", "cyan"], ["Roblox", "gray"]);

let sharedStateAccessor: StateAccessor | undefined;
let abortController: AbortController | null = null;
let lastActive: boolean | undefined = undefined;

async function runWatcher(
  signal: AbortSignal,
  pollRate: number,
): Promise<void> {
  while (!signal.aborted) {
    await Bun.sleep(pollRate);

    if (signal.aborted) break;

    const { active: isActive, fullscreen } = isRobloxActiveFullscreen();
    const isNowActive = isActive && fullscreen;

    if (isNowActive !== lastActive) {
      robloxStates.set("is_active", isNowActive);

      if (sharedStateAccessor) {
        sharedStateAccessor.set("is_active" as StateKey, isNowActive);
      }

      workerLog.info(`${isNowActive ? "active" : "inactive"}`);
      lastActive = isNowActive;
    }
  }
}

function startWatcher(): void {
  if (abortController) {
    abortController.abort();
  }

  const config = ROBLOX_WATCHER_CONFIGS[0];
  abortController = new AbortController();

  runWatcher(abortController.signal, config.pollRate).catch((err) => {
    if (err.name !== "AbortError") {
      workerLog.error("Roblox watcher failed:", err);
    }
  });
}

function stopWatcher(): void {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  lastActive = undefined;
  robloxStates.reset();
}

function init(): void {
  startWatcher();
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
