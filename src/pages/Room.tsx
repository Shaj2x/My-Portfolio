import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, DoorOpen, Lightbulb, LightbulbOff, Move3d, Radio, SlidersHorizontal, Telescope, Volume2, VolumeX, X } from "lucide-react";
import {
  createRoomScene,
  LIGHTING_PRESETS,
  type Conditions,
  type LightingSettings,
  type RoomSceneHandle,
  type RoomView,
} from "@/components/room/createRoomScene";
import { LightingPanel } from "@/components/room/LightingPanel";
import { RADIO_STATION } from "@/components/room/createAudio";
import { loadMemory, recordVisit, saveMemory } from "@/components/room/roomMemory";

// read once per page load (React may mount twice in development)
let visitNote: string | null | undefined;
const welcomeNote = () => (visitNote === undefined ? (visitNote = recordVisit()) : visitNote);

type RoomCameraView = Exclude<RoomView, "telescope">;

const chip =
  "pointer-events-auto inline-flex items-center gap-2 rounded-full bg-black/40 px-5 py-2.5 text-sm text-white/85 backdrop-blur-md transition-colors hover:bg-black/60 hover:text-white";

const HINTS: Record<RoomView, string> = {
  doorway: "Move your cursor to lean in · click the light switch, the radio, the lamp (L), the telescope (T), or the cat",
  explore: "Drag to look around · scroll to zoom · click the light switch, the radio, the lamp (L), the telescope (T), or the cat",
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
  const [memory] = useState(loadMemory);
  const [lighting, setLighting] = useState<LightingSettings>(memory.lighting ?? LIGHTING_PRESETS["Late night"]);
  const [conditions, setConditions] = useState<Conditions>({ weather: memory.weather ?? "rain", timeMode: memory.timeMode ?? "auto" });
  const [muted, setMuted] = useState(memory.muted ?? false);
  const [radioOn, setRadioOn] = useState(false);
  const [note, setNote] = useState<string | null>(null);
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
        initial: { lighting: memory.lighting, weather: memory.weather, timeMode: memory.timeMode, muted: memory.muted },
        onConditionsChange: setConditions,
        onRadioChange: setRadioOn,
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
      else if (key === "m") setMuted((m) => !m);
      else if (key === "escape" && panelOpenRef.current) setPanelOpen(false);
      else if (key === "escape" && viewRef.current === "telescope") sceneRef.current?.setView(roomViewRef.current);
    };
    window.addEventListener("keydown", onKey);
    // a welcome-back note for returning visitors, shortly after the room fades in
    const msg = welcomeNote();
    const showNote = msg ? window.setTimeout(() => setNote(msg), 1800) : undefined;
    return () => {
      window.clearTimeout(showNote);
      window.removeEventListener("keydown", onKey);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // memory is only read on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the note stays up for a while once it's actually on screen (not counted from page load,
  // which on a slow device could hide it before it's ever seen)
  useEffect(() => {
    if (!note) return;
    const id = window.setTimeout(() => setNote(null), 10000);
    return () => window.clearTimeout(id);
  }, [note]);

  // remember the visitor's room for next time
  useEffect(() => saveMemory({ lighting }), [lighting]);
  useEffect(() => saveMemory({ weather: conditions.weather, timeMode: conditions.timeMode }), [conditions]);
  useEffect(() => {
    saveMemory({ muted });
    sceneRef.current?.setMuted(muted);
  }, [muted]);

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
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-black/40 px-4 py-2 text-sm text-white/80 backdrop-blur-md transition-colors hover:text-white"
          >
            <ArrowLeft size={16} /> Back
          </Link>
          <button
            onClick={() => setMuted((m) => !m)}
            aria-pressed={!muted}
            aria-label={muted ? "Turn sound on" : "Mute sound"}
            title={muted ? "Sound off (M)" : "Sound on (M)"}
            className="pointer-events-auto rounded-full bg-black/40 p-2.5 text-white/80 backdrop-blur-md transition-colors hover:text-white"
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-amber-300/70">{clock}</p>
          <p className="text-sm text-white/50">{inScope ? "Western University, London ON" : "still building."}</p>
          {radioOn && (
            <button
              onClick={() => sceneRef.current?.toggleRadio()}
              className="pointer-events-auto mt-2 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-xs text-amber-100/80 backdrop-blur-md hover:text-white"
              title="Turn the radio off"
            >
              <Radio size={12} className="animate-pulse text-amber-300" />
              <span>{RADIO_STATION.name}</span>
              <span className="hidden text-white/50 sm:inline">· {RADIO_STATION.show}</span>
            </button>
          )}
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

      {note && (
        // centring, tilt and entrance animation live on separate elements so their transforms don't fight
        <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-center px-4">
          <div className="rotate-[-1.5deg]">
            <button
              onClick={() => setNote(null)}
              className="pointer-events-auto block w-[min(88vw,300px)] animate-in fade-in slide-in-from-top-2 rounded-sm bg-[#f6e7b0] px-5 py-4 text-left text-[#3a2e12] shadow-[0_12px_30px_rgba(0,0,0,0.45)] duration-700"
              aria-live="polite"
              title="Dismiss"
            >
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-[#8a6a1c]">A note on the door</span>
              <span className="font-serif text-base italic leading-snug">{note}</span>
            </button>
          </div>
        </div>
      )}

      {panelOpen && !inScope && (
        <div className="pointer-events-none absolute inset-x-4 bottom-[18rem] top-20 flex items-end justify-center sm:inset-x-auto sm:bottom-36 sm:right-6 sm:items-start">
          <LightingPanel
            settings={lighting}
            onChange={(next) => sceneRef.current?.setLighting(next)}
            conditions={conditions}
            onConditions={(next) => {
              if (next.weather) sceneRef.current?.setWeather(next.weather);
              if (next.timeMode) sceneRef.current?.setTimeMode(next.timeMode);
            }}
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
                <SlidersHorizontal size={16} className={panelOpen ? "text-amber-300" : undefined} /> Lighting &amp; weather
              </button>
              <button onClick={() => sceneRef.current?.toggleRadio()} aria-pressed={radioOn} className={chip}>
                <Radio size={16} className={radioOn ? "text-amber-300" : undefined} /> {radioOn ? "Radio on" : "Radio"}
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
