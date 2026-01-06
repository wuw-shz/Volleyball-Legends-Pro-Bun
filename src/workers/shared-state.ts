import {
  type GameStateShape,
  type RobloxStateShape,
  gameStates,
  robloxStates,
} from "@states";

type AllStateKeys = keyof RobloxStateShape | keyof GameStateShape;

export const STATE_KEYS = [
  ...Object.keys(robloxStates.toObject()),
  ...Object.keys(gameStates.toObject()),
] as AllStateKeys[];

const BIT_POSITIONS = Object.fromEntries(
  STATE_KEYS.map((key, index) => [key, index]),
) as Record<AllStateKeys, number>;

export type StateKey = AllStateKeys;

const NOTIFICATION_OFFSET = 0;
const STATE_BYTE_OFFSET = 4;
const BUFFER_SIZE = 8;

export function createSharedStateBuffer(): SharedArrayBuffer {
  const buffer = new SharedArrayBuffer(BUFFER_SIZE);
  const uint8View = new Uint8Array(buffer);
  uint8View[STATE_BYTE_OFFSET] = 1 << BIT_POSITIONS.skill_toggle;
  return buffer;
}

export interface StateAccessor {
  get(key: StateKey): boolean;
  set(key: StateKey, value: boolean): boolean;
  wait(timeout?: number): "ok" | "timed-out" | "not-equal";
  waitAsync(timeout?: number): Promise<"ok" | "timed-out" | "not-equal">;
  notify(count?: number): number;
}

export function createStateAccessor(buffer: SharedArrayBuffer): StateAccessor {
  const uint8View = new Uint8Array(buffer);
  const int32View = new Int32Array(buffer);
  let cachedFlags = uint8View[STATE_BYTE_OFFSET];

  return {
    get(key: StateKey): boolean {
      const currentFlags = Atomics.load(uint8View, STATE_BYTE_OFFSET);
      if (currentFlags !== cachedFlags) {
        cachedFlags = currentFlags;
      }
      const bitPos = BIT_POSITIONS[key];
      return (currentFlags & (1 << bitPos)) !== 0;
    },

    set(key: StateKey, value: boolean): boolean {
      const bitPos = BIT_POSITIONS[key];
      let oldFlags: number;
      let newFlags: number;

      do {
        oldFlags = Atomics.load(uint8View, STATE_BYTE_OFFSET);
        const currentBit = (oldFlags & (1 << bitPos)) !== 0;

        if (currentBit === value) {
          return false;
        }

        newFlags = value ? oldFlags | (1 << bitPos) : oldFlags & ~(1 << bitPos);

        const prev = Atomics.compareExchange(
          uint8View,
          STATE_BYTE_OFFSET,
          oldFlags,
          newFlags,
        );

        if (prev === oldFlags) break;
      } while (true);

      cachedFlags = newFlags;
      Atomics.add(int32View, NOTIFICATION_OFFSET / 4, 1);
      Atomics.notify(int32View, NOTIFICATION_OFFSET / 4);
      return true;
    },

    wait(timeout?: number): "ok" | "timed-out" | "not-equal" {
      const notifyValue = Atomics.load(int32View, NOTIFICATION_OFFSET / 4);
      const result = Atomics.wait(
        int32View,
        NOTIFICATION_OFFSET / 4,
        notifyValue,
        timeout,
      );
      cachedFlags = Atomics.load(uint8View, STATE_BYTE_OFFSET);
      return result;
    },

    waitAsync(timeout?: number): Promise<"ok" | "timed-out" | "not-equal"> {
      const notifyValue = Atomics.load(int32View, NOTIFICATION_OFFSET / 4);
      const result = Atomics.waitAsync(
        int32View,
        NOTIFICATION_OFFSET / 4,
        notifyValue,
        timeout,
      );

      if (result.async) {
        return result.value.then((res) => {
          cachedFlags = Atomics.load(uint8View, STATE_BYTE_OFFSET);
          return res;
        });
      }
      cachedFlags = Atomics.load(uint8View, STATE_BYTE_OFFSET);
      return Promise.resolve(result.value);
    },

    notify(count: number = 1): number {
      return Atomics.notify(int32View, NOTIFICATION_OFFSET / 4, count);
    },
  };
}
