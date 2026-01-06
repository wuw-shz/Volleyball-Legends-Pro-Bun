import { keyboard } from "@winput/keyboard";
import { mouse } from "@winput/mouse";
import type { Handler, HandlerAction } from "../listeners/types";

export function resumeListeners() {
  if (!mouse.listener.isRunning) {
    mouse.listener.start();
  }
  if (!keyboard.listener.isRunning) {
    keyboard.listener.start();
  }
}

export function pauseListeners() {
  if (mouse.listener.isRunning) {
    mouse.listener.stop();
  }
  if (keyboard.listener.isRunning) {
    keyboard.listener.stop();
    keyboard.releaseAll();
  }
}

export class AsyncLock {
  private locked = false;
  private queue: (() => void)[] = [];

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    } else {
      this.locked = false;
    }
  }

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  get isLocked(): boolean {
    return this.locked;
  }
}

const lockRegistry = new Map<string, AsyncLock>();

export function getLock(name: string): AsyncLock {
  let lock = lockRegistry.get(name);
  if (!lock) {
    lock = new AsyncLock();
    lockRegistry.set(name, lock);
  }
  return lock;
}

export async function waitFor(
  condition: () => boolean,
  abort?: () => boolean,
): Promise<boolean> {
  while (!condition()) {
    if (abort?.()) {
      return false;
    }
    await Bun.sleep(1);
  }
  return true;
}

export async function withLock<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const lock = getLock(name);
  return lock.withLock(fn);
}

export function createHandler(
  name: string,
  actions: { down?: HandlerAction; up?: HandlerAction },
): Handler {
  return {
    name,
    on: {
      down: actions.down
        ? async () => {
            await withLock(name, async () => {
              await actions.down?.();
            });
          }
        : undefined,
      up: actions.up
        ? async () => {
            await withLock(name, async () => {
              await actions.up?.();
            });
          }
        : undefined,
    },
  };
}
