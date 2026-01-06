import { mouse } from "@winput/mouse";
import { keyboard } from "@winput/keyboard";
import { robloxStates } from "@states";
import { Logger } from "@utils";
import type { Handler, InputType } from "./types";

const logger = new Logger(["Listener", "cyan"]);

export function createInputListener(
  inputType: InputType,
  handlers: Handler[],
): void {
  const handlerMap = new Map<string, Handler>();
  for (const handler of handlers) {
    handlerMap.set(handler.name, handler);
  }

  if (inputType === "keyboard") {
    keyboard.listener.on.down((ev) => {
      if (!robloxStates.get("is_active")) return;
      const handler = handlerMap.get(ev.key);
      handler?.on?.down?.();
    });

    keyboard.listener.on.up((ev) => {
      if (!robloxStates.get("is_active")) return;
      const handler = handlerMap.get(ev.key);
      handler?.on?.up?.();
    });
    logger.info("Keyboard listener started");
  } else {
    mouse.listener.on.down((ev) => {
      if (!robloxStates.get("is_active")) return;
      const handler = handlerMap.get(ev.button);
      handler?.on?.down?.();
    });

    mouse.listener.on.up((ev) => {
      if (!robloxStates.get("is_active")) return;
      const handler = handlerMap.get(ev.button);
      handler?.on?.up?.();
    });
    logger.info("Mouse listener started");
  }
}
