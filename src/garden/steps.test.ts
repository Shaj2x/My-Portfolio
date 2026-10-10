import { describe, expect, it } from "vitest";
import { Game, type Snap, type Step } from "./engine";
import { levelSpec } from "./levels";

const pos = (s: Snap) => {
  const m = new Map<number, [number, number, string]>();
  s.pieces.forEach((row, r) =>
    row.forEach((p, c) => p && m.set(p.id, [r, c, p.kind])),
  );
  return m;
};
/*
 * The board animates each move from the engine's snapshots, so they have to line up: nothing may
 * jump, vanish or appear except where a step says it pops, is made, falls in, or leaves.
 */
const issues = new Map<string, string>();
const note = (k: string, where = "") => {
  if (!issues.has(k)) issues.set(k, where);
};

const check = (g: Game, steps: Step[], label: string) => {
  let prev: Snap | null = null;
  for (const st of steps) {
    if (prev) {
      const a = pos(prev),
        b = pos(st.before);
      for (const [id, [r, c]] of b) {
        const o = a.get(id);
        if (!o) note("before has new piece", label);
        else if (o[0] !== r || o[1] !== c) note("before moved piece", label);
      }
      for (const id of a.keys())
        if (!b.has(id)) note("piece vanished between steps", label);
    }
    const be = pos(st.before),
      ac = pos(st.afterClear),
      af = pos(st.afterFall);
    const cleared = new Set(st.cleared.map((x) => x.piece.id));
    for (const [id, [r, c]] of ac) {
      const o = be.get(id);
      if (!o) {
        if (!st.created.some((x) => x.piece.id === id))
          note("afterClear new non-created piece", label);
      } else if (o[0] !== r || o[1] !== c)
        note("piece jumped during clear", label);
      if (cleared.has(id))
        note(
          "cleared piece still there",
          `${label} kind ${o?.[2]}->${ac.get(id)?.[2]}`,
        );
    }
    for (const id of be.keys())
      if (!ac.has(id) && !cleared.has(id)) note("vanished during clear", label);
    const exited = new Set(st.exited.map((x) => x.piece.id));
    for (const [id, [r, c]] of af) {
      const o = ac.get(id);
      if (o && r < o[0]) note("moved up", label);
      if (o && Math.abs(c - o[1]) > r - o[0])
        note("sideways more than down", label);
    }
    for (const id of ac.keys())
      if (!af.has(id) && !exited.has(id)) note("vanished during fall", label);
    prev = st.afterFall;
  }
  if (prev && !g.justShuffled) {
    const a = pos(prev),
      b = pos(g.snap());
    for (const [id, [r, c]] of b) {
      const o = a.get(id);
      if (!o || o[0] !== r || o[1] !== c) {
        note("final snap differs", label);
        break;
      }
    }
  }
};

describe("move steps line up for the animation", () => {
  it("across the first 60 levels", () => {
    for (let n = 1; n <= 60; n++) {
      for (let seed = 1; seed <= 2; seed++) {
        const g = new Game(levelSpec(n), seed * 1000 + n);
        for (let m = 0; m < 25 && g.progress.movesLeft > 0; m++) {
          const mv = g.findMove();
          if (!mv) {
            note("no move found", `L${n}`);
            break;
          }
          const steps = g.play(mv[0], mv[1]);
          if (!steps) {
            note("findMove gave an illegal move", `L${n}`);
            break;
          }
          check(g, steps, `L${n} s${seed} m${m}`);
          g.justShuffled = false;
          if (m === 5 && g.progress.movesLeft > 0) {
            const t = g.trowel({ r: 4, c: 4 });
            if (t) check(g, t, `L${n} trowel`);
          }
        }
        check(g, g.bloom(), `L${n} bloom`);
      }
    }
    expect([...issues]).toEqual([]);
  });
});
