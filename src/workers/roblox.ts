declare var self: Worker;
let gamePort: MessagePort;
import "../global";
import { isRobloxActiveFullscreen } from "../utils";

const workerLog = new Logger(["WORKER", "magenta"], ["ROBLOX", "gray"]);

let active = false;

function update() {
   const { active: isActive, fullscreen } = isRobloxActiveFullscreen();
   const isNowActive = isActive && fullscreen;
   if (isNowActive !== active) {
      active = isNowActive;
      workerLog.info(`${isNowActive ? "active" : "inactive"}`);

      self.postMessage({ name: "is_active", value: isNowActive });
      gamePort.postMessage({ name: "is_active", value: isNowActive });
   }
}

function loop() {
   update();
   setTimeout(loop, 100);
}

function init() {
   loop();
   workerLog.info("running");
   self.postMessage({ ready: true });
}

self.onmessage = ({ data }) => {
   if (data instanceof MessagePort) {
      gamePort = data;
      init();
   }
};
