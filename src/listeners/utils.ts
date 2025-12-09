import { getLock } from "./lock";

export async function waitFor(
  condition: () => boolean,
  abort?: () => boolean,
): Promise<void> {
  while (!condition()) {
    if (abort?.()) break;
    await Bun.sleep(1);
  }
}

export async function withLock<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const lock = getLock(name);
  return lock.withLock(fn);
}
