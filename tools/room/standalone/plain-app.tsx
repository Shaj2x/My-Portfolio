import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import RoomPlain from "../../../src/pages/RoomPlain";

// the real /room/plain page, for the hosted preview: frames from other sites are refused there
createRoot(document.getElementById("root")!).render(
  <MemoryRouter>
    <RoomPlain hosted />
  </MemoryRouter>,
);
