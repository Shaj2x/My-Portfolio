import type { Goal, LevelSpec } from "./engine";

/*
 * Ma's Garden's levels: an endless road that gets gently harder. Every ten levels is a garden of
 * its own, and every tenth level is shaped like a heart. New things are introduced one at a time:
 * fruit orders (2), weeds (4), acorns (7), hedges (8), vines (13), then double hedges and double
 * weeds, and a sixth fruit later on.
 */

export const FRUIT_NAMES = ["Strawberries", "Oranges", "Lemons", "Apples", "Blueberries", "Grapes"];

export const GARDENS = [
  { name: "Strawberry Patch", sky: ["#ffd9e2", "#fff3e6"], grass: "#8fd18a" },
  { name: "Orange Grove", sky: ["#ffe1bf", "#fff6e3"], grass: "#9bd27a" },
  { name: "Lemon Lane", sky: ["#fff3b8", "#fffbe6"], grass: "#a6d675" },
  { name: "Apple Orchard", sky: ["#dff3d2", "#f6fff0"], grass: "#7cc47a" },
  { name: "Blueberry Hill", sky: ["#dbe7ff", "#f2f6ff"], grass: "#86c98f" },
  { name: "Grape Vineyard", sky: ["#eadcff", "#f8f2ff"], grass: "#8dc58a" },
  { name: "Ma's Secret Garden", sky: ["#ffe0ef", "#fff6fb"], grass: "#8fd18a" },
];
export const gardenOf = (n: number) => GARDENS[Math.floor((n - 1) / 10) % GARDENS.length];

// ---------- board shapes ----------
const SHAPES: Record<string, string[]> = {
  square8: Array(8).fill("oooooooo"),
  square9: Array(9).fill("ooooooooo"),
  rounded: [".ooooooo.", "ooooooooo", "ooooooooo", "ooooooooo", "ooooooooo", "ooooooooo", "ooooooooo", "ooooooooo", ".ooooooo."],
  octagon: ["..ooooo..", ".ooooooo.", "ooooooooo", "ooooooooo", "ooooooooo", "ooooooooo", "ooooooooo", ".ooooooo.", "..ooooo.."],
  twin: ["oooo.oooo", "oooo.oooo", "oooo.oooo", "ooooooooo", "ooooooooo", "ooooooooo", "oooo.oooo", "oooo.oooo", "oooo.oooo"],
  flower: ["...ooo...", "..ooooo..", ".ooooooo.", "ooooooooo", "ooooooooo", "ooooooooo", ".ooooooo.", "..ooooo..", "...ooo..."],
  wide: ["ooooooooo", "ooooooooo", "ooooooooo", "ooooooooo", "ooooooooo", "ooooooooo", "ooooooooo", "ooooooooo"],
  heart: [".ooo.ooo.", "ooooooooo", "ooooooooo", "ooooooooo", "ooooooooo", ".ooooooo.", "..ooooo..", "...ooo...", "....o...."],
};

/** a deterministic "random" per level, so a level is always the same level */
const pick = (n: number, salt: number, k: number) => Math.abs(Math.floor(Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453)) % k;

const setAt = (rows: string[], r: number, c: number, ch: string) => {
  if (!rows[r] || rows[r][c] !== "o") return;
  rows[r] = rows[r].slice(0, c) + ch + rows[r].slice(c + 1);
};

/** weeds: a band, a frame, a cross, or patches */
const addWeeds = (rows: string[], n: number, double: boolean) => {
  const R = rows.length;
  const C = rows[0].length;
  const style = pick(n, 1, 4);
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++) {
      const band = r >= Math.floor(R / 2) - 1 && r <= Math.floor(R / 2) + 1;
      const frame = r === 0 || c === 0 || r === R - 1 || c === C - 1 || r === 1 || c === 1 || r === R - 2 || c === C - 2;
      const cross = Math.abs(c - Math.floor(C / 2)) <= 1 || Math.abs(r - Math.floor(R / 2)) <= 1;
      const patch = (Math.floor(r / 3) + Math.floor(c / 3)) % 2 === 0;
      const yes = [band, frame, cross, patch][style];
      if (yes) setAt(rows, r, c, double && (r + c) % 2 === 0 ? "W" : "w");
    }
};

/** hedges: a few spaced out (never three side by side, so nothing gets walled off) */
const addHedges = (rows: string[], n: number, double: boolean) => {
  const R = rows.length;
  const C = rows[0].length;
  const row = Math.floor(R / 2) + (pick(n, 2, 3) - 1);
  for (let c = pick(n, 3, 2); c < C; c += 2) setAt(rows, row, c, double && c % 4 === 0 ? "H" : "h");
  if (n > 25) for (let c = 1; c < C; c += 3) setAt(rows, R - 2, c, "h");
};

const addVines = (rows: string[], n: number) => {
  const R = rows.length;
  const C = rows[0].length;
  const count = 4 + Math.min(6, Math.floor(n / 10));
  for (let i = 0; i < count; i++) setAt(rows, 1 + pick(n, 10 + i, R - 2), pick(n, 30 + i, C), "v");
};

/** the level spec for level n (1-based, endless) */
export function levelSpec(n: number): LevelSpec {
  const episode = Math.floor((n - 1) / 10);
  const inEpisode = ((n - 1) % 10) + 1;
  const isHeart = inEpisode === 10;

  // what kind of level
  const early: Record<number, Goal["type"]> = { 1: "score", 2: "collect", 3: "score", 4: "weeds", 5: "collect", 6: "weeds", 7: "acorns", 8: "score", 9: "weeds", 10: "collect" };
  const cycle: Goal["type"][] = ["weeds", "collect", "acorns", "score", "weeds", "collect", "weeds", "acorns", "collect", "collect"];
  const type = n <= 10 ? early[n] : cycle[inEpisode - 1];

  // board shape
  const shapeNames = ["square9", "rounded", "octagon", "twin", "flower", "wide"];
  const shapeName = isHeart ? "heart" : n <= 3 ? "square8" : shapeNames[pick(n, 0, shapeNames.length)];
  const rows = [...SHAPES[shapeName]];

  // what's on it
  const colors = n <= 3 ? 4 : n <= 30 ? 5 : n % 2 === 0 ? 6 : 5;
  if (type === "weeds") addWeeds(rows, n, n > 20);
  if (n >= 8 && n % 3 !== 1 && type !== "acorns") addHedges(rows, n, n > 15);
  if (n >= 13 && n % 4 === 1) addVines(rows, n);
  if (type === "acorns") {
    // the first acorn waits at the top; more fall in as you go
    const c = rows[0].indexOf("o");
    setAt(rows, 0, c + 1 < rows[0].length && rows[0][c + 1] === "o" ? c + 1 : c, "a");
  }

  // the goal, and enough moves to reach it
  let goal: Goal;
  let moves: number;
  const ease = Math.max(0, 3 - episode); // the first gardens get a few spare moves
  if (type === "score") {
    goal = { type: "score" };
    moves = 20 + Math.min(4, ease);
  } else if (type === "weeds") {
    const cells = rows.join("").split("").filter((ch) => ch === "w" || ch === "W").length;
    const layers = rows.join("").split("").reduce((s, ch) => s + (ch === "w" ? 1 : ch === "W" ? 2 : 0), 0);
    goal = { type: "weeds" };
    moves = Math.max(18, Math.min(36, 10 + Math.ceil(layers * 0.42) + ease - Math.floor(cells / 40) + (n > 20 ? 3 : 0)));
  } else if (type === "collect") {
    const kinds = n <= 2 ? 1 : n < 20 ? 2 : 3;
    const each = Math.min(40, 14 + episode * 4 + (kinds === 1 ? 6 : 0));
    const first = pick(n, 4, colors);
    const items = Array.from({ length: kinds }, (_, i) => ({ color: (first + i * 2) % colors, count: each }));
    goal = { type: "collect", items };
    moves = Math.ceil((each * kinds) / (colors <= 4 ? 3.4 : colors === 5 ? 3.1 : 2.7)) + 5 + ease;
  } else {
    const count = Math.min(4, 2 + Math.floor(episode / 2));
    goal = { type: "acorns", count };
    moves = 20 + count * 2 + ease + episode * 2;
  }

  // each garden is a little tighter than the last
  moves = Math.max(14, Math.round(moves * (1 - Math.min(0.32, episode * 0.08))));

  // stars: one for finishing (or for the target on score levels), two and three for a big score
  const perMove = 700 + episode * 110;
  const base = moves * perMove;
  const stars: [number, number, number] =
    type === "score" ? [Math.round(base / 10) * 10, Math.round((base * 1.6) / 10) * 10, Math.round((base * 2.3) / 10) * 10] : [Math.round((base * 0.4) / 10) * 10, Math.round((base * 1.1) / 10) * 10, Math.round((base * 1.7) / 10) * 10];

  return { n, layout: rows, moves, colors, goal, stars };
}

/** a short line describing a level's goal */
export function goalText(spec: LevelSpec) {
  const g = spec.goal;
  if (g.type === "score") return `Score ${spec.stars[0].toLocaleString()} points in ${spec.moves} moves`;
  if (g.type === "weeds") return `Clear all the weeds in ${spec.moves} moves`;
  if (g.type === "acorns") return `Bring ${g.count} acorns down to the basket in ${spec.moves} moves`;
  return `Pick ${g.items.map((it) => `${it.count} ${FRUIT_NAMES[it.color].toLowerCase()}`).join(", ")} in ${spec.moves} moves`;
}
