import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import { ArrowUpRight, Binoculars, Camera, Check, Gamepad2, LayoutGrid, Lightbulb, LightbulbOff, Radio, SlidersHorizontal, Volume2, VolumeX, X } from "lucide-react";
import type { ReactNode } from "react";
import { RADIO_STATION } from "@/components/room/createAudio";
import { playlistEmbed } from "@/components/room/playlist";
import { profile } from "@/data/portfolio";
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

/** the resume opens as the PDF itself, in a new tab; every other section opens in the sheet */
const openResume = () => window.open(profile.resumePdf, "_blank", "noopener");

const SOUND_KEY = "portfolio-room-plain:sound";
const loadSound = (): SoundSettings => {
  try {
    const v = JSON.parse(localStorage.getItem(SOUND_KEY) ?? "null");
    if (v && typeof v === "object") return { ...DEFAULT_SOUND, ...v };
  } catch {
    // fall through
  }
  return DEFAULT_SOUND;
};
import {
  createPlainRoom,
  CEILING_TONES,
  DESK_TONES,
  LAMP_COLORS,
  LAMP_DEFAULT,
  SUNSET_STYLES,
  DEFAULT_SOUND,
  OUTSIDE_SOUNDS,
  type SoundSettings,
  type LampSettings,
  type PlainRoomHandle,
  type PlainRoomView,
} from "@/components/room/createPlainRoom";

const chip =
  "liquid-glass on-glass pointer-events-auto inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-white/90 transition-[color,transform] duration-150 hover:text-white active:scale-[0.96] aria-pressed:text-amber-200";

type RoomView = Exclude<PlainRoomView, "binoculars" | "console">;

// motion: critically damped springs (no overshoot) for UI that appears; it starts from wherever it
// is, so a panel closed mid-opening reverses smoothly instead of jumping
const SPRING: Transition = { type: "spring", bounce: 0, duration: 0.3 };
// strong ease-out (matches --ease-out in index.css): things arriving decelerate hard into place
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const usePresets = () => {
  const reduce = useReducedMotion() ?? false;
  // pop-ups rise out of the dock: transform and opacity only (full transform strings stay on the GPU)
  const pop = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
    : {
        initial: { opacity: 0, transform: "translateY(12px) scale(0.96)" },
        animate: { opacity: 1, transform: "translateY(0px) scale(1)" },
        exit: { opacity: 0, transform: "translateY(8px) scale(0.97)", transition: { duration: 0.16, ease: EASE_OUT } },
        transition: SPRING,
      };
  // the section sheet comes in from the right and leaves the same way
  const sheet = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
    : {
        initial: { opacity: 0, transform: "translateX(48px)" },
        animate: { opacity: 1, transform: "translateX(0px)" },
        exit: { opacity: 0, transform: "translateX(48px)", transition: { duration: 0.2, ease: EASE_OUT } },
        transition: SPRING,
      };
  const fade = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, transform: "translateY(-4px) scale(0.97)" },
        animate: { opacity: 1, transform: "translateY(0px) scale(1)" },
        exit: { opacity: 0, transform: "translateY(0px) scale(0.97)" },
        transition: { duration: 0.2, ease: EASE_OUT },
      };
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
/** keeps a glass surface's cursor highlight under the pointer */
const trackSpot = (e: React.PointerEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
};

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
    whileTap={{ scale: 0.94 }}
    whileHover={{ y: -2 }}
    transition={{ type: "spring", bounce: 0.15, duration: 0.25 }}
    className={`${className} group on-glass relative flex min-w-[52px] shrink-0 flex-col items-center gap-1 rounded-[16px] px-2 py-2 text-[10px] font-medium sm:min-w-[64px] sm:px-3 sm:text-[11px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 ${
      accent ? "text-amber-100" : open || on ? "text-amber-100" : "text-white/80 hover:text-white"
    }`}
  >
    {open && <motion.span layoutId="dock-lens" transition={SPRING} className="liquid-lens absolute inset-0 -z-10 rounded-[16px]" aria-hidden="true" />}
    {accent && !open && <span className="absolute inset-0 -z-10 rounded-[16px] bg-amber-200/10" aria-hidden="true" />}
    <span className="transition-transform duration-200 ease-out motion-safe:group-hover:scale-[1.15] motion-safe:group-hover:-rotate-3">{children}</span>
    <span>{label}</span>
    {!open && <span className="absolute inset-0 -z-10 rounded-[16px] bg-white/0 transition-colors duration-200 group-hover:bg-white/[0.07]" aria-hidden="true" />}
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
  const [toast, setToast] = useState<{ id: PortfolioId; n: number; key: number } | null>(null);
  const [intro, setIntro] = useState(true);
  // the opening's clock starts when the room is actually on screen, not when the page loads
  const [roomShown, setRoomShown] = useState(false);
  // one pop-up at a time above the dock
  const [menu, setMenu] = useState<"portfolio" | "views" | null>(null);
  const [hoverView, setHoverView] = useState<RoomView | null>(null);
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
  const [sound, setSound] = useState<SoundSettings>(loadSound);
  const soundRef = useRef(sound);
  const [soundOpen, setSoundOpen] = useState(false);
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
        onFirstFrame: () => setRoomShown(true),
        onKeyboard: () => {
          setSection(null);
          setKeyboardOpen(true);
        },
        onPortfolio: (id) => {
          if (id === "resume" && profile.resumePdf) openResume();
          else setSection(id);
          setFound((f) => {
            if (f.includes(id)) return f;
            const next = [...f, id];
            // a newly found section gets its moment
            setToast({ id, n: next.length, key: Date.now() });
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
        sound: soundRef.current,
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
          setSoundOpen(false);
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
    soundRef.current = sound;
    roomRef.current?.setSound(sound);
    try {
      localStorage.setItem(SOUND_KEY, JSON.stringify(sound));
    } catch {
      // not remembered
    }
  }, [sound]);
  const changeSound = (patch: Partial<SoundSettings>) => {
    setSound((s) => ({ ...s, ...patch }));
    // touching a sound setting means you want to hear it
    setMuted(false);
  };

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

  // the found card stays a few seconds; the opening title until it's read or the room is touched
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), toast.n === PORTFOLIO_IDS.length ? 6500 : 3600);
    return () => window.clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!roomShown) return;
    const done = () => setIntro(false);
    const id = window.setTimeout(done, 4600);
    window.addEventListener("pointerdown", done, { once: true });
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointerdown", done);
    };
  }, [roomShown]);

  // the chrome (Home, dock) waits for the title to clear, then arrives: top first, dock a beat later
  const chromeIn = roomShown && !intro;
  const inBinoculars = view === "binoculars";
  const inConsole = view === "console";
  const away = inBinoculars || inConsole;

  return (
    <main className="fixed inset-0 bg-[#0d0e11] text-white">
      <div ref={containerRef} className="absolute inset-0" />
      {error && <p className="absolute inset-0 grid place-items-center text-white/70">This browser can't show the 3D room.</p>}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4">
        <motion.div
          className="flex flex-col items-start gap-2"
          initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-10px)" }}
          animate={chromeIn ? { opacity: 1, transform: "translateY(0px)" } : undefined}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        >
          {/* the room is the home page, so the corner carries the name instead of a way back */}
          <p className="liquid-glass on-glass rounded-full px-4 py-2 text-sm leading-tight">
            <span className="font-semibold text-white">Shajith Sasikumar</span>
            <span className="ml-2 text-white/55">BESc + Ivey HBA</span>
          </p>
          {!away && found.length === PORTFOLIO_IDS.length && (
            <p className="rounded-full bg-black/40 px-4 py-1.5 text-xs text-amber-100/85 backdrop-blur-md" aria-live="polite">
              You found the whole portfolio
            </p>
          )}
        </motion.div>
        <motion.div
          className="flex flex-col items-end gap-2"
          initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-10px)" }}
          animate={chromeIn ? { opacity: 1, transform: "translateY(0px)" } : undefined}
          transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.05 }}
        >
          <button type="button" className={chip} aria-expanded={soundOpen} aria-label={`Sound settings${muted ? " (muted)" : ""}`} onClick={() => setSoundOpen((o) => !o)}>
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
        </motion.div>
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
      {!roomShown && <div className="absolute inset-0 z-30 bg-black" aria-hidden="true" />}
      {/* the opening: the room surfaces from black while the name rises out of a mask, word by word */}
      <AnimatePresence>
        {intro && roomShown && (
          <motion.div
            key="intro"
            className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center text-center"
            exit={reduce ? { opacity: 0, transition: { duration: 0.3 } } : { opacity: 0, transform: "translateY(-10px)", transition: { duration: 0.6, ease: EASE_OUT } }}
          >
            <motion.div className="absolute inset-0 bg-black" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: reduce ? 0.3 : 1.8, ease: EASE_OUT, delay: reduce ? 0 : 0.15 }} />
            {/* a soft pool of shade keeps the type legible without a heavy text shadow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_center,rgba(0,0,0,0.6),rgba(0,0,0,0.15)_70%,transparent)]" />
            <motion.p
              className="relative mb-4 text-[11px] font-semibold uppercase tracking-[0.42em] text-amber-100/90 [text-shadow:0_1px_8px_rgba(0,0,0,0.7)] sm:text-xs"
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(6px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.25 }}
            >
              Welcome in
            </motion.p>
            <h1 className="relative flex gap-[0.24em] text-5xl font-semibold leading-none tracking-[-0.045em] text-white sm:text-7xl" aria-label="Shajith's room">
              {["Shajith's", "room"].map((word, i) => (
                <span key={word} className="inline-block overflow-hidden pb-[0.14em]" aria-hidden="true">
                  <motion.span
                    className="inline-block"
                    initial={reduce ? { opacity: 0 } : { transform: "translateY(110%)" }}
                    animate={reduce ? { opacity: 1 } : { transform: "translateY(0%)" }}
                    transition={{ duration: reduce ? 0.3 : 1, ease: EASE_OUT, delay: 0.4 + i * 0.09 }}
                  >
                    {word}
                  </motion.span>
                </span>
              ))}
            </h1>
            {/* a hairline draws out from the centre */}
            <motion.span
              className="relative mt-4 block h-px w-40 bg-gradient-to-r from-transparent via-amber-100/70 to-transparent sm:w-56"
              initial={reduce ? { opacity: 0 } : { clipPath: "inset(0 50% 0 50%)" }}
              animate={reduce ? { opacity: 1 } : { clipPath: "inset(0 0% 0 0%)" }}
              transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.85 }}
              aria-hidden="true"
            />
            <motion.p
              className="relative mt-4 text-sm text-white/85 [text-shadow:0_1px_8px_rgba(0,0,0,0.7)] sm:text-base"
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(6px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.7, ease: EASE_OUT, delay: 1.05 }}
            >
              Everything here means something. Click around.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* a section just found: a glass card with a ring filling to the new count */}
      <AnimatePresence>
        {toast && (
          <div className="pointer-events-none absolute left-4 right-4 top-[4.5rem] z-20 flex justify-start">
            <motion.div
              key={toast.key}
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-14px) scale(0.95)" }}
              animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-14px) scale(0.97)", transition: { duration: 0.2, ease: EASE_OUT } }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
              className="liquid-glass on-glass flex items-center gap-3 rounded-full py-2 pl-2 pr-5"
              role="status"
            >
              <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90" aria-hidden="true">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                <motion.circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="#fcd99a"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ pathLength: (toast.n - 1) / PORTFOLIO_IDS.length }}
                  animate={{ pathLength: toast.n / PORTFOLIO_IDS.length }}
                  transition={{ duration: reduce ? 0 : 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                />
              </svg>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-amber-200/80">
                  {toast.n === PORTFOLIO_IDS.length ? "The whole portfolio" : `Found ${toast.n} of ${PORTFOLIO_IDS.length}`}
                </p>
                <p className="text-sm font-medium text-white">
                  {toast.n === PORTFOLIO_IDS.length ? "You found everything. Thanks for looking around." : `${PORTFOLIO_SPOTS[toast.id].title}, behind ${PORTFOLIO_SPOTS[toast.id].object.replace(/^The /, "the ")}`}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* finding all eight: a shower of gold confetti */}
      {toast?.n === PORTFOLIO_IDS.length && !reduce && (
        <div key={toast.key} className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">
          {Array.from({ length: 70 }, (_, i) => {
            const x = (i * 37) % 100;
            const hue = ["#fcd99a", "#ffb46e", "#ffffff", "#f7a6c4", "#a47bff"][i % 5];
            return (
              <motion.span
                key={i}
                className="absolute top-0 block h-2.5 w-1.5 rounded-[2px]"
                style={{ left: `${x}%`, background: hue }}
                initial={{ y: -20, rotate: 0, opacity: 1 }}
                animate={{ y: "105vh", rotate: 360 + ((i * 53) % 360), x: ((i * 29) % 80) - 40, opacity: [1, 1, 0] }}
                transition={{ duration: 2.6 + ((i * 7) % 10) / 10, delay: ((i * 13) % 20) / 20, ease: [0.3, 0.6, 0.5, 1] }}
              />
            );
          })}
        </div>
      )}

      <RoomConsole open={inConsole && consoleReady} onExit={() => roomRef.current?.setView(lastRoomView.current)} />
      {keyboardOpen && !away && <FidgetKeyboard muted={muted} volume={sound.effects} onClose={() => setKeyboardOpen(false)} />}
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
            <div key={section} className="stagger-in">
              <PortfolioPage id={section} />
            </div>
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
      {/* sound: everything on or off, then effects and ambience on their own, and what's outside */}
      <AnimatePresence>{soundOpen && (
        <motion.div key="sound" {...pop} onPointerMove={trackSpot} style={{ transformOrigin: "top right" }} className="pointer-events-auto absolute right-4 top-[4.25rem] z-20 w-[min(300px,calc(100%-32px))] liquid-glass-panel glass-spot rounded-[24px] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Sound</h2>
            <button type="button" aria-label="Close sound settings" className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white" onClick={() => setSoundOpen(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <label className="mb-4 flex items-center justify-between text-sm text-white/80">
            <span>
              All sound <span className="text-xs text-white/40">(M)</span>
            </span>
            <input type="checkbox" className="h-4 w-4 accent-amber-300" checked={!muted} onChange={(e) => setMuted(!e.target.checked)} />
          </label>
          <div className={`grid gap-4 transition-opacity duration-200 ${muted ? "opacity-45" : ""}`}>
            {(
              [
                ["effects", "Sound effects", "Clicks, squeaks, spritzes and the keyboard"],
                ["ambience", "Ambience", "What you hear outside, and the room's hush"],
              ] as const
            ).map(([key, name, hint]) => (
              <label key={key} className="grid gap-1.5 text-sm text-white/80" htmlFor={`sound-${key}`}>
                <span className="flex justify-between">
                  {name} <span className="font-mono text-xs text-white/50 tabular-nums">{sound[key] === 0 ? "Off" : `${Math.round(sound[key] * 100)}%`}</span>
                </span>
                <input id={`sound-${key}`} type="range" min={0} max={100} value={Math.round(sound[key] * 100)} className="accent-amber-300" onChange={(e) => changeSound({ [key]: Number(e.target.value) / 100 })} />
                <span className="text-xs text-white/45">{hint}</span>
              </label>
            ))}
            <div>
              <p className="mb-2 text-sm text-white/80">Outside</p>
              <div className="flex flex-wrap gap-2">
                {OUTSIDE_SOUNDS.map(([id, name]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={sound.outside === id}
                    className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/75 hover:border-white/30 hover:text-white aria-pressed:border-amber-200/60 aria-pressed:text-amber-100"
                    onClick={() => changeSound({ outside: id, ambience: sound.ambience || 0.6 })}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            {playlist && <p className="text-xs text-white/45">Music plays from the speaker on the desk, with its own volume.</p>}
          </div>
        </motion.div>
      )}</AnimatePresence>

      <AnimatePresence>{panelOpen && !away && (
        <motion.div key="lights" {...pop} onPointerMove={trackSpot} style={{ transformOrigin: "bottom right" }} className="pointer-events-auto absolute bottom-32 right-4 z-10 max-h-[calc(100%-12rem)] w-[min(320px,calc(100%-32px))] overflow-y-auto overscroll-contain liquid-glass-panel glass-spot rounded-[24px] p-5">
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
        <motion.div key="portfolio" {...pop} onPointerMove={trackSpot} style={{ transformOrigin: "bottom center" }} className="pointer-events-auto absolute inset-x-4 bottom-32 z-10 mx-auto max-h-[calc(100%-12rem)] max-w-2xl overflow-y-auto overscroll-contain liquid-glass-panel glass-spot rounded-[26px] p-5 sm:p-6" role="dialog" aria-label="My portfolio">
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
                  whileHover={reduce ? undefined : { y: -2, transition: { type: "spring", bounce: 0.35, duration: 0.3 } }}
                  onClick={() => {
                    setMenu(null);
                    if (id === "resume" && profile.resumePdf) openResume();
                    else setSection(id);
                  }}
                  className="sheen group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:border-amber-200/40 hover:bg-white/[0.09]"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-white">{PORTFOLIO_SPOTS[id].title}</span>
                    <span className="block truncate text-xs text-white/50">{isFound ? `Found · ${PORTFOLIO_SPOTS[id].object}` : "Still hidden in the room"}</span>
                  </span>
                  {isFound ? <Check className="h-4 w-4 shrink-0 text-amber-200 transition-transform duration-200 group-hover:scale-125" /> : <ArrowUpRight className="h-4 w-4 shrink-0 text-white/35 transition-[color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white/80" />}
                </motion.button>
              );
            })}
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* camera views */}
      <AnimatePresence>{menu === "views" && !away && (
        <div className="pointer-events-none absolute inset-x-0 bottom-32 z-10 flex justify-center"><motion.div key="views" {...pop} onPointerLeave={() => setHoverView(null)} style={{ transformOrigin: "bottom center" }} className="pointer-events-auto isolate w-56 overflow-hidden liquid-glass-panel rounded-[22px] py-2 animate-in fade-in slide-in-from-bottom-2 duration-200" role="menu" aria-label="Views">
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
              onPointerEnter={() => setHoverView(v)}
              className="relative flex w-full items-center justify-between px-4 py-2 text-left text-sm text-white/80 transition-colors hover:text-white"
            >
              {hoverView === v && <motion.span layoutId="views-hover" transition={SPRING} className="liquid-lens absolute inset-x-1.5 inset-y-0.5 -z-10 rounded-xl" aria-hidden="true" />}
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
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(20px) scale(0.97)" }}
              animate={chromeIn ? { opacity: 1, transform: "translateY(0px) scale(1)" } : undefined}
              transition={{ type: "spring", bounce: 0, duration: 0.6, delay: 0.12 }}
              onPointerMove={trackSpot}
              className="liquid-glass glass-spot pointer-events-auto flex max-w-full items-stretch gap-1 overflow-x-auto rounded-[24px] p-1.5 [scrollbar-width:none]"
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
            <motion.p
              className="on-glass hidden text-center text-xs text-white/55 sm:block"
              initial={{ opacity: 0 }}
              animate={chromeIn ? { opacity: 1 } : undefined}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.3 }}
            >
              Drag to look around · click things in the room · L lamp · B binoculars · M mute
            </motion.p>
          </>
        )}
      </div>
    </main>
  );
};

export default RoomPlain;
