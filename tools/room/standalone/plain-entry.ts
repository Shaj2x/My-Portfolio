import { createPlainRoom, type PlainRoomView } from "../../../src/components/room/createPlainRoom";

const room = createPlainRoom(document.getElementById("stage")!);
const buttons = document.querySelectorAll<HTMLButtonElement>("[data-view]");
for (const b of buttons)
  b.addEventListener("click", () => {
    room.setView(b.dataset.view as PlainRoomView);
    for (const o of buttons) o.setAttribute("aria-pressed", String(o === b));
  });
