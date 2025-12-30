import { overlay, window, screen } from "winput";
import { programStates } from "../states";

function checkRoblox() {
  const active = window.getActiveWindow();
  return active?.title == "Roblox" && active?.isFullscreen;
}

process.on("SIGINT", () => {
  overlay.clear();
  overlay.destroy();
  process.exit(0);
});

let check = false;

const size = screen.getScreenSize();

setInterval(() => {
  const enabled = programStates.get("is_enabled");
  if (checkRoblox() && !check && enabled) {
    const pen = overlay.createPen(
      { color: { r: 255, g: 0, b: 0 }, width: 1 },
      { x: size.width / 2, y: 150, width: 0, height: size.height / 2 - 200 },
    );
    pen.drawLine(0, 0, 0, size.height / 2 - 200);
    console.log("Roblox is active");
    check = true;
  } else if ((!checkRoblox() && check) || !enabled) {
    overlay.destroy();
    console.log("Roblox is not active");
    check = false;
  }
}, 50);
