import type { GameStateShape, RobloxStateShape } from "@states";

export interface GameWatchConfig {
  name: keyof GameStateShape;
  point: [number, number];
  target: [number, number, number];
  tolerance?: number;
  conditions?: {
    name: keyof GameStateShape;
    value: boolean;
  }[];
}

export const GAME_POLL_RATE = 12;

export interface RobloxWatchConfig {
  name: keyof RobloxStateShape;
  pollRate: number;
}

export const GAME_WATCHER_CONFIGS: GameWatchConfig[] = [
  {
    name: "is_on_ground",
    point: [942, 1003],
    target: [255, 225, 148],
    tolerance: 0,
  },
  {
    name: "is_shift_lock",
    point: [1807, 969],
    target: [47, 85, 104],
    tolerance: 0,
  },
  {
    name: "is_skill_ready",
    point: [1029, 903],
    target: [255, 255, 255],
    tolerance: 0,
  },
];

export const ROBLOX_WATCHER_CONFIGS: RobloxWatchConfig[] = [
  {
    name: "is_active",
    pollRate: 500,
  },
];
