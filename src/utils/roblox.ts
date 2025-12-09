import { getForegroundWindowInfo } from "./window";

export interface RobloxWindowState {
  active: boolean;
  fullscreen: boolean;
}

export function isRobloxActiveFullscreen(): RobloxWindowState {
  const windowInfo = getForegroundWindowInfo();
  if (!windowInfo) return { active: false, fullscreen: false };
  return {
    active: windowInfo.title === "Roblox",
    fullscreen: windowInfo.isFullscreen,
  };
}

export function isRobloxForeground(): boolean {
  return isRobloxActiveFullscreen().active;
}

export function isRobloxFullscreen(): boolean {
  return isRobloxActiveFullscreen().fullscreen;
}
