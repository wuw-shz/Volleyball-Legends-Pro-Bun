import { getLock } from "./lock";

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
