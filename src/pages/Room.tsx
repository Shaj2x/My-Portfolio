import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, DoorOpen, Lightbulb, LightbulbOff, Move3d } from "lucide-react";
import { createRoomScene, type RoomSceneHandle, type RoomView } from "@/components/room/createRoomScene";

const Room = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<RoomSceneHandle | null>(null);
  const [view, setView] = useState<RoomView>("doorway");
  const [error, setError] = useState(false);
  const [lampOn, setLampOn] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    try {
      sceneRef.current = createRoomScene(containerRef.current, { onLampChange: setLampOn });
    } catch (e) {
      console.error("Failed to start 3D room:", e);
      setError(true);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "l" && !e.metaKey && !e.ctrlKey && !e.altKey) sceneRef.current?.toggleLamp();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  const toggleView = () => {
    const next: RoomView = view === "doorway" ? "explore" : "doorway";
    setView(next);
    sceneRef.current?.setView(next);
  };

  return (
    <div className="fixed inset-0 bg-[#030407] text-white overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />

      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-white/70">
          Your browser couldn't start WebGL, so the 3D room can't be shown.
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 sm:p-6">
        <Link
          to="/"
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-black/40 px-4 py-2 text-sm text-white/80 backdrop-blur-md transition-colors hover:text-white"
        >
          <ArrowLeft size={16} /> Back
        </Link>
        <div className="text-right">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-amber-300/70">2:47 AM</p>
          <p className="text-sm text-white/50">still building.</p>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={toggleView}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-black/40 px-5 py-2.5 text-sm text-white/85 backdrop-blur-md transition-colors hover:bg-black/60 hover:text-white"
          >
            {view === "doorway" ? <Move3d size={16} /> : <DoorOpen size={16} />}
            {view === "doorway" ? "Step inside" : "Back to the doorway"}
          </button>
          <button
            onClick={() => sceneRef.current?.toggleLamp()}
            aria-pressed={lampOn}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-black/40 px-5 py-2.5 text-sm text-white/85 backdrop-blur-md transition-colors hover:bg-black/60 hover:text-white"
          >
            {lampOn ? <Lightbulb size={16} className="text-amber-300" /> : <LightbulbOff size={16} />}
            {lampOn ? "Lamp on" : "Lamp off"}
          </button>
        </div>
        <p className="text-xs text-white/40">
          {view === "doorway" ? "Move your cursor to lean in" : "Drag to look around · scroll to zoom"} · click the lamp or press L
        </p>
      </div>
    </div>
  );
};

export default Room;
