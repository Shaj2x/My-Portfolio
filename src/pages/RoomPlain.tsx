import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { createPlainRoom, type PlainRoomHandle, type PlainRoomView } from "@/components/room/createPlainRoom";

const chip =
  "pointer-events-auto rounded-full bg-black/40 px-4 py-2 text-sm text-white/85 backdrop-blur-md transition-colors hover:bg-black/60 hover:text-white aria-pressed:text-amber-200";

const VIEWS: [PlainRoomView, string][] = [
  ["photo", "Photo view"],
  ["desk", "Desk"],
  ["door", "Door & closet"],
  ["dollhouse", "Dollhouse"],
];

/** The plain 3D recreation of the real room, before the lighting and life of /room are layered on. */
const RoomPlain = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<PlainRoomHandle | null>(null);
  const [view, setView] = useState<PlainRoomView>("photo");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    try {
      roomRef.current = createPlainRoom(containerRef.current);
    } catch (e) {
      console.error("Failed to start the room:", e);
      setError(true);
    }
    return () => {
      roomRef.current?.dispose();
      roomRef.current = null;
    };
  }, []);

  const go = (v: PlainRoomView) => {
    setView(v);
    roomRef.current?.setView(v);
  };

  return (
    <main className="fixed inset-0 bg-[#0d0e11] text-white">
      <div ref={containerRef} className="absolute inset-0" />
      {error && <p className="absolute inset-0 grid place-items-center text-white/70">This browser can't show the 3D room.</p>}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <Link to="/" className={`${chip} inline-flex items-center gap-2`}>
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4 pb-6">
        <div className="flex flex-wrap justify-center gap-2">
          {VIEWS.map(([v, label]) => (
            <button key={v} type="button" className={chip} aria-pressed={view === v} onClick={() => go(v)}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-white/50">Drag to orbit · scroll to zoom · right-drag to pan</p>
      </div>
    </main>
  );
};

export default RoomPlain;
