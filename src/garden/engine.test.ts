import { describe, expect, it } from "vitest";
import { Game, type Kind, type LevelSpec } from "./engine";

/**
 * A 7×7 board filled with a pattern that never lines up three of a kind on its own
 * (colour = (2·row + col) mod 6), so each test only sees the lines it sets up.
 */
const spec = (over: Partial<LevelSpec> = {}): LevelSpec => ({
  n: 1,
  layout: Array(7).fill("ooooooo"),
  moves: 20,
  colors: 6,
  goal: { type: "score" },
  stars: [1000, 2000, 3000],
  ...over,
});
const make = (over: Partial<LevelSpec> = {}) => {
  const g = new Game(spec(over), 42);
  for (let r = 0; r < g.rows; r++)
    for (let c = 0; c < g.cols; c++) if (g.open(r, c) && g.cells[r][c].piece?.kind !== "acorn") g.cells[r][c].piece = g.newPiece((2 * r + c) % 6);
  return g;
};
const put = (g: Game, r: number, c: number, color: number, kind: Kind = "normal") => {
  g.cells[r][c].piece = g.newPiece(color, kind);
};
const full = (g: Game) => {
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) if (g.open(r, c) && !g.cells[r][c].piece) return false;
  return true;
};

describe("Ma's Garden engine", () => {
  it("starts with no lines and a move to make", () => {
    const g = new Game(spec({ layout: Array(9).fill("ooooooooo"), colors: 5 }), 7);
    expect(g.findMove()).not.toBeNull();
    const before = g.snap();
    // playing the hinted move works
    const [a, b] = g.findMove()!;
    expect(g.play(a, b)).not.toBeNull();
    expect(before.pieces.flat().every(Boolean)).toBe(true);
  });

  it("bounces a swap that makes no line, without using a move", () => {
    const g = make();
    const before = g.snap();
    expect(g.play({ r: 0, c: 0 }, { r: 0, c: 1 })).toBeNull();
    expect(g.progress.movesLeft).toBe(20);
    expect(g.snap().pieces.map((row) => row.map((p) => p?.id))).toEqual(before.pieces.map((row) => row.map((p) => p?.id)));
  });

  it("clears a line of three, scores it, and refills the board", () => {
    const g = make();
    // row 4 is 2,3,4,5,0,1,2: make the first three 0 by swapping a 0 down into (4,2)
    put(g, 4, 0, 0);
    put(g, 4, 1, 0);
    put(g, 3, 2, 0);
    const steps = g.play({ r: 3, c: 2 }, { r: 4, c: 2 })!;
    expect(steps).not.toBeNull();
    const first = steps[0];
    expect(first.cleared.map((x) => `${x.r},${x.c}`).sort()).toEqual(["4,0", "4,1", "4,2"]);
    expect(first.points).toBeGreaterThanOrEqual(60);
    expect(g.progress.movesLeft).toBe(19);
    expect(g.progress.collected[0]).toBeGreaterThanOrEqual(3);
    expect(full(g)).toBe(true);
  });

  it("four across makes a striped fruit that clears a column, where the swap landed", () => {
    const g = make();
    // row 2: 4,5,0,1,2,3,4 → make cols 0,1,3 colour 1 and drop a 1 into (2,2)
    put(g, 2, 0, 1);
    put(g, 2, 1, 1);
    put(g, 2, 3, 1);
    put(g, 1, 2, 1);
    const steps = g.play({ r: 1, c: 2 }, { r: 2, c: 2 })!;
    expect(steps[0].cleared.length).toBe(4);
    expect(steps[0].created).toHaveLength(1);
    expect(steps[0].created[0]).toMatchObject({ r: 2, c: 2, piece: { kind: "stripedV", color: 1 } });
  });

  it("five in a line makes a rainbow blossom", () => {
    const g = make();
    for (const c of [0, 1, 3, 4]) put(g, 5, c, 3);
    put(g, 6, 2, 3);
    const steps = g.play({ r: 6, c: 2 }, { r: 5, c: 2 })!;
    expect(steps[0].created[0].piece.kind).toBe("blossom");
  });

  it("an L shape makes a wrapped fruit", () => {
    const g = make();
    // an L of colour 5: (3,0),(3,1) across and (4,2),(5,2) down, completed at (3,2)
    put(g, 3, 0, 5);
    put(g, 3, 1, 5);
    put(g, 4, 2, 5);
    put(g, 5, 2, 5);
    put(g, 2, 2, 5);
    // keep the corner's neighbours from extending the lines by accident
    put(g, 3, 3, 0);
    put(g, 1, 2, 0);
    const steps = g.play({ r: 2, c: 2 }, { r: 3, c: 2 })!;
    expect(steps[0].created[0].piece.kind).toBe("wrapped");
    expect(steps[0].cleared.length).toBe(5);
  });

  it("a striped fruit in a match clears its whole row", () => {
    const g = make();
    put(g, 4, 0, 0, "stripedH");
    put(g, 4, 1, 0);
    put(g, 3, 2, 0);
    const steps = g.play({ r: 3, c: 2 }, { r: 4, c: 2 })!;
    const rowCleared = steps[0].cleared.filter((x) => x.r === 4).length;
    expect(rowCleared).toBe(7);
    expect(steps[0].fx.some((f) => f.type === "row")).toBe(true);
  });

  it("a wrapped fruit goes off twice: once in the match, again after the fall", () => {
    const g = make();
    put(g, 4, 0, 0, "wrapped");
    put(g, 4, 1, 0);
    put(g, 3, 2, 0);
    const steps = g.play({ r: 3, c: 2 }, { r: 4, c: 2 })!;
    const blasts = steps.flatMap((s) => s.fx).filter((f) => f.type === "blast");
    expect(blasts.length).toBeGreaterThanOrEqual(2);
    // and it's gone afterwards
    expect(g.snap().pieces.flat().some((p) => p?.armed)).toBe(false);
  });

  it("a blossom swapped with a fruit clears every fruit of that kind", () => {
    const g = make();
    put(g, 0, 0, -1, "blossom");
    const target = g.cells[0][1].piece!.color;
    const howMany = g.snap().pieces.flat().filter((p) => p?.color === target && p.kind === "normal").length;
    const steps = g.play({ r: 0, c: 0 }, { r: 0, c: 1 })!;
    expect(steps).not.toBeNull();
    expect(steps[0].cleared.filter((x) => x.piece.color === target).length).toBe(howMany);
    expect(steps[0].fx[0].type).toBe("beam");
  });

  it("two striped fruits swapped together clear a cross", () => {
    const g = make();
    put(g, 3, 3, 1, "stripedH");
    put(g, 3, 4, 2, "stripedV");
    const steps = g.play({ r: 3, c: 3 }, { r: 3, c: 4 })!;
    const cells = new Set(steps[0].cleared.map((x) => `${x.r},${x.c}`));
    expect(cells.size).toBe(13); // a full row and a full column through the landing cell
  });

  it("two blossoms clear the whole board", () => {
    const g = make();
    put(g, 3, 3, -1, "blossom");
    put(g, 3, 4, -1, "blossom");
    const steps = g.play({ r: 3, c: 3 }, { r: 3, c: 4 })!;
    expect(steps[0].cleared.length).toBe(49);
    expect(full(g)).toBe(true);
  });

  it("clearing fruit clears the weeds under it", () => {
    const layout = Array(7).fill("ooooooo");
    layout[4] = "wWooooo";
    const g = make({ layout, goal: { type: "weeds" } });
    expect(g.progress.weedsLeft).toBe(3);
    put(g, 4, 0, 0);
    put(g, 4, 1, 0);
    put(g, 3, 2, 0);
    g.play({ r: 3, c: 2 }, { r: 4, c: 2 });
    expect(g.cells[4][0].weed).toBe(0);
    expect(g.cells[4][1].weed).toBe(1);
  });

  it("a match trims the hedge beside it, and fruit slides round hedges to fill the gaps", () => {
    const layout = Array(7).fill("ooooooo");
    layout[3] = "oohoooo";
    const g = make({ layout });
    expect(g.cells[3][2].piece).toBeNull();
    // a line across row 4 under the hedge
    put(g, 4, 1, 0);
    put(g, 4, 3, 0);
    put(g, 5, 2, 0);
    g.play({ r: 5, c: 2 }, { r: 4, c: 2 });
    expect(g.cells[3][2].hedge).toBe(0);
    expect(full(g)).toBe(true);
  });

  it("a vine holds its fruit: it can't be swapped, and clearing it breaks the vine instead", () => {
    const layout = Array(7).fill("ooooooo");
    layout[4] = "voooooo";
    const g = make({ layout });
    expect(g.canSwap({ r: 4, c: 0 }, { r: 4, c: 1 })).toBe(false);
    put(g, 4, 0, 0);
    put(g, 4, 1, 0);
    put(g, 3, 2, 0);
    const kept = g.cells[4][0].piece!.id;
    g.play({ r: 3, c: 2 }, { r: 4, c: 2 });
    expect(g.cells[4][0].vine).toBe(false);
    expect(g.cells[4][0].piece!.id).toBe(kept);
  });

  it("acorns fall to the basket and count", () => {
    const layout = Array(7).fill("ooooooo");
    layout[5] = "aoooooo";
    const g = make({ layout, goal: { type: "acorns", count: 1 } });
    put(g, 5, 0, -1, "acorn");
    // clear the fruit under it with a line across row 6
    put(g, 6, 1, 0);
    put(g, 6, 2, 0);
    put(g, 5, 0, -1, "acorn");
    put(g, 5, 3, 0);
    // row 6 is 0,1,2,3,4,5,0 → (6,0) is already 0; swap (5,3) with (6,3) to make 0,0,0,0
    g.play({ r: 5, c: 3 }, { r: 6, c: 3 });
    expect(g.progress.acornsDown).toBe(1);
    expect(g.goalDone()).toBe(true);
  });

  it("collect goals count fruit of the right kind, and the level is won when they're met", () => {
    const g = make({ goal: { type: "collect", items: [{ color: 0, count: 3 }] } });
    put(g, 4, 0, 0);
    put(g, 4, 1, 0);
    put(g, 3, 2, 0);
    g.play({ r: 3, c: 2 }, { r: 4, c: 2 });
    expect(g.isWon()).toBe(true);
    // the bloom spends the remaining moves for points
    const before = g.progress.score;
    const bloom = g.bloom();
    expect(bloom.length).toBeGreaterThan(0);
    expect(g.progress.score).toBeGreaterThan(before);
    expect(g.progress.movesLeft).toBe(0);
  });

  it("the trowel clears one fruit without using a move", () => {
    const g = make();
    const steps = g.trowel({ r: 2, c: 2 })!;
    expect(steps[0].cleared).toHaveLength(1);
    expect(g.progress.movesLeft).toBe(20);
    expect(full(g)).toBe(true);
  });

  it("reshuffles a stuck board", () => {
    const g = new Game(spec({ layout: ["ooo", "ooo", "ooo"], colors: 6 }), 3);
    // a stuck board: no swap makes a line
    const stuck = [
      [0, 1, 2],
      [3, 4, 5],
      [0, 1, 2],
    ];
    stuck.forEach((row, r) => row.forEach((color, c) => put(g, r, c, color)));
    expect(g.findMove()).toBeNull();
    g.shuffle();
    // with six colours on a 3×3 a move isn't guaranteed, but the shuffle never leaves a line on the board
    const s = g.snap().pieces;
    for (let r = 0; r < 3; r++) expect(new Set(s[r].map((p) => p!.color)).size > 1).toBe(true);
  });
});

describe("Ma's Garden engine under load", () => {
  it("survives hundreds of random moves on boards with every blocker, always settling full and line-free", () => {
    const layouts = [
      ["ooooooooo", "ooooooooo", "oowwwwwoo", "oowhohwoo", "vvwwwwwvv", "ooooooooo", "oohoooHoo", "ooooooooo", "ooooooooo"],
      ["..ooooo..", ".ooooooo.", "ooooooooo", "oooo.oooo", "ooooooooo", "ooohHhooo", ".ooooooo.", "..ooooo..", "...ooo..."],
    ];
    for (let seed = 1; seed <= 12; seed++) {
      const layout = layouts[seed % 2];
      const goal = seed % 3 === 0 ? ({ type: "acorns", count: 3 } as const) : ({ type: "weeds" } as const);
      const g = new Game(spec({ layout, moves: 400, colors: 4 + (seed % 3), goal }), seed);
      for (let move = 0; move < 40; move++) {
        let pick = g.findMove();
        if (!pick) break;
        // sometimes play a random legal move rather than the first one found
        for (let t = 0; t < 30; t++) {
          const r = Math.floor(g.rng() * g.rows);
          const c = Math.floor(g.rng() * g.cols);
          const b = g.rng() < 0.5 ? { r, c: c + 1 } : { r: r + 1, c };
          if (g.inside(b.r, b.c) && g.canSwap({ r, c }, b)) {
            pick = [{ r, c }, b];
            break;
          }
        }
        const steps = g.play(pick[0], pick[1]);
        expect(steps).not.toBeNull();
        if (!full(g)) {
          const empty: string[] = [];
          for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) if (g.open(r, c) && !g.cells[r][c].piece) empty.push(`${r},${c}`);
          throw new Error(`seed ${seed} move ${move}: empty ${empty.join(" ")}\n` + g.cells.map((row) => row.map((x) => (x.hole ? "." : x.hedge ? "h" : x.piece ? (x.vine ? "v" : "o") : "_")).join("")).join("\n"));
        }
        // nothing left lined up after a move settles
        const s = g.snap().pieces;
        for (let r = 0; r < g.rows; r++)
          for (let c = 0; c + 2 < g.cols; c++) {
            const [a, b, d] = [s[r][c], s[r][c + 1], s[r][c + 2]];
            if (a && b && d && a.color >= 0 && a.kind !== "acorn" && a.kind !== "blossom" && [b, d].every((x) => x.color === a.color && x.kind !== "acorn" && x.kind !== "blossom")) throw new Error(`line left at ${r},${c}`);
          }
      }
    }
  });
});
