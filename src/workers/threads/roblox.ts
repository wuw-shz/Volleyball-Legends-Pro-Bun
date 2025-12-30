declare var self: Worker;
import "../../global";
import { isRobloxActiveFullscreen } from "../../utils";

let abortController: AbortController | null = null;
let lastActive: boolean | undefined = undefined;

async function runWatcher(signal: AbortSignal, pollRate: number) {
  while (!signal.aborted) {
    await Bun.sleep(pollRate);

    if (signal.aborted) break;

    const { active: isActive, fullscreen } = isRobloxActiveFullscreen();
    const isNowActive = isActive && fullscreen;

    if (isNowActive !== lastActive) {
      self.postMessage({
        name: "is_active",
        value: isNowActive,
      });
      lastActive = isNowActive;
    }
  }
}

self.onmessage = ({ data }) => {
  if (data.type === "start") {
    if (abortController) {
      abortController.abort();
    }

    abortController = new AbortController();
    runWatcher(abortController.signal, data.pollRate).catch((err) => {
      if (err.name !== "AbortError") {
        console.error("Roblox watcher failed:", err);
      }
    });
  } else if (data.type === "stop") {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    lastActive = undefined;
  }
};
