import { overlay, screen } from "winput";
import { robloxStates, programStates } from "../states";
import { LoggerClass } from "../utils/logger";

const logger = new LoggerClass(["Overlay", "cyan"]);

let check = false;
let intervalId: Timer | undefined;
let hasLoggedShowing = false;
let cachedPen: ReturnType<typeof overlay.createPen> | undefined;
let cachedSize: { width: number; height: number } | undefined;

export function startOverlay(): void {
  if (intervalId !== undefined) {
    return;
  }

  cachedSize = screen.getScreenSize();

  intervalId = setInterval(() => {
    const enabled = programStates.get("is_enabled");
    if (robloxStates.get("is_active") && !check && enabled) {
      if (!cachedPen && cachedSize) {
        cachedPen = overlay.createPen(
          { color: { r: 255, g: 0, b: 0 }, width: 1 },
          {
            x: cachedSize.width / 2,
            y: 150,
            width: 0,
            height: cachedSize.height / 2 - 200,
          },
        );
      }
      if (cachedPen && cachedSize) {
        cachedPen.drawLine(0, 0, 0, cachedSize.height / 2 - 200);
      }
      if (!hasLoggedShowing) {
        logger.info("showing");
        hasLoggedShowing = true;
      }
      check = true;
    } else if ((!robloxStates.get("is_active") && check) || !enabled) {
      overlay.destroy();
      cachedPen = undefined;
      if (hasLoggedShowing) {
        logger.info("hidden");
        hasLoggedShowing = false;
      }
      check = false;
    }
  }, 50);
}

export function stopOverlay(): void {
  if (intervalId !== undefined) {
    clearInterval(intervalId);
    intervalId = undefined;
  }
  overlay.clear();
  overlay.destroy();
  cachedPen = undefined;
  cachedSize = undefined;
}
