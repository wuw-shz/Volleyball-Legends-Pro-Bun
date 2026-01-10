import { user32, gdi32, kernel32 } from "./ffi-loader";
import type { Pointer } from "bun:ffi";
import { ptr, JSCallback, FFIType, toArrayBuffer } from "bun:ffi";
import type { OverlayOptions } from "./types";

const SW_SHOW = 5;
const SW_HIDE = 0;
const ULW_ALPHA = 0x00000002;

const HWND_TOPMOST = -1n;
const HWND_TOP = 0n;
const SWP_NOACTIVATE = 0x0010;
const SWP_NOMOVE = 0x0002;
const SWP_NOSIZE = 0x0001;
const SWP_SHOWWINDOW = 0x0040;

const TOPMOST_ENFORCEMENT_INTERVAL = 100;

const STYLES = {
  WS_POPUP: 0x80000000,
  WS_VISIBLE: 0x10000000,
} as const;

const EX_STYLES = {
  WS_EX_LAYERED: 0x00080000,
  WS_EX_TOPMOST: 0x00000008,
  WS_EX_NOACTIVATE: 0x08000000,
  WS_EX_TOOLWINDOW: 0x00000080,
  WS_EX_TRANSPARENT: 0x00000020,
} as const;

type StyleKey = keyof typeof STYLES;
type ExStyleKey = keyof typeof EX_STYLES;

interface CreateWindowOptions {
  className?: string;
  styles?: StyleKey[];
  exStyles?: ExStyleKey[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

const wndProcs = new Set<JSCallback>();

function registerWindowClass(
  className: string,
  _backgroundBrush: number | bigint | null = null,
): number {
  const hInstance = kernel32.symbols.GetModuleHandleW(null);
  const classNameBuf = Buffer.from(className + "\0", "utf16le");

  const wndProc = new JSCallback(
    (hwnd, msg, wParam, lParam) => {
      return user32.symbols.DefWindowProcW(hwnd, msg, wParam, lParam);
    },
    {
      args: [FFIType.ptr, FFIType.u32, FFIType.ptr, FFIType.ptr],
      returns: FFIType.ptr,
    },
  );
  wndProcs.add(wndProc);

  const wndClass = new Uint8Array(80);
  const view = new DataView(wndClass.buffer);

  view.setUint32(0, 80, true);
  view.setUint32(4, 3, true);

  const procPtr = wndProc.ptr!;
  view.setBigUint64(8, BigInt(procPtr), true);

  view.setInt32(16, 0, true);
  view.setInt32(20, 0, true);

  view.setBigUint64(24, BigInt(hInstance), true);

  view.setBigUint64(32, 0n, true);

  const IDC_ARROW = 32512n;
  const hCursor = user32.symbols.LoadCursorW(0n, IDC_ARROW);
  view.setBigUint64(40, hCursor, true);
  view.setBigUint64(48, 0n, true);

  view.setBigUint64(56, 0n, true);
  const classPtr = ptr(classNameBuf);
  view.setBigUint64(64, BigInt(classPtr), true);

  view.setBigUint64(72, 0n, true);

  const atom = user32.symbols.RegisterClassExW(ptr(wndClass));
  return atom;
}

function createOverlayWindow(options: CreateWindowOptions = {}): bigint | null {
  const {
    className = "Static",
    styles = [],
    exStyles = [],
    x = 0,
    y = 0,
    width = 800,
    height = 600,
  } = options;

  const classNameBuf = Buffer.from(className + "\0", "utf16le");
  const windowNameBuf = Buffer.from("\0", "utf16le");

  const hwnd = user32.symbols.CreateWindowExW(
    exStyles.reduce((a, b) => a | EX_STYLES[b], 0),
    classNameBuf,
    windowNameBuf,
    styles.reduce((a, b) => a | STYLES[b], 0),
    x,
    y,
    width,
    height,
    null,
    null,
    null,
    null,
  );

  return hwnd ? (hwnd as unknown as bigint) : null;
}

function showWindow(hwnd: bigint): boolean {
  return user32.symbols.ShowWindow(hwnd, SW_SHOW);
}

function hideWindow(hwnd: bigint): boolean {
  return user32.symbols.ShowWindow(hwnd, SW_HIDE);
}

export class OverlayWindow {
  private hwnd: bigint | null = null;
  private hdc: Pointer | bigint | null = null;
  private memDC: bigint | null = null;
  private memBitmap: bigint | null = null;
  private oldBitmap: bigint | null = null;
  private bitmapBits: bigint | null = null;
  private bitmapSize: number = 0;
  private x: number = 0;
  private y: number = 0;
  private width: number = 0;
  private height: number = 0;
  private topmostTimer: ReturnType<typeof setInterval> | null = null;
  private lastForeground: bigint = 0n;

  constructor(private options: OverlayOptions = {}) {}

  create(): boolean {
    try {
      this.width = this.options.width ?? user32.symbols.GetSystemMetrics(0);
      this.height = this.options.height ?? user32.symbols.GetSystemMetrics(1);
      this.x = this.options.x ?? 0;
      this.y = this.options.y ?? 0;

      const className = "OverlayWindowClass";
      registerWindowClass(className, null);

      this.hwnd = createOverlayWindow({
        className: className,
        styles: ["WS_POPUP"],
        exStyles: [
          "WS_EX_LAYERED",
          "WS_EX_TOPMOST",
          "WS_EX_NOACTIVATE",
          "WS_EX_TOOLWINDOW",
          "WS_EX_TRANSPARENT",
        ],
        x: this.x,
        y: this.y,
        width: this.width,
        height: this.height,
      });

      if (!this.hwnd) {
        console.error("CreateWindowExW returned null - window creation failed");
        return false;
      }

      const GWL_STYLE = -16;
      const WS_BORDER = 0x00800000;
      const WS_CAPTION = 0x00c00000;
      const WS_THICKFRAME = 0x00040000;
      const WS_DLGFRAME = 0x00400000;

      const currentStyle = user32.symbols.GetWindowLongW(this.hwnd, GWL_STYLE);
      const newStyle =
        currentStyle & ~(WS_CAPTION | WS_BORDER | WS_THICKFRAME | WS_DLGFRAME);
      user32.symbols.SetWindowLongW(this.hwnd, GWL_STYLE, newStyle);

      const SWP_FRAMECHANGED = 0x0020;
      const SWP_NOMOVE = 0x0002;
      const SWP_NOSIZE = 0x0001;
      const SWP_NOZORDER = 0x0004;
      user32.symbols.SetWindowPos(
        this.hwnd,
        0n,
        0,
        0,
        0,
        0,
        SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER,
      );

      const screenDC = user32.symbols.GetDC(null);
      this.memDC = gdi32.symbols.CreateCompatibleDC(screenDC as bigint);

      const bmiHeader = new ArrayBuffer(40);
      const bmiView = new DataView(bmiHeader);
      bmiView.setUint32(0, 40, true);
      bmiView.setInt32(4, this.width, true);
      bmiView.setInt32(8, -this.height, true);
      bmiView.setUint16(12, 1, true);
      bmiView.setUint16(14, 32, true);
      bmiView.setUint32(16, 0, true);

      const ppvBits = new BigUint64Array(1);
      this.memBitmap = gdi32.symbols.CreateDIBSection(
        this.memDC,
        ptr(new Uint8Array(bmiHeader)),
        0,
        ptr(ppvBits),
        null,
        0,
      );

      if (this.memBitmap && ppvBits[0]) {
        this.bitmapBits = ppvBits[0];
        this.bitmapSize = this.width * this.height * 4;
        this.oldBitmap = gdi32.symbols.SelectObject(this.memDC, this.memBitmap);
      }

      user32.symbols.ReleaseDC(0n, screenDC as bigint);

      this.hdc = this.memDC;

      showWindow(this.hwnd);
      this.updateLayered();
      return true;
    } catch {
      this.destroy();
      return false;
    }
  }

  private updateLayered(): void {
    if (!this.hwnd || !this.memDC) return;

    const screenDC = user32.symbols.GetDC(null);

    const ptDst = new Int32Array([this.x, this.y]);
    const size = new Int32Array([this.width, this.height]);
    const ptSrc = new Int32Array([0, 0]);

    const blendFunc = new Uint8Array(4);
    blendFunc[0] = 0;
    blendFunc[1] = 0;
    blendFunc[2] = 255;
    blendFunc[3] = 1;

    user32.symbols.UpdateLayeredWindow(
      this.hwnd,
      screenDC as bigint,
      ptr(ptDst),
      ptr(size),
      this.memDC,
      ptr(ptSrc),
      0,
      ptr(blendFunc),
      ULW_ALPHA,
    );

    user32.symbols.ReleaseDC(0n, screenDC as bigint);
  }

  getHandle(): bigint | null {
    return this.hwnd;
  }

  getDC(): Pointer | bigint | null {
    if (!this.hwnd) {
      return null;
    }
    return this.hdc;
  }

  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  isValid(): boolean {
    return this.hwnd !== null && this.hdc !== null;
  }

  /**
   * Publicly exposed method to force the overlay to topmost.
   * Call when external state changes (e.g., game becomes active).
   */
  forceTopmost(): void {
    this.enforceTopmost();
    this.updateLayered();
  }

  update(): void {
    if (!this.hwnd) return;

    this.updateLayered();

    const MSG = new Uint8Array(48);
    while (user32.symbols.PeekMessageW(ptr(MSG), this.hwnd, 0, 0, 1)) {
      user32.symbols.TranslateMessage(ptr(MSG));
      user32.symbols.DispatchMessageW(ptr(MSG));
    }
  }

  clear(): void {
    if (!this.memDC || !this.bitmapBits || !this.bitmapSize) {
      return;
    }

    const buffer = toArrayBuffer(
      this.bitmapBits as unknown as Pointer,
      0,
      this.bitmapSize,
    );
    const pixels = new Uint32Array(buffer);
    pixels.fill(0);
  }

  show(): void {
    if (!this.hwnd) {
      return;
    }
    showWindow(this.hwnd);
    this.enforceTopmost();
    this.updateLayered();
    user32.symbols.UpdateWindow(this.hwnd);
    this.startTopmostEnforcement();
  }

  hide(): void {
    this.stopTopmostEnforcement();
    if (!this.hwnd) {
      return;
    }
    hideWindow(this.hwnd);
  }

  /**
   * Forces the overlay window to be topmost using SetWindowPos.
   * Called periodically to maintain topmost status even when
   * fullscreen games attempt to take exclusive foreground.
   */
  private enforceTopmost(): void {
    if (!this.hwnd) return;

    user32.symbols.SetWindowPos(
      this.hwnd,
      HWND_TOPMOST,
      0,
      0,
      0,
      0,
      SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
    );
  }

  /**
   * Starts periodic topmost enforcement to keep overlay above
   * fullscreen games that may try to take exclusive foreground.
   */
  private startTopmostEnforcement(): void {
    if (this.topmostTimer !== null) return;

    this.topmostTimer = setInterval(() => {
      if (!this.hwnd) return;

      const currentForeground = user32.symbols.GetForegroundWindow();

      if (currentForeground !== this.lastForeground) {
        this.lastForeground = currentForeground;
        this.enforceTopmost();
        this.updateLayered();
      }
    }, TOPMOST_ENFORCEMENT_INTERVAL);
  }

  /**
   * Stops the periodic topmost enforcement timer.
   */
  private stopTopmostEnforcement(): void {
    if (this.topmostTimer !== null) {
      clearInterval(this.topmostTimer);
      this.topmostTimer = null;
    }
  }

  destroy(): void {
    this.stopTopmostEnforcement();

    if (this.memDC) {
      if (this.oldBitmap) {
        gdi32.symbols.SelectObject(this.memDC, this.oldBitmap);
        this.oldBitmap = null;
      }
      if (this.memBitmap) {
        gdi32.symbols.DeleteObject(this.memBitmap);
        this.memBitmap = null;
      }
      gdi32.symbols.DeleteDC(this.memDC);
      this.memDC = null;
    }

    this.hdc = null;
    this.bitmapBits = null;

    if (this.hwnd) {
      hideWindow(this.hwnd);
      this.hwnd = null;
    }
  }
}
