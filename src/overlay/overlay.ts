import type { PenOptions, OverlayOptions } from "./types";
import { OverlayWindow } from "./overlay-window";
import { Pen } from "./pen";

class Overlay {
  private window: OverlayWindow | null = null;
  private pens: Pen[] = [];
  private _isInitialized: boolean = false;

  private ensureInitialized(options?: OverlayOptions): boolean {
    if (this._isInitialized && this.window) {
      return true;
    }

    this.window = new OverlayWindow(options ?? {});
    const success = this.window.create();

    if (success) {
      this._isInitialized = true;
    }

    return success;
  }

  createPen(options: PenOptions, overlayOptions?: OverlayOptions): Pen {
    if (!this.ensureInitialized(overlayOptions)) {
      throw new Error("Failed to initialize overlay window");
    }

    const pen = new Pen(this.window!, options);
    this.pens.push(pen);
    return pen;
  }

  show(options?: OverlayOptions): void {
    if (!this.ensureInitialized(options)) {
      throw new Error("Failed to initialize overlay window");
    }
    this.window!.show();
  }

  hide(): void {
    if (this.window) {
      this.window.hide();
    }
  }

  clear(): void {
    if (this.window) {
      this.window.clear();
    }
  }

  update(): void {
    if (this.window) {
      this.window.update();
    }
  }

  forceTopmost(): void {
    if (this.window) {
      this.window.forceTopmost();
    }
  }

  destroy(): void {
    for (const pen of this.pens) {
      pen.destroy();
    }
    this.pens = [];

    if (this.window) {
      this.window.destroy();
      this.window = null;
    }

    this._isInitialized = false;
  }

  getWindow(): OverlayWindow | null {
    return this.window;
  }

  isInitialized(): boolean {
    return this._isInitialized;
  }
}

export const overlay = new Overlay();
