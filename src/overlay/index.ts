import { overlay } from "@winput/overlay";
import { screen } from "@winput/screen";
import { robloxStates, programStates } from "@states";
import { Logger } from "@utils";

const logger = new Logger(["Overlay", "cyan"]);

let isShowing = false;
let intervalId: Timer | undefined;
let cachedPen: ReturnType<typeof overlay.createPen> | undefined;
let lineHeight = 0;
let centerX = 0;

export function startOverlay(): void {
  if (intervalId !== undefined) return;

  const size = screen.getScreenSize();
  centerX = size.width / 2;
  lineHeight = size.height / 2 - 200;

  intervalId = setInterval(() => {
    const shouldShow =
      robloxStates.get("is_active") && programStates.get("is_enabled");

    if (shouldShow && !isShowing) {
      cachedPen = overlay.createPen(
        { color: { r: 255, g: 0, b: 0 }, width: 1 },
        { x: centerX, y: 150, width: 0, height: lineHeight },
      );
      cachedPen.drawLine(0, 0, 0, lineHeight);
      logger.info("showing");
      isShowing = true;
    } else if (!shouldShow && isShowing) {
      overlay.destroy();
      cachedPen = undefined;
      logger.info("hidden");
      isShowing = false;
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
  isShowing = false;
}
