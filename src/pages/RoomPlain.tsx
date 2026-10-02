import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Binoculars, Camera, Check, Gamepad2, LayoutGrid, Lightbulb, LightbulbOff, Radio, Search, SlidersHorizontal, Volume2, VolumeX, X } from "lucide-react";
import type { ReactNode } from "react";
import { RADIO_STATION } from "@/components/room/createAudio";
import { playlistEmbed } from "@/components/room/playlist";
import { RoomConsole } from "@/components/room/console/RoomConsole";
import { PortfolioPage } from "@/components/room/PortfolioPages";
import { FidgetKeyboard } from "@/components/room/FidgetKeyboard";
import { PORTFOLIO_IDS, PORTFOLIO_SPOTS, type PortfolioId } from "@/components/room/portfolioSpots";

// which hidden sections of the portfolio this visitor has found; kept in this browser only
const FOUND_KEY = "portfolio-room-plain:found";
const loadFound = (): PortfolioId[] => {
  try {
    const v = JSON.parse(localStorage.getItem(FOUND_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is PortfolioId => PORTFOLIO_IDS.includes(x)) : [];
  } catch {
    return [];
  }
};

// the desk speaker plays this playlist when one is set in playlist.ts; otherwise the built-in lo-fi radio
const playlist = playlistEmbed();
import {
  createPlainRoom,
  CEILING_TONES,
  DESK_TONES,
  LAMP_COLORS,
  LAMP_DEFAULT,
  SUNSET_STYLES,
  type LampSettings,
  type PlainRoomHandle,
  type PlainRoomView,
} from "@/components/room/createPlainRoom";

const chip =
  "liquid-glass on-glass pointer-events-auto inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-white/90 transition-[color,transform] duration-150 hover:text-white active:scale-[0.96] aria-pressed:text-amber-200";

type RoomView = Exclude<PlainRoomView, "binoculars" | "console">;

// motion: critically damped springs (no overshoot) for UI that appears; it starts from wherever it
// is, so a panel closed mid-opening reverses smoothly instead of jumping
const SPRING: Transition = { type: "spring", bounce: 0, duration: 0.42 };
const usePresets = () => {
  const reduce = useReducedMotion() ?? false;
  // pop-ups materialise out of the dock: glass arriving (scale, blur and opacity together), not a plain fade
  const pop = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
    : {
        initial: { opacity: 0, y: 14, scale: 0.94, filter: "blur(8px)" },
        animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
        exit: { opacity: 0, y: 10, scale: 0.96, filter: "blur(6px)" },
        transition: SPRING,
      };
  // the section sheet comes in from the right and leaves the same way
  const sheet = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
    : { initial: { opacity: 0, x: 56 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 56 }, transition: SPRING };
  const fade = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: -4, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, scale: 0.97 }, transition: { ...SPRING, duration: 0.25 } };
  return { reduce, pop, sheet, fade };
};

const VIEWS: [RoomView, string][] = [
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
/**
 * A dock button: an icon over a short label. `open` means its menu is showing; a lens of glass
 * slides between open buttons. `on` means the thing it controls is on (a lit dot). Presses
 * respond on pointer-down with a quick spring.
 */
const DockButton = ({
  label,
  onClick,
  open = false,
  on = false,
  accent = false,
  badge,
  className = "",
  children,
}: {
  label: string;
  onClick: () => void;
  open?: boolean;
  on?: boolean;
  accent?: boolean;
  badge?: string;
  className?: string;
  children: ReactNode;
}) => (
  <motion.button
    type="button"
    onClick={onClick}
    aria-pressed={open || on}
    whileTap={{ scale: 0.9 }}
    transition={{ type: "spring", bounce: 0, duration: 0.25 }}
    className={`${className} on-glass relative flex min-w-[52px] shrink-0 flex-col items-center gap-1 rounded-[16px] px-2 py-2 text-[10px] font-medium sm:min-w-[64px] sm:px-3 sm:text-[11px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 ${
      accent ? "text-amber-100" : open || on ? "text-amber-100" : "text-white/80 hover:text-white"
    }`}
  >
    {open && <motion.span layoutId="dock-lens" transition={SPRING} className="liquid-lens absolute inset-0 -z-10 rounded-[16px]" aria-hidden="true" />}
    {accent && !open && <span className="absolute inset-0 -z-10 rounded-[16px] bg-amber-200/10" aria-hidden="true" />}
    {children}
    <span>{label}</span>
    {on && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-amber-200 shadow-[0_0_6px_rgba(253,230,138,0.9)]" aria-hidden="true" />}
    {badge && <span className="absolute right-1 top-1 rounded-full bg-amber-200 px-1.5 text-[10px] font-semibold leading-4 text-black tabular-nums">{badge}</span>}
  </motion.button>
);

/**
 * `hosted` is for the standalone preview, which runs on a host that forbids frames from other
 * sites: hosted games and the playlist link out instead of embedding.
 */
const RoomPlain = ({ hosted = false }: { hosted?: boolean }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<PlainRoomHandle | null>(null);
  const [view, setView] = useState<PlainRoomView>("photo");
  const viewRef = useRef<PlainRoomView>("photo");
  const lastRoomView = useRef<RoomView>("photo");
  const [consoleReady, setConsoleReady] = useState(false);
  const [section, setSection] = useState<PortfolioId | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  // one pop-up at a time above the dock
  const [menu, setMenu] = useState<"portfolio" | "views" | null>(null);
  const keyboardOpenRef = useRef(false);
  keyboardOpenRef.current = keyboardOpen;
  const sectionRef = useRef<PortfolioId | null>(null);
  sectionRef.current = section;
  const [found, setFound] = useState<PortfolioId[]>(loadFound);
  const [error, setError] = useState(false);
  const [lamp, setLamp] = useState<LampSettings>(loadLamp);
  const [panelOpen, setPanelOpen] = useState(false);
  const [target, setTarget] = useState<{ name: string; detail: string } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [radioOn, setRadioOn] = useState(false);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem("portfolio-room-plain:muted") === "1";
    } catch {
      return false;
    }
  });
  const mutedRef = useRef(muted);
  const [playerOpen, setPlayerOpen] = useState(false);

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
          if (v !== "binoculars" && v !== "console") lastRoomView.current = v;
          if (v !== "console") setConsoleReady(false);
          setView(v);
        },
        onScopeTarget: setTarget,
        onConsoleReady: () => setConsoleReady(true),
        onKeyboard: () => {
          setSection(null);
          setKeyboardOpen(true);
        },
        onPortfolio: (id) => {
          setSection(id);
          setFound((f) => {
            if (f.includes(id)) return f;
            const next = [...f, id];
            try {
              localStorage.setItem(FOUND_KEY, JSON.stringify(next));
            } catch {
              // not remembered
            }
            return next;
          });
        },
        onLightSwitch: () => setPanelOpen(true),
        onRadioChange: setRadioOn,
        onSpeaker: playlist ? () => setPlayerOpen((o) => !o) : undefined,
        onHover: setHover,
        muted: mutedRef.current,
      });
    } catch (e) {
      console.error("Failed to start the room:", e);
      setError(true);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      // the console takes the keyboard while it's on screen
      if (viewRef.current === "console" || keyboardOpenRef.current) return;
      if (sectionRef.current) {
        if (key === "escape") setSection(null);
        return;
      }
      if (key === "l") roomRef.current?.toggleLamp();
      else if (key === "m") setMuted((m) => !m);
      else if (key === "b") roomRef.current?.setView(viewRef.current === "binoculars" ? lastRoomView.current : "binoculars");
      else if (key === "escape") {
        if (viewRef.current === "binoculars") roomRef.current?.setView(lastRoomView.current);
        else {
          setPanelOpen(false);
          setMenu(null);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      roomRef.current?.dispose();
      roomRef.current = null;
    };
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
    roomRef.current?.setMuted(muted);
    try {
      localStorage.setItem("portfolio-room-plain:muted", muted ? "1" : "0");
    } catch {
      // not remembered
    }
  }, [muted]);

  useEffect(() => {
    roomRef.current?.setSpeakerPlaying(playerOpen);
  }, [playerOpen]);

  const { reduce, pop, sheet, fade } = usePresets();
  const toggleMenu = (m: "portfolio" | "views" | "lights") => {
    if (m === "lights") {
      setMenu(null);
      setPanelOpen((o) => !o);
    } else {
      setPanelOpen(false);
      setMenu((cur) => (cur === m ? null : m));
    }
  };

  const inBinoculars = view === "binoculars";
  const inConsole = view === "console";
  const away = inBinoculars || inConsole;

  return (
    <main className="fixed inset-0 bg-[#0d0e11] text-white">
      <div ref={containerRef} className="absolute inset-0" />
      {error && <p className="absolute inset-0 grid place-items-center text-white/70">This browser can't show the 3D room.</p>}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4">
        <div className="flex flex-col items-start gap-2">
          <Link to="/" className={chip}>
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          {!away && found.length === PORTFOLIO_IDS.length && (
            <p className="rounded-full bg-black/40 px-4 py-1.5 text-xs text-amber-100/85 backdrop-blur-md" aria-live="polite">
              You found the whole portfolio
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <button type="button" className={chip} aria-pressed={!muted} aria-label={muted ? "Unmute (M)" : "Mute (M)"} onClick={() => setMuted((m) => !m)}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          {radioOn && !away && (
            <button type="button" className={chip} onClick={() => roomRef.current?.toggleRadio()}>
              <Radio className="h-4 w-4 text-amber-200" />
              <span className="text-left">
                <span className="block text-xs font-medium">{RADIO_STATION.name}</span>
                <span className="block text-[11px] text-white/55">{RADIO_STATION.show}</span>
              </span>
            </button>
          )}
        </div>
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

      <AnimatePresence>{playlist && playerOpen && (
        // kept mounted while open so the music carries on when the lights panel or binoculars are used
        <motion.div key="player" {...pop} style={{ transformOrigin: "top left" }} className="pointer-events-auto absolute left-4 top-20 w-[min(360px,calc(100%-32px))] liquid-glass-panel overflow-hidden rounded-[24px]">
          <div className="flex items-center justify-between px-4 py-2.5">
            <p className="text-xs uppercase tracking-[0.18em] text-amber-200/70">Desk speaker · {playlist.service}</p>
            <button type="button" aria-label="Close the player" className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white" onClick={() => setPlayerOpen(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          {hosted ? (
            <a href={playlist.open} target="_blank" rel="noopener noreferrer" className="m-4 mt-0 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
              Open my playlist on {playlist.service}
            </a>
          ) : (
            <iframe title={`My playlist on ${playlist.service}`} src={playlist.embed} className="block h-[352px] w-full border-0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" />
          )}
        </motion.div>
      )}</AnimatePresence>
      <RoomConsole open={inConsole && consoleReady} onExit={() => roomRef.current?.setView(lastRoomView.current)} />
      {keyboardOpen && !away && <FidgetKeyboard muted={muted} onClose={() => setKeyboardOpen(false)} />}
      <AnimatePresence>{section && !away && (
        // a section of the portfolio, found in the room
        <motion.div key="section" {...sheet} className="pointer-events-auto absolute inset-y-0 right-0 z-10 flex w-full max-w-xl flex-col liquid-glass-panel rounded-l-[28px]" role="dialog" aria-label={PORTFOLIO_SPOTS[section].title}>
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 pb-4 pt-6">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">
                {found.includes(section) ? `Found · ${PORTFOLIO_SPOTS[section].object}` : "Portfolio · also hidden somewhere in the room"}
              </p>
              <h2 className="mt-1 text-2xl font-bold">{PORTFOLIO_SPOTS[section].title}</h2>
            </div>
            <button type="button" aria-label="Close (Esc)" className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white" onClick={() => setSection(null)}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            <PortfolioPage id={section} />
          </div>
        </motion.div>
      )}</AnimatePresence>
      <AnimatePresence>{hover && !away && (
        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
          <motion.p key={hover} {...fade} className="liquid-glass on-glass rounded-full px-4 py-1.5 text-xs text-white/90">
            {hover}
          </motion.p>
        </div>
      )}</AnimatePresence>
      <AnimatePresence>{panelOpen && !away && (
        <motion.div key="lights" {...pop} style={{ transformOrigin: "bottom right" }} className="pointer-events-auto absolute bottom-32 right-4 z-10 max-h-[calc(100%-12rem)] w-[min(320px,calc(100%-32px))] overflow-y-auto overscroll-contain liquid-glass-panel rounded-[24px] p-5">
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
            <div className="flex flex-wrap gap-2">
              {CEILING_TONES.map(([name, hex]) => (
                <button
                  key={hex}
                  type="button"
                  aria-pressed={lamp.ceilingTone === hex}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-white/75 hover:border-white/30 hover:text-white aria-pressed:border-amber-200/60 aria-pressed:text-amber-100"
                  onClick={() => roomRef.current?.setLamp({ ceilingTone: hex, ceiling: true })}
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: hex }} /> {name}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}</AnimatePresence>

      {/* the portfolio menu: every section, found or not */}
      <AnimatePresence>{menu === "portfolio" && !away && (
        <motion.div key="portfolio" {...pop} style={{ transformOrigin: "bottom center" }} className="pointer-events-auto absolute inset-x-4 bottom-32 z-10 mx-auto max-h-[calc(100%-12rem)] max-w-2xl overflow-y-auto overscroll-contain liquid-glass-panel rounded-[26px] p-5 sm:p-6" role="dialog" aria-label="My portfolio">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">My portfolio</h2>
              <p className="mt-0.5 text-sm text-white/60">Pick a section, or find each one hidden in the room.</p>
            </div>
            <button type="button" aria-label="Close" className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white" onClick={() => setMenu(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <motion.div className="grid gap-2 sm:grid-cols-2" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: reduce ? 0 : 0.035, delayChildren: 0.05 } } }}>
            {PORTFOLIO_IDS.map((id) => {
              const isFound = found.includes(id);
              return (
                <motion.button
                  key={id}
                  type="button"
                  variants={{ hidden: { opacity: 0, y: reduce ? 0 : 8 }, show: { opacity: 1, y: 0, transition: SPRING } }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setMenu(null);
                    setSection(id);
                  }}
                  className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:border-amber-200/40 hover:bg-white/[0.09]"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-white">{PORTFOLIO_SPOTS[id].title}</span>
                    <span className="block truncate text-xs text-white/50">{isFound ? `Found · ${PORTFOLIO_SPOTS[id].object}` : "Still hidden in the room"}</span>
                  </span>
                  {isFound ? <Check className="h-4 w-4 shrink-0 text-amber-200" /> : <Search className="h-4 w-4 shrink-0 text-white/35 group-hover:text-white/70" />}
                </motion.button>
              );
            })}
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* camera views */}
      <AnimatePresence>{menu === "views" && !away && (
        <div className="pointer-events-none absolute inset-x-0 bottom-32 z-10 flex justify-center"><motion.div key="views" {...pop} style={{ transformOrigin: "bottom center" }} className="pointer-events-auto w-56 overflow-hidden liquid-glass-panel rounded-[22px] py-2 animate-in fade-in slide-in-from-bottom-2 duration-200" role="menu" aria-label="Views">
          {VIEWS.map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="menuitemradio"
              aria-checked={view === v}
              onClick={() => {
                setMenu(null);
                roomRef.current?.setView(v);
              }}
              className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white"
            >
              {label}
              {view === v && <Check className="h-4 w-4 text-amber-200" />}
            </button>
          ))}
        </motion.div></div>
      )}</AnimatePresence>

      {/* the dock */}
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] ${inConsole ? "hidden" : ""}`}>
        {inBinoculars ? (
          <>
            <button type="button" className={chip} onClick={() => roomRef.current?.setView(lastRoomView.current)}>
              Back to the room (Esc)
            </button>
            <p className="text-xs text-white/50">Drag to look around · scroll to zoom</p>
          </>
        ) : (
          <>
            <motion.nav
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...SPRING, delay: 0.35 }}
              className="liquid-glass pointer-events-auto flex max-w-full items-stretch gap-1 overflow-x-auto rounded-[24px] p-1.5 [scrollbar-width:none]"
              aria-label="Room controls"
            >
              <DockButton label="Portfolio" open={menu === "portfolio"} onClick={() => toggleMenu("portfolio")} accent badge={`${found.length}/${PORTFOLIO_IDS.length}`}>
                <LayoutGrid className="h-5 w-5" />
              </DockButton>
              <span className="mx-1 hidden w-px self-stretch bg-white/10 sm:block" aria-hidden="true" />
              <DockButton label="PlayStation" onClick={() => roomRef.current?.setView("console")}>
                <Gamepad2 className="h-5 w-5" />
              </DockButton>
              <DockButton label="Binoculars" onClick={() => roomRef.current?.setView("binoculars")}>
                <Binoculars className="h-5 w-5" />
              </DockButton>
              <DockButton label="Music" on={playlist ? playerOpen : radioOn} onClick={() => (playlist ? setPlayerOpen((o) => !o) : roomRef.current?.toggleRadio())}>
                <Radio className="h-5 w-5" />
              </DockButton>
              <DockButton label="Lamp" className="hidden sm:flex" on={lamp.on} onClick={() => roomRef.current?.toggleLamp()}>
                {lamp.on ? <Lightbulb className="h-5 w-5" /> : <LightbulbOff className="h-5 w-5" />}
              </DockButton>
              <DockButton label="Lights" open={panelOpen} onClick={() => toggleMenu("lights")}>
                <SlidersHorizontal className="h-5 w-5" />
              </DockButton>
              <DockButton label="Views" open={menu === "views"} onClick={() => toggleMenu("views")}>
                <Camera className="h-5 w-5" />
              </DockButton>
            </motion.nav>
            <p className="on-glass hidden text-center text-xs text-white/55 sm:block">Drag to look around · click things in the room · L lamp · B binoculars · M sound</p>
          </>
        )}
      </div>
    </main>
  );
};

export default RoomPlain;
