import { keyboard, mouse } from "winput";

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
  }
}
