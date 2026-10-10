import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Heart, Lock, Shovel, Star, Volume2, VolumeX } from "lucide-react";
import { Game, type LevelSpec } from "@/garden/engine";
import { GardenBoard, type BoardHandle } from "@/garden/GardenBoard";
import { drawFruit, drawPiece, drawWeed } from "@/garden/draw";
import { FRUIT_NAMES, GARDENS, gardenOf, goalText, levelSpec } from "@/garden/levels";
import { setMuted, sfx } from "@/garden/sound";

/*
 * Ma's Garden: a fruit-matching game made for Ma. A winding road of levels through seven gardens
 * (and on and on), each level with its goal: a score, weeds to clear, fruit to pick, or acorns to
 * bring down. Unlimited lives, nothing to buy, progress saved on the device.
 */

const SAVE_KEY = "mas-garden:v1";
type Save = { unlocked: number; stars: Record<number, number>; best: Record<number, number>; muted: boolean };
const freshSave = (): Save => ({ unlocked: 1, stars: {}, best: {}, muted: false });
const loadSave = (): Save => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return { ...freshSave(), ...JSON.parse(raw) };
  } catch {
    /* no storage: play without saving */
  }
  return freshSave();
};
const writeSave = (s: Save) => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* no storage */
  }
};

const FONT = 'Fredoka, "Baloo 2", "Trebuchet MS", system-ui, sans-serif';
const TROWELS = 3;

// ---------- small canvas icons ----------
type IconKind = { fruit: number } | { weed: true } | { acorn: true };
function Icon({ kind, size = 28 }: { kind: IconKind; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const m = size / 2;
    if ("fruit" in kind) drawFruit(ctx, kind.fruit, m, m, size);
    else if ("weed" in kind) drawWeed(ctx, m, m, size, 1);
    else drawPiece(ctx, { id: -1, color: -1, kind: "acorn" }, m, m, size, 0);
    // the kind is a fresh object each render; its contents are what matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(kind), size]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />;
}

/** what's left of the goal, as icons with counts */
function GoalChips({ spec, game, size = 28 }: { spec: LevelSpec; game?: Game; size?: number }) {
  const g = spec.goal;
  const p = game?.progress;
  const chip = (key: string, icon: React.ReactNode, left: number, label: string) => (
    <div key={key} className="flex items-center gap-1" title={label}>
      {icon}
      {left <= 0 ? <span className="text-lg font-bold text-[#3c9a3c]">✓</span> : <span className="text-lg font-bold tabular-nums">{left}</span>}
    </div>
  );
  if (g.type === "score") return chip("score", <Star className="text-[#f5b301]" fill="#f5b301" size={size * 0.8} />, Math.max(0, spec.stars[0] - (p?.score ?? 0)), "points to go");
  if (g.type === "weeds") {
    const total = spec.layout.join("").split("").reduce((s, ch) => s + (ch === "w" ? 1 : ch === "W" ? 2 : 0), 0);
    return chip("weeds", <Icon kind={{ weed: true }} size={size} />, p ? p.weedsLeft : total, "weeds left");
  }
  if (g.type === "acorns") return chip("acorns", <Icon kind={{ acorn: true }} size={size} />, g.count - (p?.acornsDown ?? 0), "acorns to bring down");
  return <>{g.items.map((it) => chip(`f${it.color}`, <Icon kind={{ fruit: it.color }} size={size} />, it.count - (p?.collected[it.color] ?? 0), FRUIT_NAMES[it.color]))}</>;
}

const Stars = ({ n, size = 16 }: { n: number; size?: number }) => (
  <div className="flex gap-0.5">
    {[0, 1, 2].map((i) => (
      <Star key={i} size={size} className={i < n ? "text-[#f5b301]" : "text-black/15"} fill={i < n ? "#f5b301" : "rgba(0,0,0,0.12)"} strokeWidth={1.5} />
    ))}
  </div>
);

const Button = ({ children, onClick, tone = "pink", className = "" }: { children: React.ReactNode; onClick: () => void; tone?: "pink" | "green" | "plain"; className?: string }) => {
  const tones = {
    pink: "bg-gradient-to-b from-[#ff7aa8] to-[#e8457d] text-white shadow-[0_4px_0_#b82a5c]",
    green: "bg-gradient-to-b from-[#7fd66b] to-[#45a83a] text-white shadow-[0_4px_0_#2f7d27]",
    plain: "bg-white text-[#7a4b2a] shadow-[0_4px_0_rgba(122,75,42,0.25)]",
  };
  return (
    <button onClick={onClick} className={`rounded-full px-6 py-3 text-lg font-bold transition-transform duration-100 active:translate-y-0.5 ${tones[tone]} ${className}`}>
      {children}
    </button>
  );
};

const Modal = ({ children }: { children: React.ReactNode }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 animate-in fade-in duration-200">
    <div className="w-full max-w-sm rounded-[28px] border-4 border-white bg-[#fff8ec] p-6 text-center text-[#5a3a1e] shadow-2xl animate-in zoom-in-95 duration-200">{children}</div>
  </div>
);

// ---------- the page ----------
type Phase = "map" | "intro" | "play" | "won" | "lost";

export default function MasGarden() {
  const [save, setSave] = useState<Save>(loadSave);
  const [phase, setPhase] = useState<Phase>("map");
  const [level, setLevel] = useState(save.unlocked);
  const [game, setGame] = useState<Game | null>(null);
  const [, setTick] = useState(0);
  const [trowel, setTrowel] = useState(false);
  const [trowels, setTrowels] = useState(TROWELS);
  const [rescued, setRescued] = useState(false);
  const [result, setResult] = useState({ stars: 0, score: 0, best: false });
  const [shownStars, setShownStars] = useState(0);
  const board = useRef<BoardHandle>(null);
  const ending = useRef(false);
  const spec = useMemo(() => levelSpec(level), [level]);
  const garden = gardenOf(level);

  const update = useCallback((fn: (s: Save) => Save) => {
    setSave((s) => {
      const next = fn(s);
      writeSave(next);
      return next;
    });
  }, []);

  useEffect(() => setMuted(save.muted), [save.muted]);

  // the page's own font, title and home-screen icon (so Ma can keep it on her phone like an app)
  useEffect(() => {
    const added: HTMLElement[] = [];
    const add = <T extends HTMLElement>(el: T) => {
      document.head.appendChild(el);
      added.push(el);
      return el;
    };
    const link = (rel: string, href: string) => Object.assign(add(document.createElement("link")), { rel, href });
    const meta = (name: string, content: string) => Object.assign(add(document.createElement("meta")), { name, content });
    link("stylesheet", "https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap");
    link("manifest", "/ma-manifest.json");
    link("apple-touch-icon", "/ma-icon.png");
    meta("apple-mobile-web-app-capable", "yes");
    meta("mobile-web-app-capable", "yes");
    meta("apple-mobile-web-app-title", "Ma's Garden");
    meta("apple-mobile-web-app-status-bar-style", "default");
    const theme = document.querySelector('meta[name="theme-color"]');
    const oldTheme = theme?.getAttribute("content");
    theme?.setAttribute("content", "#ffd9e2");
    const oldTitle = document.title;
    document.title = "Ma's Garden";
    return () => {
      added.forEach((el) => el.remove());
      document.title = oldTitle;
      if (theme && oldTheme) theme.setAttribute("content", oldTheme);
    };
  }, []);

  const openLevel = (n: number) => {
    sfx.tap();
    setLevel(n);
    setPhase("intro");
  };

  const start = () => {
    sfx.tap();
    ending.current = false;
    setGame(new Game(spec, Date.now() ^ (level * 7919)));
    setTrowel(false);
    setTrowels(TROWELS);
    setRescued(false);
    setPhase("play");
  };

  const win = async (g: Game) => {
    ending.current = true;
    sfx.win();
    if (g.progress.movesLeft > 0) await board.current?.bloom();
    const stars = Math.max(1, g.stars());
    const score = g.progress.score;
    const best = score > (save.best[level] ?? 0);
    update((s) => ({
      ...s,
      unlocked: Math.max(s.unlocked, level + 1),
      stars: { ...s.stars, [level]: Math.max(s.stars[level] ?? 0, stars) },
      best: { ...s.best, [level]: Math.max(s.best[level] ?? 0, score) },
    }));
    setResult({ stars, score, best });
    setShownStars(0);
    setPhase("won");
    for (let i = 0; i < stars; i++) {
      await new Promise((r) => setTimeout(r, 380));
      sfx.star(i);
      setShownStars(i + 1);
    }
  };

  const onSettled = () => {
    if (!game || ending.current) return;
    setTick((t) => t + 1);
    if (game.spec.goal.type !== "score" && game.goalDone()) void win(game);
    else if (game.progress.movesLeft <= 0) {
      if (game.isWon()) void win(game);
      else {
        ending.current = true;
        sfx.lose();
        setPhase("lost");
      }
    }
  };

  const rescue = () => {
    if (!game) return;
    game.progress.movesLeft += 5;
    ending.current = false;
    setRescued(true);
    setPhase("play");
    sfx.special();
  };

  const toMap = () => {
    sfx.tap();
    setPhase("map");
    setGame(null);
  };

  const toggleMute = () => update((s) => ({ ...s, muted: !s.muted }));
  const muteButton = (
    <button onClick={toggleMute} className="grid h-11 w-11 place-items-center rounded-full bg-white/80 text-[#7a4b2a] shadow" aria-label={save.muted ? "Turn sound on" : "Turn sound off"}>
      {save.muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
    </button>
  );

  const bg = `linear-gradient(180deg, ${garden.sky[0]} 0%, ${garden.sky[1]} 60%, ${garden.grass} 100%)`;

  return (
    <div className="fixed inset-0 select-none overflow-hidden text-[#5a3a1e]" style={{ fontFamily: FONT, background: bg }}>
      {phase === "map" || (phase === "intro" && !game) ? (
        <LevelMap save={save} onOpen={openLevel} muteButton={muteButton} />
      ) : (
        game && (
          <div className="mx-auto flex h-full max-w-[560px] flex-col px-3 pb-3 pt-[max(12px,env(safe-area-inset-top))]">
            {/* top bar: back, level, moves */}
            <div className="flex items-center gap-2">
              <button onClick={toMap} className="grid h-11 w-11 place-items-center rounded-full bg-white/80 shadow" aria-label="Back to the map">
                <ArrowLeft size={20} />
              </button>
              <div className="flex-1 text-center">
                <div className="text-xs font-semibold uppercase tracking-wider opacity-60">{garden.name}</div>
                <div className="text-xl font-bold leading-tight">Level {level}</div>
              </div>
              {muteButton}
            </div>
            <div className="mt-2 flex items-stretch gap-2">
              <div className="flex w-20 flex-col items-center justify-center rounded-2xl bg-white/85 py-1 shadow">
                <div className="text-[11px] font-semibold uppercase opacity-60">Moves</div>
                <div className={`text-3xl font-bold tabular-nums leading-none ${game.progress.movesLeft <= 5 ? "text-[#e8457d]" : ""}`}>{game.progress.movesLeft}</div>
              </div>
              <div className="flex flex-1 flex-col justify-center rounded-2xl bg-white/85 px-3 py-1.5 shadow">
                <div className="flex items-center justify-center gap-3">
                  <GoalChips spec={spec} game={game} />
                </div>
                <ScoreBar score={game.progress.score} stars={spec.stars} />
              </div>
            </div>
            {/* the board */}
            <div className="relative mt-2 min-h-0 flex-1">
              <GardenBoard
                ref={board}
                game={game}
                trowel={trowel}
                onTrowelUsed={() => {
                  setTrowel(false);
                  setTrowels((n) => n - 1);
                }}
                onPoints={() => setTick((t) => t + 1)}
                onMove={() => setTick((t) => t + 1)}
                onSettled={onSettled}
              />
            </div>
            {/* boosters */}
            <div className="mt-1 flex items-center justify-center gap-3">
              <button
                onClick={() => trowels > 0 && setTrowel((v) => !v)}
                disabled={trowels <= 0}
                className={`flex items-center gap-2 rounded-full px-4 py-2 font-bold shadow transition-colors duration-150 ${trowel ? "bg-[#ffd54a] text-[#5a3a1e]" : "bg-white/85"} disabled:opacity-40`}
                aria-pressed={trowel}
              >
                <Shovel size={18} /> Trowel <span className="rounded-full bg-[#e8457d] px-2 text-sm text-white">{trowels}</span>
              </button>
              {trowel && <span className="text-sm font-semibold">Tap any fruit to dig it up</span>}
            </div>
          </div>
        )
      )}

      {phase === "intro" && (
        <Modal>
          <div className="text-sm font-semibold uppercase tracking-wider opacity-60">{gardenOf(level).name}</div>
          <h2 className="text-3xl font-bold">Level {level}</h2>
          <div className="my-3 flex justify-center">
            <Stars n={save.stars[level] ?? 0} size={26} />
          </div>
          <div className="mx-auto mb-4 flex justify-center gap-4 rounded-2xl bg-white p-3">
            <GoalChips spec={spec} size={34} />
          </div>
          <p className="mb-5 text-lg leading-snug">{goalText(spec)}</p>
          <div className="flex justify-center gap-3">
            <Button tone="plain" onClick={() => (game ? setPhase("play") : setPhase("map"))}>
              Back
            </Button>
            <Button tone="green" onClick={start}>
              Play!
            </Button>
          </div>
        </Modal>
      )}

      {phase === "won" && (
        <Modal>
          <h2 className="text-3xl font-bold text-[#e8457d]">{["Lovely!", "Lovely!", "Wonderful!", "Perfect, Ma!"][result.stars]}</h2>
          <div className="my-4 flex justify-center">
            <Stars n={shownStars} size={44} />
          </div>
          <div className="text-sm font-semibold uppercase opacity-60">Score</div>
          <div className="text-3xl font-bold tabular-nums">{result.score.toLocaleString()}</div>
          {result.best && (save.best[level] ?? 0) > 0 && <div className="mt-1 text-sm font-semibold text-[#3c9a3c]">A new best!</div>}
          <div className="mt-5 flex justify-center gap-3">
            <Button tone="plain" onClick={toMap}>
              Map
            </Button>
            <Button
              tone="green"
              onClick={() => {
                setGame(null);
                openLevel(level + 1);
              }}
            >
              Next level
            </Button>
          </div>
        </Modal>
      )}

      {phase === "lost" && game && (
        <Modal>
          <h2 className="text-3xl font-bold">So close!</h2>
          <div className="mx-auto my-4 flex justify-center gap-4 rounded-2xl bg-white p-3">
            <GoalChips spec={spec} game={game} size={34} />
          </div>
          {!rescued ? (
            <>
              <p className="mb-4 text-lg">Want 5 more moves? They're free.</p>
              <div className="flex flex-col items-center gap-3">
                <Button tone="green" onClick={rescue}>
                  +5 moves
                </Button>
                <div className="flex gap-3">
                  <Button tone="plain" onClick={toMap}>
                    Map
                  </Button>
                  <Button tone="pink" onClick={start}>
                    Try again
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="mb-4 text-lg">Every garden takes a few tries. Have another go!</p>
              <div className="flex justify-center gap-3">
                <Button tone="plain" onClick={toMap}>
                  Map
                </Button>
                <Button tone="pink" onClick={start}>
                  Try again
                </Button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function ScoreBar({ score, stars }: { score: number; stars: [number, number, number] }) {
  const max = stars[2];
  const pct = Math.min(100, (score / max) * 100);
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="relative h-3 flex-1 rounded-full bg-black/10">
        <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#ffb3cb] to-[#e8457d] transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
        {stars.map((s, i) => (
          <Star key={i} size={14} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${Math.min(97, (s / max) * 100)}%` }} fill={score >= s ? "#f5b301" : "#fff"} color={score >= s ? "#c98a00" : "#bba"} />
        ))}
      </div>
      <div className="w-16 text-right text-sm font-bold tabular-nums">{score.toLocaleString()}</div>
    </div>
  );
}

// ---------- the map: a winding road, level 1 at the bottom ----------
function LevelMap({ save, onOpen, muteButton }: { save: Save; onOpen: (n: number) => void; muteButton: React.ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const shown = Math.ceil((save.unlocked + 10) / 10) * 10;
  const gardens = Array.from({ length: shown / 10 }, (_, i) => i);
  const totalStars = Object.values(save.stars).reduce((a, b) => a + b, 0);

  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-level="${save.unlocked}"]`);
    el?.scrollIntoView({ block: "center" });
  }, [save.unlocked]);

  return (
    <div className="flex h-full flex-col">
      <header className="z-10 flex items-center gap-3 bg-white/70 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] shadow-sm backdrop-blur">
        <div className="flex-1">
          <h1 className="text-2xl font-bold leading-none text-[#e8457d]">Ma's Garden</h1>
          <div className="mt-1 text-xs font-semibold opacity-70">
            Made with <Heart size={11} className="inline -translate-y-px text-[#e8457d]" fill="#e8457d" /> for Ma
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 font-bold shadow">
          <Star size={18} className="text-[#f5b301]" fill="#f5b301" /> {totalStars}
        </div>
        {muteButton}
      </header>
      <div ref={scroller} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-md flex-col-reverse pb-10">
          {gardens.map((gi) => {
            const g = GARDENS[gi % GARDENS.length];
            const levels = Array.from({ length: 10 }, (_, i) => gi * 10 + i + 1);
            return (
              <section key={gi} className="relative" style={{ background: `linear-gradient(0deg, ${g.sky[1]}, ${g.sky[0]})` }}>
                <div className="flex flex-col-reverse py-4">
                  {levels.map((n) => {
                    const x = 50 + Math.sin(n * 0.9) * 28;
                    const locked = n > save.unlocked;
                    const current = n === save.unlocked;
                    const heart = n % 10 === 0;
                    return (
                      <div key={n} className="relative h-[76px]">
                        {/* the path to the next level */}
                        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 76" preserveAspectRatio="none" aria-hidden>
                          <path d={`M ${x} 38 L ${50 + Math.sin((n + 1) * 0.9) * 28} -38`} stroke="rgba(160,110,60,0.35)" strokeWidth="14" strokeLinecap="round" vectorEffect="non-scaling-stroke" fill="none" />
                        </svg>
                        <button
                          data-level={n}
                          disabled={locked}
                          onClick={() => onOpen(n)}
                          className={`absolute top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 font-bold transition-transform duration-150 active:scale-95 ${
                            locked ? "h-12 w-12 border-white/70 bg-[#d9cfc4] text-white" : current ? "h-16 w-16 border-white bg-gradient-to-b from-[#ff7aa8] to-[#e8457d] text-2xl text-white shadow-[0_4px_0_#b82a5c]" : "h-14 w-14 border-white bg-gradient-to-b from-[#7fd66b] to-[#45a83a] text-xl text-white shadow-[0_4px_0_#2f7d27]"
                          } ${heart && !locked ? "rounded-[40%]" : ""}`}
                          style={{ left: `${x}%` }}
                          aria-label={locked ? `Level ${n}, locked` : `Level ${n}${save.stars[n] ? `, ${save.stars[n]} stars` : ""}`}
                        >
                          {locked ? <Lock size={18} /> : heart ? <Heart size={current ? 30 : 26} fill="white" className="absolute opacity-25" /> : null}
                          {!locked && <span className="relative">{n}</span>}
                          {current && <span className="absolute -inset-2 animate-ping rounded-full border-4 border-[#ff7aa8] opacity-40 motion-reduce:animate-none" />}
                          {!locked && save.stars[n] ? (
                            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2">
                              <Stars n={save.stars[n]} size={13} />
                            </span>
                          ) : null}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="sticky top-0 py-2 text-center">
                  <span className="rounded-full bg-white/85 px-4 py-1.5 text-sm font-bold shadow">{g.name}</span>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
