export type GameStateShape = {
   is_on_ground: boolean;
   is_shift_lock: boolean;
   is_skill_ready: boolean;
   is_toss: boolean;
   is_bar_arrow: boolean;
   skill_toggle: boolean;
};
export const gameStates = createReactiveState<GameStateShape>({
   is_on_ground: false,
   is_shift_lock: false,
   is_skill_ready: false,
   is_toss: false,
   is_bar_arrow: false,
   skill_toggle: true,
});

export type RobloxStateShape = {
   is_active: boolean;
};
export const robloxStates = createReactiveState<RobloxStateShape>({
   is_active: false,
});

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
   initial: T
): ReactiveState<T> {
   const defaults = { ...initial };
   const state = { ...initial };
   const listeners: StateChangeCallback<T>[] = [];

   return {
      get<K extends keyof T>(key: K): T[K] {
         return state[key];
      },

      set<K extends keyof T>(key: K, value: T[K]): void {
         const prev = state[key];
         if (prev !== value) {
            state[key] = value;
            for (const cb of listeners) {
               cb(key, value, prev);
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
         for (const key of Object.keys(defaults) as (keyof T)[]) {
            const prev = state[key];
            state[key] = defaults[key];
            if (prev !== defaults[key]) {
               for (const cb of listeners) {
                  cb(key, defaults[key], prev);
               }
            }
         }
      },

      toObject(): T {
         return { ...state };
      },
   };
}
