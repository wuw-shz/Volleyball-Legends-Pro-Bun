declare var self: Worker;
import { Logger } from "@utils";
import { robloxStates } from "@states";
import { ROBLOX_WATCHER_CONFIGS } from "./config";
import { createStateAccessor, type StateAccessor } from "./shared-state";
import { isRobloxActiveFullscreen } from "@utils";

const workerLog = new Logger(["Worker", "cyan"], ["Roblox", "gray"]);

let sharedStateAccessor: StateAccessor | undefined;
let abortController: AbortController | null = null;
let lastActive: boolean | undefined;

async function runWatcher(
  signal: AbortSignal,
  pollRate: number,
): Promise<void> {
  while (!signal.aborted) {
    await Bun.sleep(pollRate);
    if (signal.aborted) break;

    const { active, fullscreen } = isRobloxActiveFullscreen();
    const isNowActive = active && fullscreen;

    if (isNowActive !== lastActive) {
      robloxStates.set("is_active", isNowActive);
      sharedStateAccessor?.set("is_active", isNowActive);
      workerLog.info(isNowActive ? "active" : "inactive");
      lastActive = isNowActive;
    }
  }
}

function startWatcher(): void {
  abortController?.abort();
  abortController = new AbortController();

  const { pollRate } = ROBLOX_WATCHER_CONFIGS[0];

  runWatcher(abortController.signal, pollRate).catch((err) => {
    if (err.name !== "AbortError") {
      workerLog.error("Roblox watcher failed:", err);
    }
  });
}

function stopWatcher(): void {
  abortController?.abort();
  abortController = null;
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
