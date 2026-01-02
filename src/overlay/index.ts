import { overlay, screen } from "winput";
import { robloxStates, programStates } from "../states";
import { LoggerClass } from "../utils/logger";

const logger = new LoggerClass(["Overlay", "cyan"]);

let check = false;
let intervalId: Timer | undefined;

export function startOverlay(): void {
  if (intervalId !== undefined) {
    return;
  }

  const size = screen.getScreenSize();

  intervalId = setInterval(() => {
    const enabled = programStates.get("is_enabled");
    if (robloxStates.get("is_active") && !check && enabled) {
      const pen = overlay.createPen(
        { color: { r: 255, g: 0, b: 0 }, width: 1 },
        { x: size.width / 2, y: 150, width: 0, height: size.height / 2 - 200 },
      );
      pen.drawLine(0, 0, 0, size.height / 2 - 200);
      logger.info("showing");
      check = true;
    } else if ((!robloxStates.get("is_active") && check) || !enabled) {
      overlay.destroy();
      logger.info("hidden");
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
}
