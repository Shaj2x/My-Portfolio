import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ExternalLink, Gamepad2, Sparkles, Trophy, type LucideIcon } from "lucide-react";
import PongGame from "@/components/PongGame";
import SnakeGame from "@/components/SnakeGame";
import { customDescriptions, demoLinks, profile } from "@/data/portfolio";

/*
 * The PS5 on the desk, as a console you can drive: a home screen with his games, the selected
 * tile's art filling the background. Pong and Snake play on the screen; the games that live on
 * their own sites open in a new tab. It drives with the keyboard, the mouse, or a real
 * controller (Gamepad API).
 */

interface Game {
  id: "pong" | "snake" | "slots" | "blackjack" | "mercatus";
  title: string;
  /** one line under the title on the home screen */
  blurb: string;
  icon: LucideIcon;
  /** two colours for the tile and the background art */
  art: [string, string];
  /** a game that lives on its own site, opened in a new tab */
  site?: string;
}

const GAMES: Game[] = [
  { id: "pong", title: "Pong", blurb: "First to 5 against the CPU. Move with W/S, the arrow keys, or the D-pad.", icon: Gamepad2, art: ["#d4202c", "#2a0507"] },
  { id: "snake", title: "Snake", blurb: "Eat the SS logo to grow. Steer with WASD, the arrow keys, or the D-pad.", icon: Gamepad2, art: ["#1f9d55", "#03200f"] },
  { id: "slots", title: "Raptors Slot Machine", blurb: "A Toronto Raptors slot machine. Opens in a new tab.", icon: Trophy, art: ["#ce1141", "#1a0207"], site: demoLinks["Raptors-Slot-Machine"] },
  { id: "blackjack", title: "Raptors BlackJack", blurb: "Blackjack at a Raptors table. Opens in a new tab.", icon: Trophy, art: ["#a1a1a4", "#1c0b0d"], site: demoLinks["Raptors-BlackJack"] },
  { id: "mercatus", title: "Mercatus", blurb: `${customDescriptions["Mercatus"]} Opens in a new tab.`, icon: Sparkles, art: ["#e2a33a", "#1d1204"], site: demoLinks["Mercatus"] },
];

type Action = "left" | "right" | "confirm" | "back" | "home";

/** PlayStation face-button glyphs, drawn in the console's own monochrome style */
const Glyph = ({ kind }: { kind: "cross" | "circle" | "dpad" }) => {
  if (kind === "dpad") return <span className="rounded border border-white/40 px-1 font-mono text-[10px] leading-4 text-white/80">◀ ▶</span>;
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeOpacity="0.5" />
      {kind === "cross" ? <path d="M6.5 6.5l7 7M13.5 6.5l-7 7" stroke="currentColor" strokeWidth="1.6" /> : <circle cx="10" cy="10" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />}
    </svg>
  );
};

const Hint = ({ glyph, children }: { glyph: Parameters<typeof Glyph>[0]["kind"]; children: ReactNode }) => (
  <span className="inline-flex items-center gap-1.5">
    <Glyph kind={glyph} />
    {children}
  </span>
);

export interface RoomConsoleProps {
  /** shown once the camera has reached the monitor */
  open: boolean;
  /** leave the console and go back to the room */
  onExit: () => void;
}

const useClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(id);
  }, []);
  return now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export const RoomConsole = ({ open, onExit }: RoomConsoleProps) => {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState<Game | null>(null);
  const clock = useClock();
  const sel = GAMES[index];
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // reopening the console lands on the home screen
  useEffect(() => {
    if (!open) setPlaying(null);
  }, [open]);

  const launch = useCallback((g: Game) => {
    if (g.site) window.open(g.site, "_blank", "noopener");
    else setPlaying(g);
  }, []);

  const act = useCallback(
    (a: Action) => {
      if (playing) {
        if (a === "back" || a === "home") setPlaying(null);
        return;
      }
      if (a === "left") setIndex((i) => Math.max(0, i - 1));
      else if (a === "right") setIndex((i) => Math.min(GAMES.length - 1, i + 1));
      else if (a === "confirm") launch(sel);
      else if (a === "back") onExit();
    },
    [playing, sel, launch, onExit],
  );

  useEffect(() => {
    tileRefs.current[index]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [index]);

  // keyboard: arrows to move, Enter or Space to play, Esc or Backspace to go back. While a game
  // is on screen its own keys (arrows, WASD, Space) belong to it, so only Esc is taken.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (playing) {
        if (k === "Escape" || k === "Backspace") {
          e.preventDefault();
          act("back");
        }
        return;
      }
      const map: Record<string, Action> = { ArrowLeft: "left", ArrowUp: "left", ArrowRight: "right", ArrowDown: "right", Enter: "confirm", " ": "confirm", Escape: "back", Backspace: "back" };
      const a = map[k];
      if (a) {
        e.preventDefault();
        act(a);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, playing, act]);

  // a real controller: D-pad and left stick move, ✕ plays, ○ goes back, PS goes home. Inside
  // Pong and Snake the D-pad and stick drive the game as arrow keys, and ✕ presses its button.
  const actRef = useRef(act);
  actRef.current = act;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  useEffect(() => {
    if (!open || !("getGamepads" in navigator)) return;
    let raf = 0;
    const prev: Record<string, boolean> = {};
    const held: Record<string, boolean> = {};
    let repeatAt = 0;
    const key = (k: string, down: boolean) => {
      if (held[k] === down) return;
      held[k] = down;
      window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { key: k, bubbles: true }));
    };
    const poll = (t: number) => {
      const pad = navigator.getGamepads?.().find((p) => p);
      if (pad) {
        const b = (i: number) => !!pad.buttons[i]?.pressed;
        const ax = pad.axes[0] ?? 0;
        const ay = pad.axes[1] ?? 0;
        const dir = { left: b(14) || ax < -0.5, right: b(15) || ax > 0.5, up: b(12) || ay < -0.5, down: b(13) || ay > 0.5 };
        const press = (name: string, now: boolean, a: Action) => {
          if (now && !prev[name]) actRef.current(a);
          prev[name] = now;
        };
        if (playingRef.current) {
          key("ArrowLeft", dir.left);
          key("ArrowRight", dir.right);
          key("ArrowUp", dir.up);
          key("ArrowDown", dir.down);
          if (b(0) && !prev.cross) (document.querySelector("[data-console-page] button") as HTMLButtonElement | null)?.click();
          prev.cross = b(0);
        } else {
          for (const k of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) key(k, false);
          // directions repeat while held, like scrolling a real menu
          const step = dir.left || dir.up ? "left" : dir.right || dir.down ? "right" : null;
          if (step && (!prev.dir || t > repeatAt)) {
            actRef.current(step);
            repeatAt = t + (prev.dir ? 140 : 420);
          }
          prev.dir = !!step;
          press("cross", b(0), "confirm");
        }
        press("circle", b(1), "back");
        press("ps", b(16), "home");
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 grid place-items-center p-3 sm:p-6" role="dialog" aria-label="PlayStation">
      {/* the monitor: a dark bezel around the screen */}
      <div className="relative flex h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-[18px] border-[10px] border-[#0b0b0d] bg-[#030a1e] text-white shadow-[0_30px_120px_rgba(0,0,0,0.7)] animate-in fade-in zoom-in-95 duration-500" style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
        {/* the selected game's art, filling the background */}
        <div
          key={sel.id}
          className="absolute inset-0 animate-in fade-in duration-500"
          style={{ background: `radial-gradient(120% 90% at 75% 85%, ${(playing ?? sel).art[0]}aa 0%, ${(playing ?? sel).art[1]} 55%, #030a1e 100%)` }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:22px_22px] opacity-30" aria-hidden="true" />

        <header className="relative z-10 flex items-center justify-between gap-4 px-5 pt-4 sm:px-10 sm:pt-6">
          <p className="text-lg font-semibold sm:text-2xl">Games</p>
          <div className="flex items-center gap-3 text-sm text-white/85">
            <span className="hidden sm:inline">{profile.name.split(" ")[0]}</span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#d4202c] to-[#5a0a0f] text-xs font-bold">SS</span>
            <span className="font-mono tabular-nums">{clock}</span>
          </div>
        </header>

        {playing ? (
          <div className="relative z-10 flex min-h-0 flex-1 flex-col px-5 pb-4 pt-4 sm:px-10">
            <div className="mb-4 flex items-center gap-3">
              <button type="button" onClick={() => act("back")} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/85 hover:bg-white/20">
                <Glyph kind="circle" /> Back
              </button>
              <h2 className="min-w-0 truncate text-xl font-bold sm:text-3xl">{playing.title}</h2>
            </div>
            <div data-console-page className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
              {/* game boards shrink to fit the screen, keeping their shape */}
              <div className="mx-auto max-w-4xl pb-6 [&_canvas]:h-auto [&_canvas]:max-h-[52vh] [&_canvas]:w-auto [&_canvas]:max-w-full">{playing.id === "pong" ? <PongGame /> : <SnakeGame />}</div>
            </div>
          </div>
        ) : (
          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            <div className="flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-4 pt-5 [scrollbar-width:none] sm:gap-4 sm:px-10 sm:pt-8" role="listbox" aria-label="Games">
              {GAMES.map((g, i) => {
                const active = i === index;
                return (
                  <button
                    key={g.id}
                    ref={(el) => (tileRefs.current[i] = el)}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => (active ? launch(g) : setIndex(i))}
                    className={`relative grid shrink-0 snap-start place-items-center rounded-2xl transition-all duration-200 ${active ? "h-24 w-24 outline outline-[3px] outline-offset-4 outline-white sm:h-32 sm:w-32" : "mt-3 h-20 w-20 opacity-80 hover:opacity-100 sm:h-24 sm:w-24"}`}
                    style={{ background: `linear-gradient(145deg, ${g.art[0]}, ${g.art[1]})` }}
                  >
                    <g.icon className={active ? "h-10 w-10" : "h-8 w-8"} />
                    {g.site && <ExternalLink className="absolute right-2 top-2 h-3.5 w-3.5 opacity-70" />}
                    <span className="sr-only">{g.title}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto space-y-4 px-5 pb-6 sm:px-10 sm:pb-10">
              <h2 className="max-w-3xl text-3xl font-bold leading-tight sm:text-5xl" style={{ textWrap: "balance" }}>
                {sel.title}
              </h2>
              <p className="max-w-2xl text-base text-white/80 sm:text-lg">{sel.blurb}</p>
              {sel.site ? (
                <a href={sel.site} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-2.5 text-base font-semibold text-black hover:bg-white/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  Play <ExternalLink className="h-4 w-4" />
                </a>
              ) : (
                <button type="button" onClick={() => launch(sel)} className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-2.5 text-base font-semibold text-black hover:bg-white/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  Play
                </button>
              )}
            </div>
          </div>
        )}

        <footer className="relative z-10 flex flex-wrap items-center justify-end gap-x-5 gap-y-1 border-t border-white/10 bg-black/30 px-5 py-2 text-xs text-white/70 sm:px-10">
          {playing ? (
            <Hint glyph="circle">Back (Esc)</Hint>
          ) : (
            <>
              <Hint glyph="dpad">Move</Hint>
              <Hint glyph="cross">Play (Enter)</Hint>
              <Hint glyph="circle">Back to the room (Esc)</Hint>
            </>
          )}
          <span className="inline-flex items-center gap-1.5 text-white/45">
            <Gamepad2 className="h-3.5 w-3.5" /> Works with a PS5 controller
          </span>
        </footer>
      </div>
    </div>
  );
};

export default RoomConsole;
