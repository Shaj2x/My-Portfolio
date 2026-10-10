import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import type { Game, Piece, Pos, Progress, Snap, Step } from "./engine";
import { drawBasket, drawHedge, drawPiece, drawVine, drawWeed, JUICE, roundRect } from "./draw";
import { sfx } from "./sound";

/*
 * The board: draws the garden bed and its fruit on a canvas, takes swipes and taps, and plays each
 * move's steps as animation (the swap, the pops and splashes, the effects, the fall and refill).
 */

export interface BoardHandle {
  /** plays the end-of-level bloom; resolves when it has finished */
  bloom: () => Promise<void>;
}

interface Props {
  game: Game;
  /** the trowel booster is armed: the next tap clears one fruit */
  trowel: boolean;
  onTrowelUsed: () => void;
  /** the score and goal counters as each step plays (the engine works a move out ahead of the animation) */
  onProgress: (progress: Progress) => void;
  /** a move has finished playing out */
  onSettled: () => void;
  /** a move started (it used up a move) */
  onMove: () => void;
}

type View = { x: number; y: number; scale: number; alpha: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
type Float = { text: string; x: number; y: number; born: number; life: number; size: number; color: string; big?: boolean };
type ActiveFx = { fx: Step["fx"][number]; born: number };

const WORDS = ["", "", "Sweet!", "Juicy!", "Delicious!", "Fruitastic!"];
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const GardenBoard = forwardRef<BoardHandle, Props>(({ game, trowel, onTrowelUsed, onProgress, onSettled, onMove }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const snap = useRef<Snap>(game.snap());
  const views = useRef(new Map<number, View>());
  const particles = useRef<Particle[]>([]);
  const floats = useRef<Float[]>([]);
  const fxs = useRef<ActiveFx[]>([]);
  const busy = useRef(false);
  const selected = useRef<Pos | null>(null);
  const hint = useRef<[Pos, Pos] | null>(null);
  const idleSince = useRef(performance.now());
  const layout = useRef({ tile: 40, ox: 0, oy: 0, w: 0, h: 0, dpr: 1 });
  const hintTried = useRef(false);
  const props = useRef({ trowel, onTrowelUsed, onProgress, onSettled, onMove });
  props.current = { trowel, onTrowelUsed, onProgress, onSettled, onMove };

  const cellXY = (r: number, c: number) => {
    const L = layout.current;
    return { x: L.ox + (c + 0.5) * L.tile, y: L.oy + (r + 0.5) * L.tile };
  };

  // ---------- animation helpers ----------
  const tween = (ms: number, fn: (k: number) => void) =>
    new Promise<void>((resolve) => {
      const start = performance.now();
      const tick = () => {
        const k = Math.min(1, (performance.now() - start) / ms);
        fn(k);
        if (k < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });

  const splash = (r: number, c: number, color: number) => {
    const { x, y } = cellXY(r, c);
    const T = layout.current.tile;
    const col = color >= 0 ? JUICE[color] : "#ffe58a";
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.8 + Math.random() * 1.6) * T;
      particles.current.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - T, life: 0, max: 0.45 + Math.random() * 0.25, color: col, size: T * (0.05 + Math.random() * 0.05) });
    }
    if (particles.current.length > 400) particles.current.splice(0, particles.current.length - 400);
  };

  const float = (text: string, x: number, y: number, opts: Partial<Float> = {}) =>
    floats.current.push({ text, x, y, born: performance.now(), life: 800, size: layout.current.tile * 0.42, color: "#fff", ...opts });

  /** plays one step: pops, effects, the fall */
  const playStep = async (step: Step) => {
    snap.current = step.before;
    const now = performance.now();
    for (const f of step.fx) fxs.current.push({ fx: f, born: now });
    if (step.fx.some((f) => f.type === "row" || f.type === "col")) sfx.stripe();
    if (step.fx.some((f) => f.type === "blast")) sfx.blast();
    if (step.fx.some((f) => f.type === "beam" || f.type === "board")) sfx.blossom();
    if (step.cleared.length) sfx.pop(step.cascade);
    // the cleared fruit shrink away in a splash of juice
    const at = new Map(step.cleared.map((x) => [x.piece.id, x] as const));
    step.cleared.forEach((x) => splash(x.r, x.c, x.piece.color));
    if (step.points > 0 && step.cleared.length) {
      const cx = step.cleared.reduce((s, x) => s + x.c, 0) / step.cleared.length;
      const cy = step.cleared.reduce((s, x) => s + x.r, 0) / step.cleared.length;
      const p = cellXY(cy, cx);
      const color = step.cleared[0].piece.color;
      float(`${step.points}`, p.x, p.y, { color: color >= 0 ? JUICE[color] : "#ffd54a" });
    }
    if (step.cascade >= 3 && WORDS[Math.min(5, step.cascade)]) {
      const L = layout.current;
      float(WORDS[Math.min(5, step.cascade)], L.ox + L.w / 2, L.oy + L.h / 2, { big: true, life: 1100, size: L.tile * 1.1, color: "#fff" });
    }
    props.current.onProgress(step.progress);
    await tween(step.fx.length ? 300 : 200, (k) => {
      for (const [id, x] of at) views.current.set(id, { x: x.c, y: x.r, scale: 1 - ease(k), alpha: 1 - k * 0.6 });
    });
    for (const id of at.keys()) views.current.delete(id);
    snap.current = step.afterClear;
    // new specials grow into place
    if (step.created.length) {
      sfx.special();
      await tween(180, (k) => {
        for (const cr of step.created) views.current.set(cr.piece.id, { x: cr.c, y: cr.r, scale: 0.4 + 0.6 * ease(k), alpha: 1 });
      });
      for (const cr of step.created) views.current.delete(cr.piece.id);
    }
    await fall(step.afterClear, step.afterFall);
    if (step.exited.length) {
      sfx.acorn();
      step.exited.forEach((x) => {
        const p = cellXY(x.r + 0.8, x.c);
        float("+1", p.x, p.y, { color: "#c98a4a" });
      });
    }
    snap.current = step.afterFall;
  };

  /** everything falls from where it was to where it lands; new fruit drop in from above */
  const fall = async (from: Snap, to: Snap) => {
    const where = new Map<number, { r: number; c: number }>();
    from.pieces.forEach((row, r) => row.forEach((p, c) => p && where.set(p.id, { r, c })));
    const moves: { id: number; r0: number; c0: number; r1: number; c1: number }[] = [];
    const spawnedInCol = new Map<number, number>();
    // new fruit: lowest first, stacked above the top of the board
    for (let c = 0; c < to.pieces[0].length; c++)
      for (let r = to.pieces.length - 1; r >= 0; r--) {
        const p = to.pieces[r][c];
        if (!p) continue;
        const was = where.get(p.id);
        if (was) {
          if (was.r !== r || was.c !== c) moves.push({ id: p.id, r0: was.r, c0: was.c, r1: r, c1: c });
        } else {
          const k = (spawnedInCol.get(c) ?? 0) + 1;
          spawnedInCol.set(c, k);
          let top = 0;
          while (top < game.rows - 1 && game.cells[top][c].hole) top++;
          moves.push({ id: p.id, r0: top - k, c0: c, r1: r, c1: c });
        }
      }
    if (!moves.length) return;
    snap.current = to;
    const longest = Math.max(...moves.map((m) => Math.hypot(m.r1 - m.r0, m.c1 - m.c0)));
    const ms = 140 + Math.sqrt(longest) * 120;
    for (const m of moves) views.current.set(m.id, { x: m.c0, y: m.r0, scale: 1, alpha: 1 });
    await tween(ms, (k) => {
      // falling picks up speed, then settles with a tiny bounce
      const e = k < 0.85 ? Math.pow(k / 0.85, 2) : 1 + Math.sin(((k - 0.85) / 0.15) * Math.PI) * 0.04;
      for (const m of moves) views.current.set(m.id, { x: m.c0 + (m.c1 - m.c0) * Math.min(1, e), y: m.r0 + (m.r1 - m.r0) * e, scale: 1, alpha: 1 });
    });
    for (const m of moves) views.current.delete(m.id);
  };

  const playSteps = async (steps: Step[]) => {
    for (const step of steps) await playStep(step);
    if (game.justShuffled) {
      game.justShuffled = false;
      const L = layout.current;
      float("No moves left. Shuffling!", L.ox + L.w / 2, L.oy + L.h / 2, { big: true, life: 1300, size: L.tile * 0.55 });
      await wait(400);
      // the fruit shrink away and come back mixed up
      const ids: { id: number; r: number; c: number }[] = [];
      snap.current.pieces.forEach((row, r) => row.forEach((p, c) => p && ids.push({ id: p.id, r, c })));
      await tween(220, (k) => ids.forEach((x) => views.current.set(x.id, { x: x.c, y: x.r, scale: 1 - ease(k), alpha: 1 })));
      snap.current = game.snap();
      const fresh: { id: number; r: number; c: number }[] = [];
      snap.current.pieces.forEach((row, r) => row.forEach((p, c) => p && fresh.push({ id: p.id, r, c })));
      views.current.clear();
      await tween(260, (k) => fresh.forEach((x) => views.current.set(x.id, { x: x.c, y: x.r, scale: ease(k), alpha: 1 })));
      views.current.clear();
    }
    snap.current = game.snap();
    hint.current = null;
    hintTried.current = false;
  };

  /** a swap: slide the two fruits; if it doesn't work, slide them back */
  const trySwap = async (a: Pos, b: Pos) => {
    if (busy.current) return;
    busy.current = true;
    hint.current = null;
    selected.current = null;
    const pa = snap.current.pieces[a.r][a.c];
    const pb = snap.current.pieces[b.r][b.c];
    if (!pa || !pb || !game.movable(a.r, a.c) || !game.movable(b.r, b.c)) {
      busy.current = false;
      return;
    }
    const slide = (k: number) => {
      views.current.set(pa.id, { x: a.c + (b.c - a.c) * k, y: a.r + (b.r - a.r) * k, scale: 1, alpha: 1 });
      views.current.set(pb.id, { x: b.c + (a.c - b.c) * k, y: b.r + (a.r - b.r) * k, scale: 1, alpha: 1 });
    };
    sfx.swap();
    await tween(170, (k) => slide(ease(k)));
    const steps = game.play(a, b);
    if (!steps) {
      sfx.bump();
      await tween(170, (k) => slide(1 - ease(k)));
      views.current.delete(pa.id);
      views.current.delete(pb.id);
      busy.current = false;
      return;
    }
    views.current.delete(pa.id);
    views.current.delete(pb.id);
    props.current.onMove();
    await playSteps(steps);
    busy.current = false;
    idleSince.current = performance.now();
    props.current.onSettled();
  };

  const applyTrowel = async (p: Pos) => {
    if (busy.current) return;
    const steps = game.trowel(p);
    if (!steps) return;
    busy.current = true;
    selected.current = null;
    hint.current = null;
    props.current.onTrowelUsed();
    await playSteps(steps);
    busy.current = false;
    idleSince.current = performance.now();
    props.current.onSettled();
  };

  useImperativeHandle(ref, () => ({
    bloom: async () => {
      busy.current = true;
      const L = layout.current;
      float("Garden Bloom!", L.ox + L.w / 2, L.oy + L.h / 2, { big: true, life: 1300, size: L.tile * 0.95, color: "#fff" });
      await wait(600);
      await playSteps(game.bloom());
      busy.current = false;
    },
  }));

  // ---------- input: swipe a fruit, or tap one then its neighbour ----------
  const cellAt = useCallback((clientX: number, clientY: number): Pos | null => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const L = layout.current;
    const c = Math.floor((clientX - rect.left - L.ox) / L.tile);
    const r = Math.floor((clientY - rect.top - L.oy) / L.tile);
    return game.inside(r, c) ? { r, c } : null;
  }, [game]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    let start: { pos: Pos; x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      idleSince.current = performance.now();
      hint.current = null;
      hintTried.current = false;
      if (busy.current) return;
      const pos = cellAt(e.clientX, e.clientY);
      if (!pos) return;
      if (props.current.trowel) {
        void applyTrowel(pos);
        return;
      }
      start = { pos, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!start || busy.current) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < layout.current.tile * 0.35) return;
      const to = Math.abs(dx) > Math.abs(dy) ? { r: start.pos.r, c: start.pos.c + Math.sign(dx) } : { r: start.pos.r + Math.sign(dy), c: start.pos.c };
      const from = start.pos;
      start = null;
      if (game.inside(to.r, to.c)) void trySwap(from, to);
    };
    const up = () => {
      if (!start) return;
      const pos = start.pos;
      start = null;
      const sel = selected.current;
      if (sel && Math.abs(sel.r - pos.r) + Math.abs(sel.c - pos.c) === 1) void trySwap(sel, pos);
      else if (sel && sel.r === pos.r && sel.c === pos.c) selected.current = null;
      else {
        selected.current = pos;
        sfx.tap();
      }
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    const cancel = () => (start = null);
    canvas.addEventListener("pointercancel", cancel);
    return () => {
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
    };
    // the handlers read everything else through refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, cellAt]);

  // a new level: start from its board
  useEffect(() => {
    snap.current = game.snap();
    views.current.clear();
    particles.current = [];
    floats.current = [];
    fxs.current = [];
    selected.current = null;
    hint.current = null;
    hintTried.current = false;
    busy.current = false;
    idleSince.current = performance.now();
  }, [game]);

  // ---------- sizing ----------
  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const tile = Math.floor(Math.min(w / game.cols, (h - 8) / (game.rows + 0.4)));
      const bw = tile * game.cols;
      const bh = tile * game.rows;
      layout.current = { tile, ox: Math.floor((w - bw) / 2), oy: Math.floor((h - bh - tile * 0.3) / 2), w: bw, h: bh, dpr };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [game]);

  // ---------- drawing ----------
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    const frame = () => {
      // keep the loop going even if one frame fails to draw, so the board can never freeze
      raf = requestAnimationFrame(frame);
      try {
        draw();
      } catch (err) {
        console.error(err);
      }
    };
    const draw = () => {
      // the clock the effects were stamped with (a frame's own timestamp can be a little behind it)
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const L = layout.current;
      const T = L.tile;
      ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width / L.dpr, canvas.height / L.dpr);
      const s = snap.current;
      const R = game.rows;
      const C = game.cols;

      // the bed: soft cream tiles with a gentle shadow
      ctx.save();
      ctx.shadowColor = "rgba(60,90,40,0.25)";
      ctx.shadowBlur = T * 0.4;
      ctx.shadowOffsetY = T * 0.08;
      ctx.fillStyle = "rgba(255,252,240,0.55)";
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (!game.cells[r][c].hole) {
        roundRect(ctx, L.ox + c * T - 1, L.oy + r * T - 1, T + 2, T + 2, T * 0.18);
        ctx.fill();
      }
      ctx.restore();
      for (let r = 0; r < R; r++)
        for (let c = 0; c < C; c++) {
          if (game.cells[r][c].hole) continue;
          ctx.fillStyle = (r + c) % 2 ? "rgba(255,255,255,0.5)" : "rgba(255,248,225,0.7)";
          roundRect(ctx, L.ox + c * T + 1.5, L.oy + r * T + 1.5, T - 3, T - 3, T * 0.16);
          ctx.fill();
          const { x, y } = cellXY(r, c);
          if (s.weed[r][c] > 0) drawWeed(ctx, x, y, T, s.weed[r][c]);
          if (game.cells[r][c].exit && game.spec.goal.type === "acorns") drawBasket(ctx, x, y + T * 0.52, T);
        }

      // hint: the two fruits of a good move bob after a few idle seconds
      if (!busy.current && !hint.current && !hintTried.current && now - idleSince.current > 5000) {
        hint.current = game.findMove();
        hintTried.current = true;
      }
      const hinted = new Set(hint.current ? hint.current.map((p) => `${p.r},${p.c}`) : []);

      // the fruit
      for (let r = 0; r < R; r++)
        for (let c = 0; c < C; c++) {
          if (s.hedge[r][c] > 0) {
            const { x, y } = cellXY(r, c);
            drawHedge(ctx, x, y, T, s.hedge[r][c]);
          }
          const p: Piece | null = s.pieces[r][c];
          if (!p || views.current.has(p.id)) continue;
          const { x } = cellXY(r, c);
          let { y } = cellXY(r, c);
          let scale = 1;
          if (hinted.has(`${r},${c}`)) scale = 1 + Math.sin(t * 8) * 0.08;
          const sel = selected.current;
          if (sel && sel.r === r && sel.c === c) {
            ctx.fillStyle = "rgba(255,255,255,0.75)";
            roundRect(ctx, x - T * 0.46, y - T * 0.46, T * 0.92, T * 0.92, T * 0.18);
            ctx.fill();
            y += Math.sin(t * 10) * T * 0.03;
            scale = 1.06;
          }
          drawAt(ctx, p, x, y, T * 0.92 * scale, t);
          if (s.vine[r][c]) drawVine(ctx, x, y, T);
        }
      // pieces in motion
      for (const [id, v] of views.current) {
        const found = findPiece(s, id);
        if (!found) continue;
        const p = found.piece;
        const { x, y } = cellXY(v.y, v.x);
        if (y < L.oy - T * 0.5) continue;
        ctx.save();
        ctx.globalAlpha = v.alpha;
        // fruit dropping in from the top appear under the board's top edge
        ctx.beginPath();
        ctx.rect(L.ox - T, L.oy, L.w + T * 2, L.h + T);
        ctx.clip();
        drawAt(ctx, p, x, y, T * 0.92 * v.scale, t);
        // a vined fruit carries its vine as it falls
        if (s.vine[found.r][found.c]) drawVine(ctx, x, y, T * v.scale);
        ctx.restore();
      }

      // effects
      fxs.current = fxs.current.filter((a) => now - a.born < 520);
      for (const a of fxs.current) {
        const k = Math.max(0, (now - a.born) / 520);
        const f = a.fx;
        ctx.save();
        ctx.globalAlpha = 1 - k;
        if (f.type === "row" || f.type === "col") {
          const { x, y } = cellXY(f.r, f.c);
          ctx.fillStyle = "rgba(255,255,240,0.95)";
          ctx.shadowColor = "#fff6a8";
          ctx.shadowBlur = T * 0.6;
          const thick = T * (0.5 - k * 0.4);
          if (f.type === "row") ctx.fillRect(L.ox, y - thick / 2, L.w, thick);
          else ctx.fillRect(x - thick / 2, L.oy, thick, L.h);
        } else if (f.type === "blast") {
          const { x, y } = cellXY(f.r, f.c);
          ctx.strokeStyle = "#fff6c8";
          ctx.lineWidth = T * 0.3 * (1 - k);
          ctx.shadowColor = "#ffd54a";
          ctx.shadowBlur = T * 0.6;
          ctx.beginPath();
          ctx.arc(x, y, T * (f.radius + 0.5) * ease(k) * 1.2, 0, Math.PI * 2);
          ctx.stroke();
        } else if (f.type === "beam") {
          const o = cellXY(f.from.r, f.from.c);
          ctx.strokeStyle = "#fff";
          ctx.shadowColor = f.color >= 0 ? JUICE[f.color] : "#fff";
          ctx.shadowBlur = T * 0.4;
          ctx.lineWidth = T * 0.08;
          for (const to of f.to) {
            const d = cellXY(to.r, to.c);
            ctx.beginPath();
            ctx.moveTo(o.x, o.y);
            ctx.lineTo(o.x + (d.x - o.x) * Math.min(1, k * 3), o.y + (d.y - o.y) * Math.min(1, k * 3));
            ctx.stroke();
          }
        } else if (f.type === "board") {
          ctx.fillStyle = "rgba(255,255,240,0.8)";
          ctx.fillRect(L.ox, L.oy, L.w, L.h);
        }
        ctx.restore();
      }
      // juice
      particles.current = particles.current.filter((p) => (p.life += dt) < p.max);
      for (const p of particles.current) {
        p.vy += T * 9 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = 1 - p.life / p.max;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // words and points
      floats.current = floats.current.filter((f) => now - f.born < f.life);
      for (const f of floats.current) {
        const k = Math.max(0, (now - f.born) / f.life);
        ctx.save();
        const pop = f.big ? (k < 0.2 ? 0.6 + ease(k / 0.2) * 0.5 : 1.1 - (k - 0.2) * 0.12) : 1;
        ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        ctx.translate(f.x, f.y - (f.big ? 0 : k * T * 0.9));
        ctx.scale(pop, pop);
        ctx.font = `700 ${f.size}px Fredoka, "Baloo 2", "Trebuchet MS", system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.lineWidth = f.size * 0.22;
        ctx.strokeStyle = f.big ? "#d81b60" : "rgba(60,40,20,0.75)";
        ctx.strokeText(f.text, 0, 0);
        ctx.fillStyle = f.big ? "#fff" : f.color;
        ctx.fillText(f.text, 0, 0);
        ctx.restore();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [game]);

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <canvas ref={canvasRef} className={`absolute inset-0 touch-none select-none ${trowel ? "cursor-crosshair" : "cursor-pointer"}`} aria-label="The garden board: swipe a fruit to swap it with its neighbour" role="img" />
    </div>
  );
});
GardenBoard.displayName = "GardenBoard";

const findPiece = (s: Snap, id: number) => {
  for (let r = 0; r < s.pieces.length; r++)
    for (let c = 0; c < s.pieces[r].length; c++) {
      const piece = s.pieces[r][c];
      if (piece?.id === id) return { piece, r, c };
    }
  return null;
};

const drawAt = (ctx: CanvasRenderingContext2D, p: Piece, x: number, y: number, size: number, t: number) => {
  // a soft shadow under each fruit
  ctx.fillStyle = "rgba(60,40,20,0.12)";
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.4, size * 0.3, size * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  drawPiece(ctx, p, x, y, size, t);
};
