import { gdi32 } from "./gdi32";
import { user32 } from "./user32";
import { ptr, type Pointer } from "bun:ffi";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

let cachedDC: Pointer | null = null;
let dcRefreshTime = 0;
const DC_REFRESH_INTERVAL = 1000;

function getDesktopDC(): Pointer | null {
  const now = Date.now();
  if (cachedDC && now - dcRefreshTime < DC_REFRESH_INTERVAL) {
    return cachedDC;
  }

  if (cachedDC) {
    user32.symbols.ReleaseDC(null, cachedDC);
  }

  cachedDC = user32.symbols.GetDC(null);
  dcRefreshTime = now;
  return cachedDC;
}

export function releaseDesktopDC(): void {
  if (cachedDC) {
    user32.symbols.ReleaseDC(null, cachedDC);
    cachedDC = null;
    dcRefreshTime = 0;
  }
}

export function colorrefToRGB(colorref: number): RGB {
  return {
    r: colorref & 0xff,
    g: (colorref >> 8) & 0xff,
    b: (colorref >> 16) & 0xff,
  };
}

export function getPixelRGB(point: [number, number]): RGB | null {
  const dc = getDesktopDC();
  if (!dc) return null;

  const colorref = gdi32.symbols.GetPixel(dc, point[0], point[1]);
  return colorrefToRGB(colorref);
}

export function getMultiplePixelRGB(
  points: [number, number][],
): (RGB | null)[] {
  const dc = getDesktopDC();
  if (!dc) return points.map(() => null);

  return points.map(([x, y]) =>
    colorrefToRGB(gdi32.symbols.GetPixel(dc, x, y)),
  );
}

export function checkPixelColor(
  point: [number, number],
  target: [number, number, number],
  tolerance = 0,
): boolean {
  const pixel = getPixelRGB(point);
  if (!pixel) return false;

  const rDiff = Math.abs(pixel.r - target[0]);
  const gDiff = Math.abs(pixel.g - target[1]);
  const bDiff = Math.abs(pixel.b - target[2]);

  return rDiff <= tolerance && gDiff <= tolerance && bDiff <= tolerance;
}

export interface PixelCheck {
  point: [number, number];
  target: [number, number, number];
  tolerance?: number;
}

export function checkMultiplePixels(checks: PixelCheck[]): boolean[] {
  const dc = getDesktopDC();
  if (!dc) return checks.map(() => false);

  return checks.map(({ point, target, tolerance = 0 }) => {
    const colorref = gdi32.symbols.GetPixel(dc, point[0], point[1]);
    const pixel = colorrefToRGB(colorref);

    const rDiff = Math.abs(pixel.r - target[0]);
    const gDiff = Math.abs(pixel.g - target[1]);
    const bDiff = Math.abs(pixel.b - target[2]);

    return rDiff <= tolerance && gDiff <= tolerance && bDiff <= tolerance;
  });
}
