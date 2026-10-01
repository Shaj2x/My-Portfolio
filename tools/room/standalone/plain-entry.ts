import { createPlainRoom, type PlainRoomView } from "../../../src/components/room/createPlainRoom";

const lampBtn = document.getElementById("lamp") as HTMLButtonElement;
const room = createPlainRoom(document.getElementById("stage")!, {
  onLampChange: (on) => lampBtn.setAttribute("aria-pressed", String(on)),
});
const buttons = document.querySelectorAll<HTMLButtonElement>("[data-view]");
for (const b of buttons)
  b.addEventListener("click", () => {
    room.setView(b.dataset.view as PlainRoomView);
    for (const o of buttons) o.setAttribute("aria-pressed", String(o === b));
  });
lampBtn.addEventListener("click", () => room.toggleLamp());
window.addEventListener("keydown", (e) => {
  if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "l") room.toggleLamp();
});
