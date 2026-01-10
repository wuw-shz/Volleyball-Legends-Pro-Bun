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
let isInitialized = false;
let pen: ReturnType<typeof overlay.createPen> | undefined;
let crosshairImage: bigint | null = null;
let unsubscribeRoblox: (() => void) | undefined;
let unsubscribeProgram: (() => void) | undefined;

const precomputed = {
  drawWidth: 0,
  drawHeight: 0,
  drawX: 0,
  drawY: 0,
};

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

function initializeOverlayResources(): boolean {
  if (isInitialized) return true;

  const size = screen.getScreenSize();
  const centerX = size.width >> 1;
  const centerY = (size.height >> 1) - 160;

  precomputed.drawWidth = (ORIGINAL_SIZE * CROSSHAIR_SCALE) | 0;
  precomputed.drawHeight = (ORIGINAL_SIZE * CROSSHAIR_SCALE) | 0;
  precomputed.drawX = centerX - (precomputed.drawWidth >> 1);
  precomputed.drawY = centerY - (precomputed.drawHeight >> 1);

  crosshairImage = Pen.loadImage(CROSSHAIR_PATH);

  if (!crosshairImage) {
    logger.warn(`failed to load crosshair from: ${CROSSHAIR_PATH}`);
    return false;
  }

  pen = overlay.createPen(
    { color: { r: 255, g: 255, b: 255 }, width: 1 },
    {
      x: precomputed.drawX,
      y: precomputed.drawY,
      width: precomputed.drawWidth,
      height: precomputed.drawHeight,
    },
  );

  pen.drawImage(
    crosshairImage,
    0,
    0,
    precomputed.drawWidth,
    precomputed.drawHeight,
  );

  logger.info(
    `loaded crosshair (scale: ${CROSSHAIR_SCALE}x, size: ${precomputed.drawWidth}x${precomputed.drawHeight})`,
  );

  isInitialized = true;
  return true;
}

function showOverlay(): void {
  if (isShowing) {
    overlay.forceTopmost();
    return;
  }

  if (!isInitialized && !initializeOverlayResources()) {
    return;
  }

  overlay.show();
  overlay.forceTopmost();
  logger.info("showing");
  isShowing = true;
}

function hideOverlay(): void {
  if (!isShowing) return;

  overlay.hide();
  logger.info("hidden");
  isShowing = false;
}

function updateOverlay(): void {
  const shouldShow =
    robloxStates.get("is_active") && programStates.get("is_enabled");

  if (shouldShow) {
    showOverlay();
  } else {
    hideOverlay();
  }
}

export async function startOverlay(): Promise<void> {
  if (unsubscribeRoblox !== undefined) return;

  await extractCrosshair();

  unsubscribeRoblox = robloxStates.onChange(updateOverlay);
  unsubscribeProgram = programStates.onChange(updateOverlay);

  updateOverlay();
}

export function stopOverlay(): void {
  unsubscribeRoblox?.();
  unsubscribeProgram?.();
  unsubscribeRoblox = undefined;
  unsubscribeProgram = undefined;

  if (pen) {
    pen.destroy();
    pen = undefined;
  }

  overlay.clear();
  overlay.destroy();
  isShowing = false;
  isInitialized = false;

  if (crosshairImage) {
    Pen.disposeImage(crosshairImage);
    crosshairImage = null;
  }
}
