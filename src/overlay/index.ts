import { overlay } from "./overlay";
import { Pen } from "./pen";
import { screen } from "../screen";
import { robloxStates, programStates } from "@states";
import { Logger } from "@utils";
import { dirname, join } from "path";
import { mkdir } from "fs/promises";
import { CROSSHAIR_BASE64 } from "./crosshair-data";

const logger = new Logger(["Overlay", "cyan"]);

const CROSSHAIR_SCALE = 0.2;
const ORIGINAL_SIZE = 64;

let isShowing = false;
let intervalId: Timer | undefined;
let pen: ReturnType<typeof overlay.createPen> | undefined;
let crosshairImage: bigint | null = null;

let drawWidth = 0;
let drawHeight = 0;
let centerX = 0;
let centerY = 0;

function getAssetsDir(): string {
  const exeDir = dirname(process.execPath);
  return join(exeDir, "assets");
}

const CROSSHAIR_PATH = join(getAssetsDir(), "crosshair.png");

export async function extractCrosshair(): Promise<string> {
  const assetsDir = getAssetsDir();
  await mkdir(assetsDir, { recursive: true });

  const crosshairFile = Bun.file(CROSSHAIR_PATH);
  if (await crosshairFile.exists()) {
    return CROSSHAIR_PATH;
  }

  const binaryString = atob(CROSSHAIR_BASE64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  await Bun.write(CROSSHAIR_PATH, bytes);
  return CROSSHAIR_PATH;
}

export async function startOverlay(): Promise<void> {
  if (intervalId !== undefined) return;

  await extractCrosshair();

  const size = screen.getScreenSize();
  centerX = Math.floor(size.width / 2);
  centerY = Math.floor(size.height / 2) - 150;

  drawWidth = Math.floor(ORIGINAL_SIZE * CROSSHAIR_SCALE);
  drawHeight = Math.floor(ORIGINAL_SIZE * CROSSHAIR_SCALE);

  crosshairImage = Pen.loadImage(CROSSHAIR_PATH);

  if (crosshairImage) {
    logger.info(
      `loaded crosshair (scale: ${CROSSHAIR_SCALE}x, size: ${drawWidth}x${drawHeight})`,
    );
  } else {
    logger.warn(`failed to load crosshair from: ${CROSSHAIR_PATH}`);
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
