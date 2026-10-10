/*
 * Ma's Garden: the match-three engine. Pure game logic, no drawing. A move goes in, and a list of
 * steps comes out (what was cleared, what effects fired, where everything fell), each with
 * snapshots of the board, so the board component can animate them one after another.
 *
 * The rules follow the classic candy-matching game:
 *   - swap two neighbours; the swap only stands if it makes a line of three or more
 *   - four in a line makes a striped fruit (four across → stripes run down and clear a column,
 *     four down → stripes run across and clear a row)
 *   - an L or T shape makes a wrapped fruit, which explodes 3×3, falls, and explodes again
 *   - five in a line makes a rainbow blossom; swapped with a fruit, it clears every fruit of that kind
 *   - two specials swapped together combine (stripe+stripe = cross, stripe+wrap = three rows and
 *     columns, wrap+wrap = a big blast, blossom+stripe/wrap = every fruit of that kind becomes one
 *     and fires, blossom+blossom = the whole board)
 *   - weeds (the jelly) sit under fruit and are cleared by clearing the fruit above them
 *   - hedges (the icing) fill a cell and are trimmed by matches next to them or blasts that reach them
 *   - vines (the locks) hold a fruit so it can't be swapped (it still falls); clearing it breaks the vine instead
 *   - acorns (the ingredients) can't be matched; bring them down to the basket at the bottom
 */

export type Kind = "normal" | "stripedH" | "stripedV" | "wrapped" | "blossom" | "acorn";

export interface Piece {
  id: number;
  /** 0..5 for fruit; -1 for the blossom and acorns */
  color: number;
  kind: Kind;
  /** a wrapped fruit that has gone off once and will go off again after the next fall */
  armed?: boolean;
}

export interface Cell {
  hole: boolean;
  piece: Piece | null;
  /** weeds under the fruit: 0, 1 or 2 layers */
  weed: number;
  /** a hedge filling the cell: 0, 1 or 2 layers */
  hedge: number;
  /** a vine holding the fruit in place */
  vine: boolean;
  /** acorns leave the board here */
  exit: boolean;
}

export interface Pos {
  r: number;
  c: number;
}

export type Goal =
  | { type: "score" }
  | { type: "weeds" }
  | { type: "collect"; items: { color: number; count: number }[] }
  | { type: "acorns"; count: number };

export interface LevelSpec {
  n: number;
  /** rows of the board: "." no cell, "o" plain, "w"/"W" one/two layers of weeds, "h"/"H" hedge, "v" vine, "a" an acorn to start */
  layout: string[];
  moves: number;
  colors: number;
  goal: Goal;
  /** score needed for one, two and three stars */
  stars: [number, number, number];
}

export interface Snap {
  pieces: (Piece | null)[][];
  weed: number[][];
  hedge: number[][];
  vine: boolean[][];
}

export type Fx =
  | { type: "row"; r: number; c: number }
  | { type: "col"; r: number; c: number }
  | { type: "blast"; r: number; c: number; radius: number }
  | { type: "beam"; from: Pos; to: Pos[]; color: number }
  | { type: "board" };

export interface Step {
  before: Snap;
  /** pieces that pop in this step */
  cleared: { r: number; c: number; piece: Piece }[];
  fx: Fx[];
  /** new specials made by this step's matches */
  created: { r: number; c: number; piece: Piece }[];
  afterClear: Snap;
  afterFall: Snap;
  /** acorns that reached the basket in this step */
  exited: { r: number; c: number; piece: Piece }[];
  points: number;
  cascade: number;
  /** where the level stands once this step has played, for the score and goal counters */
  progress: Progress;
}

export interface Progress {
  score: number;
  movesLeft: number;
  collected: number[];
  weedsLeft: number;
  acornsDown: number;
  acornsSpawned: number;
}

const SCORE = { match3: 60, match4: 120, match5: 200, shape: 200, piece: 60, weed: 1000, hedge: 200, vine: 200, acorn: 10000, bloomMove: 3000 };

/** a small seeded random, so a level plays the same way for tests */
export const makeRng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
};

export class Game {
  rows: number;
  cols: number;
  cells: Cell[][];
  spec: LevelSpec;
  progress: Progress;
  rng: () => number;
  /** set when the board had no moves left and was shuffled; the board shows a word and clears it */
  justShuffled = false;
  private nextId = 1;

  constructor(spec: LevelSpec, seed = Date.now()) {
    this.spec = spec;
    this.rng = makeRng(seed);
    this.rows = spec.layout.length;
    this.cols = Math.max(...spec.layout.map((l) => l.length));
    this.cells = spec.layout.map((line) =>
      Array.from({ length: this.cols }, (_, c) => {
        const ch = line[c] ?? ".";
        return {
          hole: ch === "." || ch === " ",
          piece: null,
          weed: ch === "w" ? 1 : ch === "W" ? 2 : 0,
          hedge: ch === "h" ? 1 : ch === "H" ? 2 : 0,
          vine: ch === "v",
          exit: false,
        };
      }),
    );
    // acorns leave from the lowest open cell of each column
    if (spec.goal.type === "acorns")
      for (let c = 0; c < this.cols; c++)
        for (let r = this.rows - 1; r >= 0; r--)
          if (!this.cells[r][c].hole) {
            this.cells[r][c].exit = true;
            break;
          }
    this.progress = {
      score: 0,
      movesLeft: spec.moves,
      collected: Array(6).fill(0),
      weedsLeft: 0,
      acornsDown: 0,
      acornsSpawned: 0,
    };
    this.fillStart();
    spec.layout.forEach((line, r) =>
      [...line].forEach((ch, c) => {
        if (ch === "a") {
          this.cells[r][c].piece = this.newPiece(-1, "acorn");
          this.progress.acornsSpawned++;
        }
      }),
    );
    this.progress.weedsLeft = this.countWeeds();
  }

  // ---------- basics ----------

  inside(r: number, c: number) {
    return r >= 0 && c >= 0 && r < this.rows && c < this.cols && !this.cells[r][c].hole;
  }
  /** a cell a fruit can sit in */
  open(r: number, c: number) {
    return this.inside(r, c) && this.cells[r][c].hedge === 0;
  }
  piece(r: number, c: number) {
    return this.inside(r, c) ? this.cells[r][c].piece : null;
  }
  newPiece(color: number, kind: Kind = "normal"): Piece {
    return { id: this.nextId++, color, kind };
  }
  randomColor() {
    return Math.floor(this.rng() * this.spec.colors);
  }
  countWeeds() {
    let n = 0;
    for (const row of this.cells) for (const cell of row) if (!cell.hole) n += cell.weed;
    return n;
  }
  snap(): Snap {
    return {
      pieces: this.cells.map((row) => row.map((cell) => (cell.piece ? { ...cell.piece } : null))),
      weed: this.cells.map((row) => row.map((cell) => cell.weed)),
      hedge: this.cells.map((row) => row.map((cell) => cell.hedge)),
      vine: this.cells.map((row) => row.map((cell) => cell.vine)),
    };
  }
  /** fruit that can be matched (acorns and the blossom can't) */
  matchColor(p: Piece | null) {
    return p && p.kind !== "acorn" && p.kind !== "blossom" ? p.color : -1;
  }
  movable(r: number, c: number) {
    const cell = this.inside(r, c) ? this.cells[r][c] : null;
    return !!cell && !!cell.piece && cell.hedge === 0 && !cell.vine;
  }

  /** a starting board with no lines already made, and at least one move to make */
  private fillStart() {
    for (let tries = 0; tries < 50; tries++) {
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++) {
          const cell = this.cells[r][c];
          if (!this.open(r, c)) continue;
          let color = 0;
          for (let k = 0; k < 20; k++) {
            color = this.randomColor();
            const left = this.piece(r, c - 1)?.color === color && this.piece(r, c - 2)?.color === color;
            const up = this.piece(r - 1, c)?.color === color && this.piece(r - 2, c)?.color === color;
            if (!left && !up) break;
          }
          cell.piece = this.newPiece(color);
        }
      if (this.findMove()) return;
    }
  }

  // ---------- finding lines ----------

  private findGroups() {
    type Run = Pos[];
    const runs: { cells: Run; dir: "h" | "v" }[] = [];
    for (let r = 0; r < this.rows; r++) {
      let c = 0;
      while (c < this.cols) {
        const color = this.matchColor(this.piece(r, c));
        let end = c + 1;
        if (color >= 0) while (end < this.cols && this.matchColor(this.piece(r, end)) === color) end++;
        if (color >= 0 && end - c >= 3) runs.push({ cells: Array.from({ length: end - c }, (_, i) => ({ r, c: c + i })), dir: "h" });
        c = end;
      }
    }
    for (let c = 0; c < this.cols; c++) {
      let r = 0;
      while (r < this.rows) {
        const color = this.matchColor(this.piece(r, c));
        let end = r + 1;
        if (color >= 0) while (end < this.rows && this.matchColor(this.piece(end, c)) === color) end++;
        if (color >= 0 && end - r >= 3) runs.push({ cells: Array.from({ length: end - r }, (_, i) => ({ r: r + i, c })), dir: "v" });
        r = end;
      }
    }
    // runs that share a cell form one group (an L, a T, a plus)
    const parent = runs.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const owner = new Map<string, number>();
    runs.forEach((run, i) =>
      run.cells.forEach((p) => {
        const key = `${p.r},${p.c}`;
        const j = owner.get(key);
        if (j !== undefined) parent[find(i)] = find(j);
        else owner.set(key, i);
      }),
    );
    const groups = new Map<number, { cells: Map<string, Pos>; runs: typeof runs }>();
    runs.forEach((run, i) => {
      const g = groups.get(find(i)) ?? { cells: new Map(), runs: [] };
      run.cells.forEach((p) => g.cells.set(`${p.r},${p.c}`, p));
      g.runs.push(run);
      groups.set(find(i), g);
    });
    return [...groups.values()];
  }

  /** would swapping these two cells make a line? */
  private swapMakesLine(a: Pos, b: Pos) {
    const pa = this.cells[a.r][a.c].piece;
    const pb = this.cells[b.r][b.c].piece;
    this.cells[a.r][a.c].piece = pb;
    this.cells[b.r][b.c].piece = pa;
    const ok = this.lineThrough(a) || this.lineThrough(b);
    this.cells[a.r][a.c].piece = pa;
    this.cells[b.r][b.c].piece = pb;
    return ok;
  }
  private lineThrough({ r, c }: Pos) {
    const color = this.matchColor(this.piece(r, c));
    if (color < 0) return false;
    const count = (dr: number, dc: number) => {
      let n = 0;
      for (let k = 1; this.matchColor(this.piece(r + dr * k, c + dc * k)) === color; k++) n++;
      return n;
    };
    return count(0, -1) + count(0, 1) >= 2 || count(-1, 0) + count(1, 0) >= 2;
  }

  /** is this swap allowed? (it makes a line, or it combines specials) */
  canSwap(a: Pos, b: Pos) {
    if (Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) return false;
    if (!this.movable(a.r, a.c) || !this.movable(b.r, b.c)) return false;
    const pa = this.cells[a.r][a.c].piece!;
    const pb = this.cells[b.r][b.c].piece!;
    if (pa.kind === "blossom" && pb.kind !== "acorn") return true;
    if (pb.kind === "blossom" && pa.kind !== "acorn") return true;
    if (isSpecial(pa) && isSpecial(pb)) return true;
    return this.swapMakesLine(a, b);
  }

  /** a move that works, for the hint; null if the board is stuck */
  findMove(): [Pos, Pos] | null {
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        for (const [dr, dc] of [
          [0, 1],
          [1, 0],
        ]) {
          const a = { r, c };
          const b = { r: r + dr, c: c + dc };
          if (this.inside(b.r, b.c) && this.canSwap(a, b)) return [a, b];
        }
    return null;
  }

  // ---------- a move ----------

  /** plays a swap; returns the steps to animate, or null if the swap isn't allowed (it bounces back) */
  play(a: Pos, b: Pos): Step[] | null {
    if (!this.canSwap(a, b)) return null;
    this.progress.movesLeft--;
    const pa = this.cells[a.r][a.c].piece!;
    const pb = this.cells[b.r][b.c].piece!;
    this.cells[a.r][a.c].piece = pb;
    this.cells[b.r][b.c].piece = pa;
    const steps: Step[] = [];
    // specials swapped together (or a blossom with anything) go off right away
    if (pa.kind === "blossom" || pb.kind === "blossom" || (isSpecial(pa) && isSpecial(pb))) steps.push(this.combo(b, a, pa, pb));
    this.cascade(steps, [a, b]);
    return steps;
  }

  /** the trowel booster: clears one fruit (or trims a hedge) without using a move */
  trowel(p: Pos): Step[] | null {
    const cell = this.inside(p.r, p.c) ? this.cells[p.r][p.c] : null;
    if (!cell || (!cell.piece && !cell.hedge) || cell.piece?.kind === "acorn") return null;
    const steps: Step[] = [];
    const before = this.snap();
    const hits = new Map<string, Pos>([[`${p.r},${p.c}`, p]]);
    const res = this.applyHits(hits, new Set(), [], 1);
    steps.push(this.finishStep(before, res, [], 1));
    this.cascade(steps, []);
    return steps;
  }

  /** the end-of-level bloom: every move left turns a fruit into a striped one, then everything goes off */
  bloom(): Step[] {
    const steps: Step[] = [];
    // the moves count down batch by batch as they turn into stripes
    let moves = this.progress.movesLeft;
    while (moves > 0) {
      const normals: Pos[] = [];
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.piece(r, c)?.kind === "normal") normals.push({ r, c });
      if (!normals.length) break;
      const n = Math.min(moves, normals.length, 3);
      for (let i = 0; i < n; i++) {
        const pick = normals.splice(Math.floor(this.rng() * normals.length), 1)[0];
        const old = this.cells[pick.r][pick.c].piece!;
        this.cells[pick.r][pick.c].piece = { ...old, kind: this.rng() < 0.5 ? "stripedH" : "stripedV" };
        this.progress.score += SCORE.bloomMove;
      }
      moves -= n;
      this.progress.movesLeft = moves;
      // taken after the stripes are made, so they show before they go off
      const before = this.snap();
      // the new stripes go off one batch at a time
      const hits = new Map<string, Pos>();
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (isSpecial(this.piece(r, c))) hits.set(`${r},${c}`, { r, c });
      const res = this.applyHits(hits, new Set(), [], 1);
      steps.push(this.finishStep(before, res, [], 1));
      this.cascade(steps, []);
    }
    this.progress.movesLeft = 0;
    // then any specials still on the board
    for (let guard = 0; guard < 10; guard++) {
      const hits = new Map<string, Pos>();
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (isSpecial(this.piece(r, c))) hits.set(`${r},${c}`, { r, c });
      if (!hits.size) break;
      const before = this.snap();
      const res = this.applyHits(hits, new Set(), [], 1);
      steps.push(this.finishStep(before, res, [], 1));
      this.cascade(steps, []);
    }
    return steps;
  }

  /** two specials (or a blossom) swapped together */
  private combo(at: Pos, other: Pos, moved: Piece, stayed: Piece): Step {
    const before = this.snap();
    const fx: Fx[] = [];
    const hits = new Map<string, Pos>();
    const add = (r: number, c: number) => this.inside(r, c) && hits.set(`${r},${c}`, { r, c });
    const blossom = moved.kind === "blossom" ? moved : stayed.kind === "blossom" ? stayed : null;
    const partner = blossom === moved ? stayed : moved;
    const blossomAt = blossom === moved ? at : other;
    // both cells are used up by the combo itself
    const used = new Set<number>([moved.id, stayed.id]);
    if (blossom && partner.kind === "blossom") {
      fx.push({ type: "board" });
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) add(r, c);
    } else if (blossom) {
      const color = partner.color;
      const targets: Pos[] = [];
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++) {
          const p = this.piece(r, c);
          if (p && p.kind !== "acorn" && p.kind !== "blossom" && p.color === color) {
            targets.push({ r, c });
            // blossom + stripe: every fruit of that kind becomes striped; + wrap: every one becomes wrapped
            if (partner.kind === "stripedH" || partner.kind === "stripedV") p.kind = this.rng() < 0.5 ? "stripedH" : "stripedV";
            else if (partner.kind === "wrapped") p.kind = "wrapped";
            add(r, c);
          }
        }
      fx.push({ type: "beam", from: blossomAt, to: targets, color });
      add(blossomAt.r, blossomAt.c);
      if (!isSpecial(partner)) used.delete(partner.id);
    } else {
      const s = (p: Piece) => p.kind === "stripedH" || p.kind === "stripedV";
      const w = (p: Piece) => p.kind === "wrapped";
      const { r, c } = at;
      if (s(moved) && s(stayed)) {
        fx.push({ type: "row", r, c }, { type: "col", r, c });
        for (let k = 0; k < Math.max(this.rows, this.cols); k++) {
          add(r, k);
          add(k, c);
        }
      } else if ((s(moved) && w(stayed)) || (w(moved) && s(stayed))) {
        for (let d = -1; d <= 1; d++) {
          fx.push({ type: "row", r: r + d, c }, { type: "col", r, c: c + d });
          for (let k = 0; k < Math.max(this.rows, this.cols); k++) {
            add(r + d, k);
            add(k, c + d);
          }
        }
      } else {
        // wrap + wrap: a big blast
        fx.push({ type: "blast", r, c, radius: 2 });
        for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) add(r + dr, c + dc);
      }
      add(other.r, other.c);
    }
    const res = this.applyHits(hits, used, fx, 1);
    return this.finishStep(before, res, [], 1);
  }

  /** settles the board: falls, refills, new lines and the effects they set off, until it rests */
  private cascade(steps: Step[], swapped: Pos[]) {
    let cascade = steps.length ? 2 : 1;
    // if the move itself was a combo, the board needs to fall first
    for (let guard = 0; guard < 60; guard++) {
      // wrapped fruit that went off once go off again after a fall
      const armed: Pos[] = [];
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.piece(r, c)?.armed) armed.push({ r, c });
      if (armed.length) {
        const before = this.snap();
        const hits = new Map<string, Pos>();
        const fx: Fx[] = [];
        for (const a of armed) {
          fx.push({ type: "blast", r: a.r, c: a.c, radius: 1 });
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (this.inside(a.r + dr, a.c + dc)) hits.set(`${a.r + dr},${a.c + dc}`, { r: a.r + dr, c: a.c + dc });
          this.cells[a.r][a.c].piece!.armed = false;
          this.cells[a.r][a.c].piece!.kind = "normal";
          // it's spent: it clears itself in this blast
        }
        const res = this.applyHits(hits, new Set(), fx, cascade);
        steps.push(this.finishStep(before, res, [], cascade));
        cascade++;
        continue;
      }
      const groups = this.findGroups();
      if (!groups.length) break;
      const before = this.snap();
      const hits = new Map<string, Pos>();
      const created: { r: number; c: number; piece: Piece }[] = [];
      let points = 0;
      const nearHedges = new Set<string>();
      for (const g of groups) {
        const cells = [...g.cells.values()];
        cells.forEach((p) => hits.set(`${p.r},${p.c}`, p));
        cells.forEach((p) =>
          [
            [0, 1],
            [0, -1],
            [1, 0],
            [-1, 0],
          ].forEach(([dr, dc]) => {
            if (this.inside(p.r + dr, p.c + dc) && this.cells[p.r + dr][p.c + dc].hedge > 0) nearHedges.add(`${p.r + dr},${p.c + dc}`);
          }),
        );
        // what special does this shape make, and where?
        const longest = Math.max(...g.runs.map((run) => run.cells.length));
        const hasH = g.runs.some((run) => run.dir === "h");
        const hasV = g.runs.some((run) => run.dir === "v");
        const color = this.matchColor(this.piece(cells[0].r, cells[0].c));
        let kind: Kind | null = null;
        if (longest >= 5) kind = "blossom";
        else if (hasH && hasV) kind = "wrapped";
        else if (longest === 4) kind = hasH ? "stripedV" : "stripedH";
        points += (kind === "blossom" ? SCORE.match5 : kind === "wrapped" ? SCORE.shape : longest === 4 ? SCORE.match4 : SCORE.match3) * cascade;
        if (kind) {
          const here =
            swapped.find((s) => g.cells.has(`${s.r},${s.c}`)) ??
            (kind === "wrapped" ? cells.find((p) => g.runs.filter((run) => run.cells.some((q) => q.r === p.r && q.c === p.c)).length > 1) : null) ??
            cells[Math.floor(cells.length / 2)];
          created.push({ r: here.r, c: here.c, piece: this.newPiece(kind === "blossom" ? -1 : color, kind) });
        }
      }
      // matches trim the hedges beside them
      for (const key of nearHedges) {
        const [r, c] = key.split(",").map(Number);
        this.cells[r][c].hedge--;
        points += SCORE.hedge;
      }
      const res = this.applyHits(hits, new Set(), [], cascade);
      res.points += points;
      // the new specials take their places
      for (const cr of created) {
        if (!this.cells[cr.r][cr.c].piece) this.cells[cr.r][cr.c].piece = cr.piece;
      }
      steps.push(this.finishStep(before, res, created, cascade));
      cascade++;
      swapped = [];
    }
    // nothing left to make: shuffle until there is
    if (!this.findMove()) {
      this.shuffle();
      this.justShuffled = true;
    }
  }

  /**
   * clears the cells hit, setting off any specials among them (and any those reach), and returns
   * what popped and what effects fired. `used` are pieces consumed without going off (a combo's pair).
   */
  private applyHits(hits: Map<string, Pos>, used: Set<number>, fx: Fx[], cascade: number) {
    const cleared: { r: number; c: number; piece: Piece }[] = [];
    let points = 0;
    const done = new Set<string>();
    const queue = [...hits.values()];
    const hit = (r: number, c: number) => {
      if (!this.inside(r, c)) return;
      const key = `${r},${c}`;
      if (done.has(key)) return;
      queue.push({ r, c });
    };
    while (queue.length) {
      const { r, c } = queue.shift()!;
      const key = `${r},${c}`;
      if (done.has(key)) continue;
      done.add(key);
      const cell = this.cells[r][c];
      if (cell.hedge > 0) {
        cell.hedge--;
        points += SCORE.hedge;
        continue;
      }
      const p = cell.piece;
      if (!p || p.kind === "acorn") continue;
      if (cell.vine) {
        cell.vine = false;
        points += SCORE.vine;
        if (cell.weed > 0) {
          cell.weed--;
          points += SCORE.weed;
        }
        continue;
      }
      // a special goes off as it's cleared
      if (!used.has(p.id)) {
        if (p.kind === "stripedH") {
          fx.push({ type: "row", r, c });
          for (let k = 0; k < this.cols; k++) hit(r, k);
        } else if (p.kind === "stripedV") {
          fx.push({ type: "col", r, c });
          for (let k = 0; k < this.rows; k++) hit(k, c);
        } else if (p.kind === "wrapped" && !p.armed) {
          fx.push({ type: "blast", r, c, radius: 1 });
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) hit(r + dr, c + dc);
          // it stays on the board, armed, and goes off again after the fall
          p.armed = true;
          points += SCORE.piece * cascade;
          continue;
        } else if (p.kind === "blossom") {
          // set off by a blast rather than a swap: it clears the most common fruit
          const counts = Array(6).fill(0);
          for (let rr = 0; rr < this.rows; rr++) for (let cc = 0; cc < this.cols; cc++) {
            const q = this.piece(rr, cc);
            if (q && q.color >= 0 && q.kind !== "acorn") counts[q.color]++;
          }
          const color = counts.indexOf(Math.max(...counts));
          const targets: Pos[] = [];
          for (let rr = 0; rr < this.rows; rr++) for (let cc = 0; cc < this.cols; cc++) if (this.piece(rr, cc)?.color === color && this.piece(rr, cc)?.kind !== "acorn") {
            targets.push({ r: rr, c: cc });
            hit(rr, cc);
          }
          fx.push({ type: "beam", from: { r, c }, to: targets, color });
        }
      }
      cell.piece = null;
      cleared.push({ r, c, piece: p });
      points += SCORE.piece * cascade;
      if (p.color >= 0) this.progress.collected[p.color]++;
      if (cell.weed > 0) {
        cell.weed--;
        points += SCORE.weed;
      }
    }
    return { cleared, points, fx };
  }

  private finishStep(before: Snap, res: { cleared: Step["cleared"]; points: number; fx: Fx[] }, created: Step["created"], cascade: number): Step {
    const afterClear = this.snap();
    const exited = this.settle();
    const points = res.points + exited.length * SCORE.acorn;
    this.progress.score += points;
    this.progress.weedsLeft = this.countWeeds();
    const progress = { ...this.progress, collected: [...this.progress.collected] };
    return { before, cleared: res.cleared, fx: res.fx, created, afterClear, afterFall: this.snap(), exited, points, cascade, progress };
  }

  // ---------- falling and refilling ----------

  /** spawners: the top open cell of each column */
  private spawnRow(c: number) {
    for (let r = 0; r < this.rows; r++) if (!this.cells[r][c].hole) return this.cells[r][c].hedge ? -1 : r;
    return -1;
  }

  /** lets everything fall (straight down, then sliding diagonally past blockers) and refills from the top */
  private settle() {
    const exited: Step["exited"] = [];
    for (let guard = 0; guard < 2000; guard++) {
      let moved = false;
      // straight down
      for (let r = this.rows - 2; r >= 0; r--)
        for (let c = 0; c < this.cols; c++) {
          if (!this.movableToFall(r, c)) continue;
          if (this.open(r + 1, c) && !this.cells[r + 1][c].piece) {
            this.shift(r, c, r + 1, c);
            moved = true;
          }
        }
      // refill from the spawners as soon as there's room
      for (let c = 0; c < this.cols; c++) {
        const r = this.spawnRow(c);
        if (r >= 0 && !this.cells[r][c].piece) {
          this.cells[r][c].piece = this.spawnPiece();
          moved = true;
        }
      }
      if (moved) continue;
      // slide diagonally into gaps that nothing can fall into from above
      for (let r = this.rows - 1; r >= 1 && !moved; r--)
        for (let c = 0; c < this.cols && !moved; c++) {
          if (!this.open(r, c) || this.cells[r][c].piece || this.canBeFedFromAbove(r, c)) continue;
          for (const dc of [-1, 1]) {
            if (this.movableToFall(r - 1, c + dc)) {
              this.shift(r - 1, c + dc, r, c);
              moved = true;
              break;
            }
          }
        }
      if (moved) continue;
      // acorns at the basket leave the board
      let left = false;
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++) {
          const cell = this.cells[r][c];
          if (cell.exit && cell.piece?.kind === "acorn") {
            exited.push({ r, c, piece: cell.piece });
            cell.piece = null;
            this.progress.acornsDown++;
            left = true;
          }
        }
      if (!left) break;
    }
    return exited;
  }
  /** vined fruit can't be swapped, but they still fall, taking their vine with them */
  private movableToFall(r: number, c: number) {
    return this.inside(r, c) && !!this.cells[r][c].piece && this.cells[r][c].hedge === 0;
  }
  private shift(r: number, c: number, r2: number, c2: number) {
    const from = this.cells[r][c];
    const to = this.cells[r2][c2];
    to.piece = from.piece;
    to.vine = from.vine;
    from.piece = null;
    from.vine = false;
  }
  /** can something still arrive straight down into this empty cell? */
  private canBeFedFromAbove(r: number, c: number): boolean {
    for (let rr = r - 1; rr >= 0; rr--) {
      const cell = this.cells[rr][c];
      if (cell.hole || cell.hedge) return false;
      if (cell.piece) return true;
    }
    return this.spawnRow(c) >= 0;
  }
  private spawnPiece(): Piece {
    const g = this.spec.goal;
    if (g.type === "acorns" && this.progress.acornsSpawned < g.count) {
      let onBoard = 0;
      for (const row of this.cells) for (const cell of row) if (cell.piece?.kind === "acorn") onBoard++;
      if (onBoard < 2 && this.rng() < 0.12) {
        this.progress.acornsSpawned++;
        return this.newPiece(-1, "acorn");
      }
    }
    return this.newPiece(this.randomColor());
  }

  /** mixes up the fruit (keeping specials, acorns and vines where they are) until there's a move */
  shuffle() {
    const spots: Pos[] = [];
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.movable(r, c) && this.piece(r, c)?.kind === "normal") spots.push({ r, c });
    for (let tries = 0; tries < 60; tries++) {
      for (const s of spots) this.cells[s.r][s.c].piece!.color = this.randomColor();
      if (!this.findGroups().length && this.findMove()) return;
    }
  }

  // ---------- the level ----------

  goalDone() {
    const g = this.spec.goal;
    const p = this.progress;
    if (g.type === "score") return p.score >= this.spec.stars[0];
    if (g.type === "weeds") return p.weedsLeft === 0;
    if (g.type === "collect") return g.items.every((it) => p.collected[it.color] >= it.count);
    return p.acornsDown >= g.count;
  }
  /** score levels play out every move; the others end as soon as the goal's done */
  isWon() {
    return this.spec.goal.type === "score" ? this.progress.movesLeft === 0 && this.goalDone() : this.goalDone();
  }
  isLost() {
    return this.progress.movesLeft === 0 && !this.goalDone();
  }
  stars() {
    const s = this.progress.score;
    return s >= this.spec.stars[2] ? 3 : s >= this.spec.stars[1] ? 2 : s >= this.spec.stars[0] || this.goalDone() ? 1 : 0;
  }
}

export const isSpecial = (p: Piece | null | undefined) => !!p && (p.kind === "stripedH" || p.kind === "stripedV" || p.kind === "wrapped" || p.kind === "blossom");
