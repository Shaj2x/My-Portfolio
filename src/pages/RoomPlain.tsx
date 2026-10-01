import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Binoculars, Lightbulb, LightbulbOff, SlidersHorizontal, X } from "lucide-react";
import {
  createPlainRoom,
  DESK_TONES,
  LAMP_COLORS,
  LAMP_DEFAULT,
  SUNSET_STYLES,
  type LampSettings,
  type PlainRoomHandle,
  type PlainRoomView,
} from "@/components/room/createPlainRoom";

const chip =
  "pointer-events-auto inline-flex items-center gap-2 rounded-full bg-black/40 px-4 py-2 text-sm text-white/85 backdrop-blur-md transition-colors hover:bg-black/60 hover:text-white aria-pressed:text-amber-200";

const VIEWS: [Exclude<PlainRoomView, "binoculars">, string][] = [
  ["photo", "Photo view"],
  ["window", "Window"],
  ["desk", "Desk"],
  ["door", "Door & closet"],
  ["dollhouse", "Dollhouse"],
];

// the lamp's settings are remembered in this browser only; storage can be unavailable, so it's optional
const LAMP_KEY = "portfolio-room-plain:lamp";
const loadLamp = (): LampSettings => {
  try {
    return { ...LAMP_DEFAULT, ...JSON.parse(localStorage.getItem(LAMP_KEY) ?? "{}") };
  } catch {
    return LAMP_DEFAULT;
  }
};
const saveLamp = (s: LampSettings) => {
  try {
    localStorage.setItem(LAMP_KEY, JSON.stringify(s));
  } catch {
    // not remembered; fine
  }
};

/** The plain 3D recreation of the real room, before the lighting and life of /room are layered on. */
const RoomPlain = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<PlainRoomHandle | null>(null);
  const [view, setView] = useState<PlainRoomView>("photo");
  const viewRef = useRef<PlainRoomView>("photo");
  const lastRoomView = useRef<Exclude<PlainRoomView, "binoculars">>("photo");
  const [error, setError] = useState(false);
  const [lamp, setLamp] = useState<LampSettings>(loadLamp);
  const [panelOpen, setPanelOpen] = useState(false);
  const [target, setTarget] = useState<{ name: string; detail: string } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    try {
      roomRef.current = createPlainRoom(containerRef.current, {
        initialLamp: loadLamp(),
        onLampChange: (s) => {
          setLamp(s);
          saveLamp(s);
        },
        onViewChange: (v) => {
          viewRef.current = v;
          if (v !== "binoculars") lastRoomView.current = v;
          setView(v);
        },
        onScopeTarget: setTarget,
      });
    } catch (e) {
      console.error("Failed to start the room:", e);
      setError(true);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "l") roomRef.current?.toggleLamp();
      else if (key === "b") roomRef.current?.setView(viewRef.current === "binoculars" ? lastRoomView.current : "binoculars");
      else if (key === "escape") {
        if (viewRef.current === "binoculars") roomRef.current?.setView(lastRoomView.current);
        else setPanelOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      roomRef.current?.dispose();
      roomRef.current = null;
    };
  }, []);

  const inBinoculars = view === "binoculars";

  return (
    <main className="fixed inset-0 bg-[#0d0e11] text-white">
      <div ref={containerRef} className="absolute inset-0" />
      {error && <p className="absolute inset-0 grid place-items-center text-white/70">This browser can't show the 3D room.</p>}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4">
        <Link to="/" className={chip}>
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        {inBinoculars && (
          <div className="min-w-0 text-right" aria-live="polite">
            <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">Western University, London ON</p>
            {target && (
              <>
                <p className="text-base font-medium">{target.name}</p>
                <p className="text-sm text-white/60">{target.detail}</p>
              </>
            )}
          </div>
        )}
      </div>

      {panelOpen && !inBinoculars && (
        <div className="pointer-events-auto absolute bottom-36 right-4 max-h-[calc(100%-13rem)] w-[min(320px,calc(100%-32px))] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-black/70 p-5 backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Lights</h2>
            <button type="button" aria-label="Close light settings" className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white" onClick={() => setPanelOpen(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mb-3 text-xs uppercase tracking-[0.18em] text-amber-200/70">Floor lamp</p>
          <label className="mb-4 flex items-center justify-between text-sm text-white/80">
            Switched on
            <input id="lamp-on" type="checkbox" className="h-4 w-4 accent-amber-300" checked={lamp.on} onChange={(e) => roomRef.current?.setLamp({ on: e.target.checked })} />
          </label>
          <label className="mb-4 grid gap-2 text-sm text-white/80" htmlFor="lamp-brightness">
            <span className="flex justify-between">
              Brightness <span className="font-mono text-xs text-white/50 tabular-nums">{Math.round(lamp.brightness * 100)}%</span>
            </span>
            <input
              id="lamp-brightness"
              type="range"
              min={15}
              max={150}
              value={Math.round(lamp.brightness * 100)}
              className="accent-amber-300"
              onChange={(e) => roomRef.current?.setLamp({ brightness: Number(e.target.value) / 100, on: true })}
            />
          </label>
          <p className="mb-2 text-sm text-white/80">Bulb colour</p>
          <div className="flex flex-wrap gap-2">
            {LAMP_COLORS.map(([name, hex]) => (
              <button
                key={hex}
                type="button"
                aria-pressed={lamp.color === hex}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-white/75 hover:border-white/30 hover:text-white aria-pressed:border-amber-200/60 aria-pressed:text-amber-100"
                onClick={() => roomRef.current?.setLamp({ color: hex, on: true })}
              >
                <span className="h-3 w-3 rounded-full" style={{ background: hex }} /> {name}
              </button>
            ))}
          </div>
          <div className="mt-5 grid gap-3 border-t border-white/10 pt-4">
            <p className="text-xs uppercase tracking-[0.18em] text-amber-200/70">Desk lamp</p>
            <label className="flex items-center justify-between text-sm text-white/80">
              Switched on
              <input id="light-desk" type="checkbox" className="h-4 w-4 accent-amber-300" checked={lamp.desk} onChange={() => roomRef.current?.toggleLight("desk")} />
            </label>
            <label className="grid gap-2 text-sm text-white/80" htmlFor="desk-brightness">
              <span className="flex justify-between">
                Brightness <span className="font-mono text-xs text-white/50 tabular-nums">{Math.round(lamp.deskBrightness * 100)}%</span>
              </span>
              <input
                id="desk-brightness"
                type="range"
                min={20}
                max={150}
                value={Math.round(lamp.deskBrightness * 100)}
                className="accent-amber-300"
                onChange={(e) => roomRef.current?.setLamp({ deskBrightness: Number(e.target.value) / 100, desk: true })}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {DESK_TONES.map(([name, hex]) => (
                <button
                  key={hex}
                  type="button"
                  aria-pressed={lamp.deskTone === hex}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-white/75 hover:border-white/30 hover:text-white aria-pressed:border-amber-200/60 aria-pressed:text-amber-100"
                  onClick={() => roomRef.current?.setLamp({ deskTone: hex, desk: true })}
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: hex }} /> {name}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5 grid gap-3 border-t border-white/10 pt-4">
            <p className="text-xs uppercase tracking-[0.18em] text-amber-200/70">Sunset lamp</p>
            <label className="flex items-center justify-between text-sm text-white/80">
              Switched on
              <input id="light-sunset" type="checkbox" className="h-4 w-4 accent-amber-300" checked={lamp.sunset} onChange={() => roomRef.current?.toggleLight("sunset")} />
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(SUNSET_STYLES).map(([name, stops]) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={lamp.sunsetStyle === name}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-white/75 hover:border-white/30 hover:text-white aria-pressed:border-amber-200/60 aria-pressed:text-amber-100"
                  onClick={() => roomRef.current?.setLamp({ sunsetStyle: name, sunset: true })}
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: `radial-gradient(circle, ${stops.join(", ")})` }} /> {name}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5 grid gap-3 border-t border-white/10 pt-4">
            <label className="flex items-center justify-between text-sm text-white/80">
              Ceiling light
              <input id="light-ceiling" type="checkbox" className="h-4 w-4 accent-amber-300" checked={lamp.ceiling} onChange={() => roomRef.current?.toggleLight("ceiling")} />
            </label>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4 pb-6">
        <div className="flex flex-wrap justify-center gap-2">
          {inBinoculars ? (
            <button type="button" className={chip} onClick={() => roomRef.current?.setView(lastRoomView.current)}>
              Back to the room (Esc)
            </button>
          ) : (
            <>
              {VIEWS.map(([v, label]) => (
                <button key={v} type="button" className={chip} aria-pressed={view === v} onClick={() => roomRef.current?.setView(v)}>
                  {label}
                </button>
              ))}
              <button type="button" className={chip} onClick={() => roomRef.current?.setView("binoculars")}>
                <Binoculars className="h-4 w-4" /> Binoculars (B)
              </button>
              <button type="button" className={chip} aria-pressed={lamp.on} onClick={() => roomRef.current?.toggleLamp()}>
                {lamp.on ? <Lightbulb className="h-4 w-4" /> : <LightbulbOff className="h-4 w-4" />} Lamp (L)
              </button>
              <button type="button" className={chip} aria-pressed={panelOpen} aria-label="Light settings" onClick={() => setPanelOpen((o) => !o)}>
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        <p className="text-xs text-white/50">
          {inBinoculars ? "Drag to look around · scroll to zoom · Esc to step back" : "Drag to orbit · scroll to zoom · click any light to switch it (L for the floor lamp) or the binoculars (B)"}
        </p>
      </div>
    </main>
  );
};

export default RoomPlain;
