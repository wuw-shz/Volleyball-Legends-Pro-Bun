import { user32 } from "./user32";
import { ptr } from "bun:ffi";

export interface WindowInfo {
   hwnd: number;
   title: string;
   rect: { left: number; top: number; right: number; bottom: number };
   isFullscreen: boolean;
}

const textDecoder = new TextDecoder("utf-16le");
const titleBuffer = new Uint16Array(256);
const rectBuffer = new Int32Array(4);

export function isWindowFullscreen(
   hwnd: number,
   rect: { left: number; top: number; right: number; bottom: number }
): boolean {
   const SM_CXSCREEN = 0;
   const SM_CYSCREEN = 1;

   const screenWidth = user32.symbols.GetSystemMetrics(SM_CXSCREEN);
   const screenHeight = user32.symbols.GetSystemMetrics(SM_CYSCREEN);

   const windowWidth = rect.right - rect.left;
   const windowHeight = rect.bottom - rect.top;

   const coversScreen =
      rect.left === 0 &&
      rect.top === 0 &&
      windowWidth === screenWidth &&
      windowHeight === screenHeight;

   const GWL_STYLE = -16;
   const WS_CAPTION = 0x00c00000;
   const WS_THICKFRAME = 0x00040000;

   const style = user32.symbols.GetWindowLongW(hwnd, GWL_STYLE);
   const hasBorder =
      (style & WS_CAPTION) !== 0 || (style & WS_THICKFRAME) !== 0;

   return coversScreen && !hasBorder;
}

export function getForegroundWindowInfo(): WindowInfo | null {
   const hwnd = user32.symbols.GetForegroundWindow();
   if (!hwnd) return null;

   const length = user32.symbols.GetWindowTextW(hwnd, ptr(titleBuffer), 256);

   let title = "";
   if (length > 0) {
      title = textDecoder.decode(titleBuffer.subarray(0, length));
   }

   const success = user32.symbols.GetWindowRect(hwnd, ptr(rectBuffer));

   if (!success) return null;

   const rect = {
      left: rectBuffer[0],
      top: rectBuffer[1],
      right: rectBuffer[2],
      bottom: rectBuffer[3],
   };

   const isFullscreen = isWindowFullscreen(Number(hwnd), rect);

   return {
      hwnd: Number(hwnd),
      title,
      rect,
      isFullscreen,
   };
}

export function getForegroundWindowRect(): {
   hwnd: number;
   rect: { left: number; top: number; right: number; bottom: number };
} | null {
   const hwnd = user32.symbols.GetForegroundWindow();
   if (!hwnd) return null;

   const rectBuffer = new Int32Array(4);
   const success = user32.symbols.GetWindowRect(hwnd, ptr(rectBuffer));

   if (!success) return null;

   return {
      hwnd: Number(hwnd),
      rect: {
         left: rectBuffer[0],
         top: rectBuffer[1],
         right: rectBuffer[2],
         bottom: rectBuffer[3],
      },
   };
}
