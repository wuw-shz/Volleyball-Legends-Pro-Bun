import {
  GameStateShape,
  RobloxStateShape,
  gameStates,
  robloxStates,
} from "../states";

type AllStateKeys = keyof RobloxStateShape | keyof GameStateShape;

/**
 * Bit positions for packed boolean flags.
 * All 8 states fit in a single byte.
 */
const BIT_POSITIONS: Record<AllStateKeys, number> = {
  is_active: 0,
  is_on_ground: 1,
  is_on_air: 2,
  is_shift_lock: 3,
  is_skill_ready: 4,
  is_toss: 5,
  is_bar_arrow: 6,
  skill_toggle: 7,
};

export type StateKey = AllStateKeys;

/**
 * SharedArrayBuffer layout (24 bytes total):
 * - Bytes 0-3: Notification counter (Int32, for Atomics.wait/notify)
 * - Byte 4: Packed boolean flags (8 bits)
 * - Bytes 8-11: Total reads counter (Int32)
 * - Bytes 12-15: Total writes counter (Int32)
 * - Bytes 16-19: Cache hits counter (Int32)
 * - Bytes 20-23: Notifications sent counter (Int32)
 */
const NOTIFICATION_OFFSET = 0; // Int32 at byte 0
const STATE_BYTE_OFFSET = 4; // Single byte at offset 4
const METRICS_READ_OFFSET = 8;
const METRICS_WRITE_OFFSET = 12;
const METRICS_CACHE_HIT_OFFSET = 16;
const METRICS_NOTIFY_OFFSET = 20;
const BUFFER_SIZE = 24;

export function createSharedStateBuffer(): SharedArrayBuffer {
  const buffer = new SharedArrayBuffer(BUFFER_SIZE);
  const uint8View = new Uint8Array(buffer);

  // Initialize skill_toggle to true (bit 7 = 1)
  uint8View[STATE_BYTE_OFFSET] = 1 << BIT_POSITIONS.skill_toggle;

  return buffer;
}

export interface PerformanceMetrics {
  totalReads: number;
  totalWrites: number;
  cacheHits: number;
  notificationsSent: number;
  hitRate: number;
}

export interface StateAccessor {
  get(key: StateKey): boolean;
  set(key: StateKey, value: boolean): boolean;
  compareAndSet(key: StateKey, expected: boolean, value: boolean): boolean;
  /**
   * Wait for state change notification.
   * @param timeout Optional timeout in milliseconds. Omit to wait indefinitely.
   * @returns "ok" if notified, "timed-out" if timeout reached, "not-equal" if value changed
   */
  wait(timeout?: number): "ok" | "timed-out" | "not-equal";
  /**
   * Wait asynchronously for state change notification (main thread only).
   * @param timeout Optional timeout in milliseconds.
   * @returns Promise resolving to wait result
   */
  waitAsync(timeout?: number): Promise<"ok" | "timed-out" | "not-equal">;
  /**
   * Notify waiting threads of state change.
   * @returns Number of threads woken
   */
  notify(count?: number): number;
  /**
   * Get performance metrics.
   */
  getMetrics(): PerformanceMetrics;
}

export function createStateAccessor(buffer: SharedArrayBuffer): StateAccessor {
  const uint8View = new Uint8Array(buffer);
  const int32View = new Int32Array(buffer);

  let cachedFlags = uint8View[STATE_BYTE_OFFSET];

  return {
    get(key: StateKey): boolean {
      // Increment read counter
      Atomics.add(int32View, METRICS_READ_OFFSET / 4, 1);

      const currentFlags = Atomics.load(uint8View, STATE_BYTE_OFFSET);

      // Check cache hit
      if (currentFlags === cachedFlags) {
        Atomics.add(int32View, METRICS_CACHE_HIT_OFFSET / 4, 1);
      } else {
        cachedFlags = currentFlags;
      }

      const bitPos = BIT_POSITIONS[key];
      return (currentFlags & (1 << bitPos)) !== 0;
    },

    set(key: StateKey, value: boolean): boolean {
      const bitPos = BIT_POSITIONS[key];
      let oldFlags: number;
      let newFlags: number;
      let changed = false;

      // Atomic read-modify-write loop
      do {
        oldFlags = Atomics.load(uint8View, STATE_BYTE_OFFSET);
        const currentBit = (oldFlags & (1 << bitPos)) !== 0;

        if (currentBit === value) {
          // No change needed
          return false;
        }

        if (value) {
          newFlags = oldFlags | (1 << bitPos);
        } else {
          newFlags = oldFlags & ~(1 << bitPos);
        }

        const prev = Atomics.compareExchange(
          uint8View,
          STATE_BYTE_OFFSET,
          oldFlags,
          newFlags,
        );

        changed = prev === oldFlags;
      } while (!changed);

      // Update cache
      cachedFlags = newFlags;

      // Increment write counter
      Atomics.add(int32View, METRICS_WRITE_OFFSET / 4, 1);

      // Increment notification counter and notify waiters
      Atomics.add(int32View, NOTIFICATION_OFFSET / 4, 1);
      const woken = Atomics.notify(int32View, NOTIFICATION_OFFSET / 4);

      // Increment notifications sent counter
      if (woken > 0) {
        Atomics.add(int32View, METRICS_NOTIFY_OFFSET / 4, woken);
      }

      return true;
    },

    compareAndSet(key: StateKey, expected: boolean, value: boolean): boolean {
      const bitPos = BIT_POSITIONS[key];
      let oldFlags: number;
      let success = false;

      do {
        oldFlags = Atomics.load(uint8View, STATE_BYTE_OFFSET);
        const currentBit = (oldFlags & (1 << bitPos)) !== 0;

        if (currentBit !== expected) {
          return false;
        }

        let newFlags: number;
        if (value) {
          newFlags = oldFlags | (1 << bitPos);
        } else {
          newFlags = oldFlags & ~(1 << bitPos);
        }

        const prev = Atomics.compareExchange(
          uint8View,
          STATE_BYTE_OFFSET,
          oldFlags,
          newFlags,
        );

        success = prev === oldFlags;
      } while (!success);

      // Update cache
      cachedFlags = Atomics.load(uint8View, STATE_BYTE_OFFSET);

      // Increment write counter
      Atomics.add(int32View, METRICS_WRITE_OFFSET / 4, 1);

      // Notify waiters
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

      // Update cache after wake
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
          // Update cache after wake
          cachedFlags = Atomics.load(uint8View, STATE_BYTE_OFFSET);
          return res;
        });
      } else {
        // Synchronous result (already changed)
        cachedFlags = Atomics.load(uint8View, STATE_BYTE_OFFSET);
        return Promise.resolve(result.value);
      }
    },

    notify(count: number = 1): number {
      return Atomics.notify(int32View, NOTIFICATION_OFFSET / 4, count);
    },

    getMetrics(): PerformanceMetrics {
      const totalReads = Atomics.load(int32View, METRICS_READ_OFFSET / 4);
      const totalWrites = Atomics.load(int32View, METRICS_WRITE_OFFSET / 4);
      const cacheHits = Atomics.load(int32View, METRICS_CACHE_HIT_OFFSET / 4);
      const notificationsSent = Atomics.load(
        int32View,
        METRICS_NOTIFY_OFFSET / 4,
      );

      const hitRate = totalReads > 0 ? cacheHits / totalReads : 0;

      return {
        totalReads,
        totalWrites,
        cacheHits,
        notificationsSent,
        hitRate,
      };
    },
  };
}
