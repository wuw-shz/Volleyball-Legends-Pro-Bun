export type GameStateShape = {
  is_on_ground: boolean;
  is_shift_lock: boolean;
  is_skill_ready: boolean;
  skill_toggle: boolean;
};

export type RobloxStateShape = {
  is_active: boolean;
};

export type ProgramShape = {
  is_enabled: boolean;
};

export interface StateChangeCallback<T> {
  (name: keyof T, value: T[keyof T], prev: T[keyof T]): void;
}

export interface ReactiveState<T extends object> {
  get<K extends keyof T>(key: K): T[K];
  set<K extends keyof T>(key: K, value: T[K]): void;
  onChange(cb: StateChangeCallback<T>): () => void;
  reset(): void;
  toObject(): T;
}

export function createReactiveState<T extends object>(
  initial: T,
): ReactiveState<T> {
  const defaults = { ...initial };
  const state = { ...initial };
  const listeners: StateChangeCallback<T>[] = [];
  const keys = Object.keys(defaults) as (keyof T)[];
  const keyCount = keys.length;

  return {
    get<K extends keyof T>(key: K): T[K] {
      return state[key];
    },

    set<K extends keyof T>(key: K, value: T[K]): void {
      const prev = state[key];
      if (prev !== value) {
        state[key] = value;
        const len = listeners.length;
        for (let i = 0; i < len; i++) {
          listeners[i](key, value, prev);
        }
      }
    },

    onChange(cb: StateChangeCallback<T>): () => void {
      listeners.push(cb);
      return () => {
        const idx = listeners.indexOf(cb);
        if (idx !== -1) listeners.splice(idx, 1);
      };
    },

    reset(): void {
      for (let i = 0; i < keyCount; i++) {
        const key = keys[i];
        const prev = state[key];
        const def = defaults[key];
        if (prev !== def) {
          state[key] = def;
          const len = listeners.length;
          for (let j = 0; j < len; j++) {
            listeners[j](key, def, prev);
          }
        }
      }
    },

    toObject(): T {
      return { ...state };
    },
  };
}

export const gameStates = createReactiveState<GameStateShape>({
  is_on_ground: false,
  is_shift_lock: false,
  is_skill_ready: false,
  skill_toggle: true,
});

export const robloxStates = createReactiveState<RobloxStateShape>({
  is_active: false,
});

export const programStates = createReactiveState<ProgramShape>({
  is_enabled: true,
});
