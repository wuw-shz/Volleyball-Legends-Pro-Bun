import { overlay, Pen } from "@winput/overlay";
import { screen } from "@winput/screen";
import { robloxStates, programStates } from "@states";
import { Logger } from "@utils";
import { join } from "path";

const logger = new Logger(["Overlay", "cyan"]);

/**
 * Crosshair scale factor (1.0 = original size, 2.0 = double size, 0.5 = half size)
 */
const CROSSHAIR_SCALE = 0.5;

const ORIGINAL_SIZE = 26;

let isShowing = false;
let intervalId: Timer | undefined;
let pen: ReturnType<typeof overlay.createPen> | undefined;
let crosshairImage: bigint | null = null;

let drawWidth = 0;
let drawHeight = 0;
let centerX = 0;
let centerY = 0;

function getCrosshairPath(): string {
  return join(process.cwd(), "assets", "crosshair.png");
}

export function startOverlay(): void {
  if (intervalId !== undefined) return;

  const size = screen.getScreenSize();
  centerX = Math.floor(size.width / 2);
  centerY = Math.floor(size.height / 2) - 150;

  drawWidth = Math.floor(ORIGINAL_SIZE * CROSSHAIR_SCALE);
  drawHeight = Math.floor(ORIGINAL_SIZE * CROSSHAIR_SCALE);

  const imagePath = getCrosshairPath();
  crosshairImage = Pen.loadImage(imagePath);

  if (crosshairImage) {
    logger.info(
      `loaded crosshair (scale: ${CROSSHAIR_SCALE}x, size: ${drawWidth}x${drawHeight})`,
    );
  } else {
    logger.warn(`failed to load crosshair from: ${imagePath}`);
  }

  intervalId = setInterval(() => {
    const shouldShow =
      robloxStates.get("is_active") && programStates.get("is_enabled");

    if (shouldShow && !isShowing) {
      if (crosshairImage) {
        const halfW = Math.floor(drawWidth / 2);
        const halfH = Math.floor(drawHeight / 2);

        pen = overlay.createPen(
          { color: { r: 255, g: 255, b: 255 }, width: 1 },
          {
            x: centerX - halfW,
            y: centerY - halfH,
            width: drawWidth,
            height: drawHeight,
          },
        );

        pen.drawImage(crosshairImage, 0, 0, drawWidth, drawHeight);
      }

      logger.info("showing");
      isShowing = true;
    } else if (!shouldShow && isShowing) {
      overlay.destroy();
      pen = undefined;

      logger.info("hidden");
      isShowing = false;
    }
  }, 150);
}

export function stopOverlay(): void {
  if (intervalId !== undefined) {
    clearInterval(intervalId);
    intervalId = undefined;
  }
  overlay.clear();
  overlay.destroy();
  pen = undefined;
  isShowing = false;

  if (crosshairImage) {
    Pen.disposeImage(crosshairImage);
    crosshairImage = null;
  }
}
