import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, DoorOpen, Lightbulb, LightbulbOff, Move3d, SlidersHorizontal, Telescope, X } from "lucide-react";
import {
  createRoomScene,
  LIGHTING_PRESETS,
  type LightingSettings,
  type RoomSceneHandle,
  type RoomView,
} from "@/components/room/createRoomScene";
import { LightingPanel } from "@/components/room/LightingPanel";

type RoomCameraView = Exclude<RoomView, "telescope">;

const chip =
  "pointer-events-auto inline-flex items-center gap-2 rounded-full bg-black/40 px-5 py-2.5 text-sm text-white/85 backdrop-blur-md transition-colors hover:bg-black/60 hover:text-white";

const HINTS: Record<RoomView, string> = {
  doorway: "Move your cursor to lean in · click the light switch, the lamp (L), the telescope (T), or the cat",
  explore: "Drag to look around · scroll to zoom · click the light switch, the lamp (L), the telescope (T), or the cat",
  telescope: "Drag to aim · scroll to zoom · Esc to step back",
};

const Room = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<RoomSceneHandle | null>(null);
  const [view, setView] = useState<RoomView>("doorway");
  // where to return to when leaving the telescope
  const roomViewRef = useRef<RoomCameraView>("doorway");
  const viewRef = useRef<RoomView>("doorway");
  const [error, setError] = useState(false);
  const [lampOn, setLampOn] = useState(true);
  const [target, setTarget] = useState<{ name: string; detail: string } | null>(null);
  const [clock, setClock] = useState("2:47 AM");
  const [lighting, setLighting] = useState<LightingSettings>(LIGHTING_PRESETS["Late night"]);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelOpenRef = useRef(false);
  panelOpenRef.current = panelOpen;

  useEffect(() => {
    if (!containerRef.current) return;
    const onViewChange = (v: RoomView) => {
      viewRef.current = v;
      if (v !== "telescope") roomViewRef.current = v;
      setView(v);
    };
    try {
      sceneRef.current = createRoomScene(containerRef.current, {
        onLampChange: setLampOn,
        onViewChange,
        onScopeTarget: setTarget,
        onClockChange: setClock,
        onLightingChange: setLighting,
        onLightSwitch: () => setPanelOpen(true),
      });
    } catch (e) {
      console.error("Failed to start 3D room:", e);
      setError(true);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "l") sceneRef.current?.toggleLamp();
      else if (key === "t") sceneRef.current?.setView(viewRef.current === "telescope" ? roomViewRef.current : "telescope");
      else if (key === "escape" && panelOpenRef.current) setPanelOpen(false);
      else if (key === "escape" && viewRef.current === "telescope") sceneRef.current?.setView(roomViewRef.current);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  const inScope = view === "telescope";

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
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-amber-300/70">{clock}</p>
          <p className="text-sm text-white/50">{inScope ? "Western University, London ON" : "still building."}</p>
        </div>
      </div>

      {inScope && (
        <div className="pointer-events-none absolute inset-x-0 top-[12%] flex justify-center px-4">
          <div
            className={`text-center transition-opacity duration-500 ${target ? "opacity-100" : "opacity-0"}`}
            aria-live="polite"
          >
            <p className="font-serif text-xl tracking-wide text-white/90 sm:text-2xl">{target?.name ?? " "}</p>
            <p className="mt-1 text-xs text-purple-200/70 sm:text-sm">{target?.detail ?? " "}</p>
          </div>
        </div>
      )}

      {panelOpen && !inScope && (
        <div className="pointer-events-none absolute inset-x-4 bottom-[15.5rem] top-20 flex items-end justify-center sm:inset-x-auto sm:bottom-36 sm:right-6 sm:items-start">
          <LightingPanel
            settings={lighting}
            onChange={(next) => sceneRef.current?.setLighting(next)}
            onClose={() => setPanelOpen(false)}
          />
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {inScope ? (
            <button onClick={() => sceneRef.current?.setView(roomViewRef.current)} className={chip}>
              <X size={16} /> Step back from the telescope
            </button>
          ) : (
            <>
              <button onClick={() => sceneRef.current?.setView(view === "doorway" ? "explore" : "doorway")} className={chip}>
                {view === "doorway" ? <Move3d size={16} /> : <DoorOpen size={16} />}
                {view === "doorway" ? "Step inside" : "Back to the doorway"}
              </button>
              <button onClick={() => sceneRef.current?.setView("telescope")} className={chip}>
                <Telescope size={16} /> Look through the telescope
              </button>
              <button onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelOpen} className={chip}>
                <SlidersHorizontal size={16} className={panelOpen ? "text-amber-300" : undefined} /> Lighting
              </button>
              <button onClick={() => sceneRef.current?.toggleLamp()} aria-pressed={lampOn} className={chip}>
                {lampOn ? <Lightbulb size={16} className="text-amber-300" /> : <LightbulbOff size={16} />}
                {lampOn ? "Lamp on" : "Lamp off"}
              </button>
            </>
          )}
        </div>
        <p className="text-center text-xs text-white/40">{HINTS[view]}</p>
      </div>
    </div>
  );
};

export default Room;
