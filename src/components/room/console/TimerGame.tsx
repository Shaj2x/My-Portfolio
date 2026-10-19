import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Crown, EyeOff, Minus, Plus, Timer, Trophy, Zap } from "lucide-react";
import { sfx } from "@/components/gameSound";

/*
 * Stop the Clock: a party timer game for the console.
 *
 * Target: the screen shows a goal time (random between two numbers you pick, or one you choose);
 * start the clock and stop it as close to the goal as you can. On Blink the clock shows for the
 * first second and a half and then hides; on Blind it's hidden from the start. Guess: one player
 * runs the clock in secret, then everyone guesses how long it ran. Closest wins, in both.
 *
 * One to six players take turns on the same device, over three, five or ten rounds. Points are
 * for accuracy (1000 for dead on, easing off the further away), with a bonus for a perfect stop. Space,
 * Enter or ✕ on a controller starts and stops the clock. Personal bests stay on this device.
 */

type Mode = "target" | "guess";
type Level = "blink" | "blind";
type Player = { name: string; color: string };
type Turn = { player: number; goal?: number; time: number; guess?: number; error: number; points: number };

const COLORS = ["#f5c46b", "#5fd4e6", "#f27a9b", "#8ee07a", "#b49bff", "#ff9a5a"];
const LEVELS: { id: Level; label: string; hint: string; icon: typeof EyeOff }[] = [
  { id: "blink", label: "Blink", hint: "it shows for 1.5 s, then hides", icon: Zap },
  { id: "blind", label: "Blind", hint: "hidden from the start", icon: EyeOff },
];
const BEST_KEY = "timer-game:best";
const BLINK_MS = 1500;
const MAX_MS = 120000;
/** the longest goal you can set, in seconds */
const MAX_GOAL = 99;

const fmt = (ms: number) => (ms / 1000).toFixed(2);
// 1000 for dead on, easing off the further away (0.1 s ≈ 870, 0.5 s ≈ 490, 1.5 s ≈ 120), and a
// bonus for a perfect stop
const pointsFor = (errorMs: number) => Math.round(1000 * Math.exp(-errorMs / 700)) + (errorMs <= 10 ? 500 : 0);
/** a goal between two times (in seconds), to the tenth */
const randomGoal = (lo = 3, hi = 10) => {
  const a = Math.round(Math.min(lo, hi) * 10);
  const b = Math.round(Math.max(lo, hi) * 10);
  return (a + Math.floor(Math.random() * (b - a + 1))) * 100;
};
const VERDICTS = [
  { max: 10, word: "PERFECT!", emoji: "🎯" },
  { max: 50, word: "Incredible", emoji: "🔥" },
  { max: 150, word: "So close", emoji: "😮" },
  { max: 400, word: "Not bad", emoji: "👍" },
  { max: 1000, word: "A bit off", emoji: "😅" },
  { max: Infinity, word: "Way off", emoji: "🙈" },
];
const verdictOf = (errorMs: number) => VERDICTS.find((v) => errorMs <= v.max)!;
/** a number typed into a box, kept to a sensible goal */
const clampSec = (v: number) => Math.min(MAX_GOAL, Math.max(1, Math.round(v * 10) / 10 || 1));

const loadBest = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) ?? "{}");
  } catch {
    return {};
  }
};

export default function TimerGame() {
  const [screen, setScreen] = useState<"menu" | "play" | "results">("menu");
  const [mode, setMode] = useState<Mode>("target");
  const [level, setLevel] = useState<Level>("blink");
  const [rounds, setRounds] = useState(5);
  // the goal: random between two numbers you pick, or the one you set
  const [goalKind, setGoalKind] = useState<"random" | "exact">("random");
  const [range, setRange] = useState<[number, number]>([3, 10]);
  const [exact, setExact] = useState(7);
  const makeGoal = () => (goalKind === "exact" ? Math.round(exact * 1000) : randomGoal(range[0], range[1]));
  const [players, setPlayers] = useState<Player[]>([{ name: "You", color: COLORS[0] }]);
  const [best, setBest] = useState(loadBest);
  const reduce = useReducedMotion();

  // the game in progress
  const [round, setRound] = useState(0);
  const [turn, setTurn] = useState(0);
  const [goal, setGoal] = useState(randomGoal);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [phase, setPhase] = useState<"ready" | "running" | "reveal" | "guessing" | "roundEnd">("ready");
  const [elapsed, setElapsed] = useState(0);
  const [guesses, setGuesses] = useState<string[]>([]);
  const startedAt = useRef(0);
  const raf = useRef(0);
  const stoppedAt = useRef(0);

  const current = players[turn];
  const runner = round % players.length; // in Guess, who runs the clock this round
  const roundTurns = turns.filter((t) => Math.floor(turns.indexOf(t) / players.length) === round);

  const begin = () => {
    sfx("start");
    setRound(0);
    setTurn(0);
    setTurns([]);
    setGoal(makeGoal());
    setPhase("ready");
    setElapsed(0);
    setScreen("play");
  };

  // ---------- the clock ----------
  const tick = useCallback(() => {
    const ms = performance.now() - startedAt.current;
    setElapsed(ms);
    if (ms >= MAX_MS) stop();
    else raf.current = requestAnimationFrame(tick);
    // stop is defined below; it reads the latest state through a ref
  }, []);

  const start = () => {
    sfx("blip");
    startedAt.current = performance.now();
    setElapsed(0);
    setPhase("running");
    raf.current = requestAnimationFrame(tick);
  };

  const stopRef = useRef<() => void>(() => {});
  const stop = () => stopRef.current();
  stopRef.current = () => {
    cancelAnimationFrame(raf.current);
    const ms = Math.min(MAX_MS, performance.now() - startedAt.current);
    stoppedAt.current = ms;
    setElapsed(ms);
    if (mode === "target") {
      const error = Math.abs(ms - goal);
      const points = pointsFor(error);
      sfx(error <= 10 ? "fanfare" : error <= 150 ? "coin" : error <= 1000 ? "point" : "miss");
      setTurns((t) => [...t, { player: turn, goal, time: ms, error, points }]);
      // a personal best for this level
      const key = `target-${level}`;
      if (best[key] === undefined || error < best[key]) {
        const next = { ...best, [key]: Math.round(error) };
        setBest(next);
        try {
          localStorage.setItem(BEST_KEY, JSON.stringify(next));
        } catch {
          // not kept
        }
      }
      setPhase("reveal");
    } else {
      sfx("blip");
      setGuesses(players.map(() => ""));
      setPhase("guessing");
    }
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const next = () => {
    sfx("blip");
    if (mode === "target" && turn + 1 < players.length) {
      setTurn(turn + 1);
      setPhase("ready");
      setElapsed(0);
      return;
    }
    // with company, each round ends on a little leaderboard (on your own, straight on)
    if (phase !== "roundEnd" && players.length > 1) {
      setPhase("roundEnd");
      return;
    }
    if (round + 1 >= rounds) {
      sfx("win");
      setScreen("results");
      return;
    }
    setRound(round + 1);
    setTurn(mode === "guess" ? (round + 1) % players.length : 0);
    setGoal(makeGoal());
    setElapsed(0);
    setPhase("ready");
  };

  const submitGuesses = () => {
    const time = stoppedAt.current;
    const made: Turn[] = players.map((_, i) => {
      const g = Math.max(0, parseFloat(guesses[i] || "0") * 1000 || 0);
      const error = Math.abs(g - time);
      return { player: i, time, guess: g, error, points: pointsFor(error) };
    });
    const bestErr = Math.min(...made.map((m) => m.error));
    sfx(bestErr <= 150 ? "coin" : "point");
    setTurns((t) => [...t, ...made]);
    setPhase("roundEnd");
  };

  // Space or Enter (and ✕ on a controller, which the console sends as Space) starts and stops
  // the clock, and moves on between turns
  const keyRef = useRef<() => void>(() => {});
  keyRef.current = () => {
    if (screen === "menu") return begin();
    if (screen === "results") return setScreen("menu");
    if (phase === "ready") start();
    else if (phase === "running") stop();
    else if (phase === "reveal" || phase === "roundEnd") next();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Enter") return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      // a focused button handles its own Enter/Space
      if (el && el.tagName === "BUTTON") return;
      e.preventDefault();
      keyRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // totals so far, per player
  const totals = useMemo(() => players.map((_, i) => turns.filter((t) => t.player === i).reduce((s, t) => s + t.points, 0)), [players, turns]);
  const ranking = useMemo(() => players.map((p, i) => ({ ...p, i, total: totals[i] })).sort((a, b) => b.total - a.total), [players, totals]);

  // ---------- menu ----------
  if (screen === "menu") {
    const pbKey = `target-${level}`;
    return (
      <Shell>
        <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
          <div className="text-center">
            <Timer className="mx-auto h-10 w-10 text-[#5fd4e6]" aria-hidden="true" />
            <h3 className="mt-2 text-3xl font-bold tracking-tight">Stop the Clock</h3>
            <p className="mt-1 text-sm text-white/60">How good is your internal clock?</p>
          </div>

          <Segmented
            label="Mode"
            value={mode}
            onChange={(m) => setMode(m as Mode)}
            options={[
              { id: "target", label: "Hit the target", hint: "Stop the clock on a goal time" },
              { id: "guess", label: "Guess the time", hint: "One runs it secretly, everyone guesses" },
            ]}
          />
          {mode === "target" && (
            <>
              <Segmented label="Difficulty" value={level} onChange={(l) => setLevel(l as Level)} options={LEVELS.map((l) => ({ id: l.id, label: l.label, hint: l.hint }))} />
              <div>
                <Segmented
                  label="Target"
                  value={goalKind}
                  onChange={(k) => setGoalKind(k as "random" | "exact")}
                  options={[
                    { id: "random", label: "Random", hint: "a surprise between two times" },
                    { id: "exact", label: "My own", hint: "the same time every round" },
                  ]}
                />
                <div className="mt-3 flex flex-wrap items-center justify-center gap-3 rounded-2xl bg-white/[0.04] p-3">
                  {goalKind === "random" ? (
                    <>
                      <span className="text-sm text-white/60">between</span>
                      <Stepper value={range[0]} onChange={(v) => setRange([v, Math.max(v, range[1])])} label="Shortest goal" />
                      <span className="text-sm text-white/60">and</span>
                      <Stepper value={range[1]} onChange={(v) => setRange([Math.min(v, range[0]), v])} label="Longest goal" />
                      <span className="text-sm text-white/60">seconds</span>
                    </>
                  ) : (
                    <>
                      <Stepper value={exact} onChange={setExact} label="Goal time" big />
                      <span className="text-sm text-white/60">seconds</span>
                      <div className="flex w-full justify-center gap-2">
                        {[5, 10, 15, 30].map((n) => (
                          <button key={n} type="button" onClick={() => setExact(n)} className={`rounded-full px-3 py-1 text-sm transition-colors duration-150 ${exact === n ? "bg-[#5fd4e6] font-semibold text-[#04232a]" : "bg-white/10 hover:bg-white/20"}`}>
                            {n}s
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
          <Segmented label="Rounds" value={String(rounds)} onChange={(r) => setRounds(Number(r))} options={["3", "5", "10"].map((r) => ({ id: r, label: r }))} />

          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-white/50">Players</p>
            <div className="flex flex-col gap-2">
              {players.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden="true" />
                  <input
                    value={p.name}
                    maxLength={14}
                    onChange={(e) => setPlayers((ps) => ps.map((q, j) => (j === i ? { ...q, name: e.target.value } : q)))}
                    aria-label={`Player ${i + 1} name`}
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-white outline-none focus:border-white/40"
                  />
                  {players.length > 1 && (
                    <button type="button" aria-label={`Remove ${p.name || `player ${i + 1}`}`} onClick={() => setPlayers((ps) => ps.filter((_, j) => j !== i))} className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white">
                      <Minus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {players.length < 6 && (
                <button
                  type="button"
                  onClick={() => setPlayers((ps) => [...ps, { name: `Player ${ps.length + 1}`, color: COLORS[ps.length % COLORS.length] }])}
                  className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <Plus className="h-4 w-4" /> Add a player
                </button>
              )}
            </div>
          </div>

          <button type="button" data-timer-main onClick={begin} className="rounded-full bg-[#5fd4e6] py-3 text-lg font-bold text-[#04232a] transition-transform duration-100 active:scale-[0.98]">
            Play
          </button>
          {mode === "target" && best[pbKey] !== undefined && (
            <p className="text-center text-sm text-white/55">
              Your best on {LEVELS.find((l) => l.id === level)!.label}: off by {fmt(best[pbKey])} s
            </p>
          )}
        </div>
      </Shell>
    );
  }

  // ---------- results ----------
  if (screen === "results") {
    const closest = [...turns].sort((a, b) => a.error - b.error)[0];
    return (
      <Shell>
        <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-5 text-center" aria-live="polite">
          <Trophy className="h-12 w-12 text-[#f5c46b]" aria-hidden="true" />
          <h3 className="text-3xl font-bold">{players.length > 1 ? `${ranking[0].name || "Player"} wins!` : `${ranking[0].total.toLocaleString()} points`}</h3>
          <ol className="w-full space-y-2">
            {ranking.map((p, place) => (
              <li key={p.i} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${place === 0 ? "bg-white/[0.12]" : "bg-white/[0.05]"}`}>
                <span className="w-6 text-lg font-bold text-white/60">{place + 1}</span>
                <span className="h-3 w-3 rounded-full" style={{ background: p.color }} aria-hidden="true" />
                <span className="flex-1 truncate text-left font-semibold">{p.name || `Player ${p.i + 1}`}</span>
                {place === 0 && players.length > 1 && <Crown className="h-4 w-4 text-[#f5c46b]" aria-label="Winner" />}
                <span className="font-mono tabular-nums">{p.total.toLocaleString()}</span>
              </li>
            ))}
          </ol>
          {closest && (
            <p className="text-sm text-white/60">
              Closest of the game: {players[closest.player].name || "a player"}, off by just {fmt(closest.error)} s
            </p>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={() => setScreen("menu")} className="rounded-full bg-white/10 px-6 py-2.5 font-semibold hover:bg-white/20">
              Menu
            </button>
            <button type="button" data-timer-main onClick={begin} className="rounded-full bg-[#5fd4e6] px-6 py-2.5 font-bold text-[#04232a]">
              Play again
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // ---------- playing ----------
  const visible = mode === "target" && level === "blink" && elapsed < BLINK_MS;
  const showDigits = phase === "reveal" || phase === "roundEnd" || (phase === "running" && visible) || phase === "ready";
  const last = turns[turns.length - 1];
  const ringGoal = mode === "target" ? goal : 10000;
  const progress = Math.min(1, elapsed / ringGoal);
  const who = mode === "guess" ? players[runner] : current;
  // this player's run of close stops (within 0.15 s), counting the latest
  let streak = 0;
  if (mode === "target" && last)
    for (let i = turns.length - 1; i >= 0; i--) {
      const t = turns[i];
      if (t.player !== last.player) continue;
      if (t.error > 150) break;
      streak++;
    }

  return (
    <Shell>
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
        {/* the scoreboard */}
        <div className="flex items-center justify-between gap-3 text-sm text-white/60">
          <span>
            Round {round + 1} of {rounds}
          </span>
          <div className="flex flex-wrap justify-end gap-x-4 gap-y-1">
            {players.map((p, i) => (
              <span key={i} className={`flex items-center gap-1.5 ${(mode === "target" ? turn : runner) === i && phase !== "roundEnd" ? "text-white" : ""}`}>
                <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden="true" />
                {players.length > 1 && <span className="max-w-[7rem] truncate">{p.name || `P${i + 1}`}</span>}
                <span className="font-mono tabular-nums">{totals[i].toLocaleString()}</span>
              </span>
            ))}
          </div>
        </div>

        {phase === "guessing" ? (
          <GuessForm players={players} guesses={guesses} setGuesses={setGuesses} onSubmit={submitGuesses} />
        ) : phase === "roundEnd" ? (
          <RoundSummary players={players} turns={roundTurns} mode={mode} onNext={next} lastRound={round + 1 >= rounds} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 py-4">
            <p className="text-center text-sm text-white/70">
              {players.length > 1 && (
                <span className="font-semibold" style={{ color: who.color }}>
                  {who.name || "Player"}
                  {mode === "guess" ? " runs the clock" : "'s turn"} ·{" "}
                </span>
              )}
              {mode === "target" ? (
                <>
                  Stop at <span className="font-mono text-lg font-bold text-white">{fmt(goal)}</span> s
                </>
              ) : (
                "Start, wait as long as you like, then stop. Nobody sees the time."
              )}
            </p>

            {/* the clock: a ring that fills toward the goal, with the time in the middle */}
            <motion.div
              key={`clock-${turns.length}`}
              className={`relative aspect-square w-[min(60vw,260px)] rounded-full ${phase === "running" && !visible ? "timer-glow" : ""}`}
              style={{ ["--glow" as string]: who.color }}
              animate={!reduce && phase === "reveal" && last && last.error > 1000 ? { x: [0, -12, 10, -8, 6, -3, 0] } : { x: 0 }}
              transition={{ duration: 0.45 }}
            >
              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke={who.color}
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 44}`}
                  strokeDashoffset={`${2 * Math.PI * 44 * (1 - (showDigits || phase !== "running" ? (phase === "ready" ? 0 : progress) : 0))}`}
                  style={{ transition: phase === "running" ? "none" : "stroke-dashoffset 400ms cubic-bezier(0.23,1,0.32,1)", opacity: phase === "running" && !visible ? 0 : 1 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {phase === "running" && !visible ? (
                  <span className="animate-pulse font-mono text-5xl font-bold tracking-tight text-white/25 motion-reduce:animate-none">?.??</span>
                ) : (
                  <span className="font-mono text-5xl font-bold tabular-nums tracking-tight sm:text-6xl">{fmt(phase === "ready" ? 0 : elapsed)}</span>
                )}
                <span className="mt-1 text-xs uppercase tracking-[0.2em] text-white/40">seconds</span>
              </div>
            </motion.div>

            {phase === "reveal" && last && <Reveal key={turns.length} turn={last} color={who.color} streak={streak} />}

            <motion.button
              type="button"
              data-timer-main
              onClick={() => keyRef.current()}
              whileTap={reduce ? undefined : { scale: 0.9 }}
              whileHover={reduce ? undefined : { scale: 1.04 }}
              transition={{ type: "spring", bounce: 0.5, duration: 0.3 }}
              className={`h-20 w-48 rounded-full text-xl font-bold tracking-wide shadow-[0_8px_30px_-8px_currentColor] transition-colors duration-150 ${
                phase === "running" ? "bg-[#f27a9b] text-[#2a0710]" : "bg-[#5fd4e6] text-[#04232a]"
              }`}
            >
              {phase === "ready" ? "START" : phase === "running" ? "STOP" : turn + 1 < players.length && mode === "target" ? "Next player" : "Next"}
            </motion.button>
            <p className="text-xs text-white/40">Space or Enter · ✕ on a controller</p>
          </div>
        )}
      </div>
    </Shell>
  );
}

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="h-full w-full overflow-y-auto rounded-2xl bg-[radial-gradient(ellipse_at_top,#0d3a44_0%,#061a20_55%,#030b0e_100%)] p-5 text-white sm:p-8">{children}</div>
);

const Segmented = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { id: string; label: string; hint?: string }[] }) => (
  <div>
    <p className="mb-2 text-xs uppercase tracking-[0.18em] text-white/50">{label}</p>
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-2xl border px-3 py-2.5 text-left transition-colors duration-150 ${value === o.id ? "border-[#5fd4e6] bg-[#5fd4e6]/15" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"}`}
        >
          <span className="block font-semibold">{o.label}</span>
          {o.hint && <span className="block text-xs text-white/55">{o.hint}</span>}
        </button>
      ))}
    </div>
  </div>
);

const GuessForm = ({ players, guesses, setGuesses, onSubmit }: { players: Player[]; guesses: string[]; setGuesses: (g: string[]) => void; onSubmit: () => void }) => {
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <form
      className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-3 py-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <p className="text-center text-xl font-bold">How long did it run?</p>
      <p className="mb-2 text-center text-sm text-white/60">Everyone guesses, in seconds.</p>
      {players.map((p, i) => (
        <label key={i} className="flex items-center gap-3">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden="true" />
          <span className="w-28 truncate text-sm">{p.name || `Player ${i + 1}`}</span>
          <input
            ref={i === 0 ? first : undefined}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={guesses[i]}
            onChange={(e) => setGuesses(guesses.map((g, j) => (j === i ? e.target.value : g)))}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 font-mono text-white outline-none focus:border-white/40"
          />
        </label>
      ))}
      <button type="submit" className="mt-2 rounded-full bg-[#5fd4e6] py-3 font-bold text-[#04232a]">
        Reveal the time
      </button>
    </form>
  );
};

const RoundSummary = ({ players, turns, mode, onNext, lastRound }: { players: Player[]; turns: Turn[]; mode: Mode; onNext: () => void; lastRound: boolean }) => {
  const sorted = [...turns].sort((a, b) => a.error - b.error);
  const actual = turns[0]?.time ?? 0;
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 py-6" aria-live="polite">
      <p className="text-center text-xl font-bold">{mode === "guess" ? `It ran for ${fmt(actual)} s` : `Target ${fmt(turns[0]?.goal ?? 0)} s`}</p>
      <ol className="space-y-2">
        {sorted.map((t, place) => (
          <li key={t.player} className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 ${place === 0 ? "bg-white/[0.12]" : "bg-white/[0.05]"}`}>
            <span className="h-3 w-3 rounded-full" style={{ background: players[t.player].color }} aria-hidden="true" />
            <span className="flex-1 truncate">{players[t.player].name || `Player ${t.player + 1}`}</span>
            {place === 0 && players.length > 1 && <Crown className="h-4 w-4 text-[#f5c46b]" aria-label="Closest" />}
            <span className="font-mono text-sm text-white/70 tabular-nums">{fmt(mode === "guess" ? t.guess ?? 0 : t.time)} s</span>
            <span className="w-16 text-right font-mono text-sm tabular-nums">+{t.points}</span>
          </li>
        ))}
      </ol>
      <button type="button" data-timer-main onClick={onNext} className="mt-2 rounded-full bg-[#5fd4e6] py-3 font-bold text-[#04232a]">
        {lastRound ? "See the results" : "Next round"}
      </button>
    </div>
  );
};

/** a number of seconds with − and + either side (half a second a step), and typeable */
const Stepper = ({ value, onChange, label, big = false }: { value: number; onChange: (v: number) => void; label: string; big?: boolean }) => {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = (v: string) => onChange(clampSec(parseFloat(v)));
  return (
    <div className="flex items-center gap-1 rounded-full bg-white/[0.06] p-1">
      <button type="button" aria-label={`${label}: half a second less`} onClick={() => onChange(clampSec(value - 0.5))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/15 active:scale-90">
        <Minus className="h-4 w-4" />
      </button>
      <input
        aria-label={label}
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && commit((e.target as HTMLInputElement).value)}
        className={`bg-transparent text-center font-mono font-bold text-white outline-none ${big ? "w-20 text-3xl" : "w-12 text-lg"}`}
      />
      <button type="button" aria-label={`${label}: half a second more`} onClick={() => onChange(clampSec(value + 0.5))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/15 active:scale-90">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
};

const CONFETTI = ["#f5c46b", "#5fd4e6", "#f27a9b", "#8ee07a", "#b49bff", "#ffffff"];

/** the result of a stop: a big emoji, the verdict, an early/late meter, and confetti for close calls */
const Reveal = ({ turn, color, streak }: { turn: Turn; color: string; streak: number }) => {
  const reduce = useReducedMotion();
  const v = verdictOf(turn.error);
  const signed = turn.time - (turn.goal ?? 0);
  // the meter runs from a second early to a second late
  const at = Math.max(-1, Math.min(1, signed / 1000));
  const pieces = useMemo(
    () =>
      Array.from({ length: turn.error <= 10 ? 70 : 36 }, (_, i) => ({
        angle: (i / 36) * Math.PI * 2 + Math.random() * 0.5,
        dist: 120 + Math.random() * 160,
        spin: (Math.random() - 0.5) * 720,
        color: CONFETTI[i % CONFETTI.length],
        delay: Math.random() * 0.08,
      })),
    [turn.error],
  );
  return (
    <div className="relative flex w-full max-w-sm flex-col items-center gap-2 text-center" aria-live="polite">
      {!reduce && turn.error <= 150 && (
        <div className="pointer-events-none absolute left-1/2 top-6" aria-hidden="true">
          {pieces.map((p, i) => (
            <motion.span
              key={i}
              className="absolute block h-2.5 w-1.5 rounded-[2px]"
              style={{ background: p.color }}
              initial={{ transform: "translate(0px, 0px) rotate(0deg)", opacity: 1 }}
              animate={{ transform: `translate(${Math.cos(p.angle) * p.dist}px, ${Math.sin(p.angle) * p.dist + 80}px) rotate(${p.spin}deg)`, opacity: 0 }}
              transition={{ duration: 1.3, delay: p.delay, ease: [0.23, 1, 0.32, 1] }}
            />
          ))}
        </div>
      )}
      <motion.span
        className="text-5xl"
        initial={reduce ? { opacity: 0 } : { transform: "scale(0.4) rotate(-20deg)", opacity: 0 }}
        animate={{ transform: "scale(1) rotate(0deg)", opacity: 1 }}
        transition={{ type: "spring", bounce: 0.55, duration: 0.5 }}
        aria-hidden="true"
      >
        {v.emoji}
      </motion.span>
      <p className={`text-2xl font-bold ${turn.error <= 10 ? "text-[#f5c46b]" : "text-white"}`}>{v.word}</p>
      {/* early or late, and by how much */}
      <div className="w-full">
        <div className="relative h-3 rounded-full bg-gradient-to-r from-[#5fd4e6]/30 via-white/10 to-[#f27a9b]/30">
          <span className="absolute left-1/2 top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-white/70" aria-hidden="true" />
          <motion.span
            className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-white shadow-lg"
            style={{ background: color }}
            initial={{ left: "calc(50% - 10px)" }}
            animate={{ left: `calc(${50 + at * 50}% - 10px)` }}
            transition={reduce ? { duration: 0 } : { type: "spring", bounce: 0.35, duration: 0.8, delay: 0.15 }}
            aria-hidden="true"
          />
        </div>
        <div className="mt-1 flex justify-between text-[11px] uppercase tracking-[0.16em] text-white/40">
          <span>early</span>
          <span>target</span>
          <span>late</span>
        </div>
      </div>
      <p className="text-sm text-white/60">
        {Math.abs(signed) < 5 ? "Right on it" : `${fmt(Math.abs(signed))} s ${signed > 0 ? "late" : "early"}`} · <span className="font-semibold text-white">+{turn.points}</span> points
      </p>
      {streak >= 2 && (
        <motion.p initial={{ transform: "scale(0.8)", opacity: 0 }} animate={{ transform: "scale(1)", opacity: 1 }} className="rounded-full bg-[#f5c46b]/15 px-3 py-1 text-sm font-semibold text-[#f5c46b]">
          🔥 {streak} in a row
        </motion.p>
      )}
    </div>
  );
};
