import { useEffect, useRef, useState } from "react";

/*
 * Super Shajith: a side-scrolling platformer through Shajith's life, in the classic run-and-jump
 * format (original pixel art, drawn in code; no borrowed sprites).
 *
 *   1-1 Brampton        high school: dodge Pop Quizzes, collect A+ grades, graduate
 *   1-2 LoveYouReally   the streetwear brand: stomp the Haters, collect followers
 *   1-3 Western         first year: get past the Midterms to University College
 *
 * ? blocks give coins or a coffee (grow big: one free hit, and bricks break), stomp enemies from
 * above, don't fall in the gaps, and touch the flag. Keyboard, touch buttons, or a controller
 * (the console maps its D-pad to arrow keys and ✕ to Space).
 */

const TILE = 16;
const ROWS = 14;
const VIEW_W = 320;
const VIEW_H = ROWS * TILE; // 224
const STEP = 1 / 120;

// ---------- levels ----------

type Spawn = { x: number; y: number };
interface Level {
  name: string;
  place: string;
  years: string;
  intro: string;
  outro: string[];
  coinName: string;
  /** how much one coin counts for in the HUD (followers go up in hundreds) */
  coinValue: number;
  enemyName: string;
  theme: Theme;
  grid: string[][];
  enemies: Spawn[];
  flagX: number;
}
interface Theme {
  sky: [string, string];
  ground: string;
  groundTop: string;
  groundDark: string;
  brick: string;
  far: string;
  near: string;
  stars: boolean;
  enemy: "quiz" | "hater" | "midterm";
  coin: "grade" | "heart" | "credit";
  landmark: "school" | "city" | "uc";
}

/** builds a level grid from a few placement calls, so the layouts read like a description */
function build(len: number, theme: Theme, spec: (b: Builder) => void, meta: Omit<Level, "grid" | "enemies" | "flagX" | "theme">): Level {
  const grid = Array.from({ length: ROWS }, () => Array<string>(len).fill(" "));
  const enemies: Spawn[] = [];
  let flagX = len - 6;
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && x < len && y >= 0 && y < ROWS) grid[y][x] = c;
  };
  const b: Builder = {
    ground: (x0, x1, top = 12) => {
      for (let x = x0; x <= x1; x++) for (let y = top; y < ROWS; y++) set(x, y, "#");
    },
    row: (x, y, n, c) => {
      for (let i = 0; i < n; i++) set(x + i, y, c);
    },
    tile: set,
    pipe: (x, h) => {
      const top = 12 - h;
      set(x, top, "[");
      set(x + 1, top, "]");
      for (let y = top + 1; y < 12; y++) {
        set(x, y, "{");
        set(x + 1, y, "}");
      }
    },
    stairs: (x, h, down = false) => {
      for (let i = 0; i < h; i++) {
        const height = down ? h - i : i + 1;
        for (let y = 12 - height; y < 12; y++) set(x + i, y, "X");
      }
    },
    coins: (x, y, n) => {
      for (let i = 0; i < n; i++) set(x + i, y, "C");
    },
    enemy: (x, y = 11) => enemies.push({ x: x * TILE, y: y * TILE }),
    flag: (x) => {
      flagX = x;
      set(x, 11, "X");
    },
  };
  spec(b);
  return { ...meta, theme, grid, enemies, flagX };
}
interface Builder {
  ground: (x0: number, x1: number, top?: number) => void;
  row: (x: number, y: number, n: number, c: string) => void;
  tile: (x: number, y: number, c: string) => void;
  pipe: (x: number, h: number) => void;
  stairs: (x: number, h: number, down?: boolean) => void;
  coins: (x: number, y: number, n: number) => void;
  enemy: (x: number, y?: number) => void;
  flag: (x: number) => void;
}

const LEVELS: Level[] = [
  build(
    160,
    { sky: ["#6fb4ff", "#bfe2ff"], ground: "#a8683a", groundTop: "#5fbf4a", groundDark: "#7a4a28", brick: "#b65a2c", far: "#9ccaf0", near: "#79b06a", stars: false, enemy: "quiz", coin: "grade", landmark: "school" },
    (b) => {
      b.ground(0, 70);
      b.tile(14, 8, "?");
      b.row(19, 8, 5, "B");
      b.tile(20, 8, "?");
      b.tile(21, 8, "M");
      b.tile(22, 8, "?");
      b.tile(21, 4, "?");
      b.pipe(28, 2);
      b.enemy(24);
      b.pipe(37, 3);
      b.enemy(42);
      b.enemy(44);
      b.pipe(48, 4);
      b.coins(52, 8, 4);
      b.pipe(59, 4);
      b.enemy(64);
      b.ground(74, 112);
      b.coins(70, 8, 4);
      b.row(80, 8, 3, "B");
      b.tile(81, 8, "?");
      b.row(84, 4, 6, "B");
      b.tile(87, 4, "?");
      b.enemy(86);
      b.enemy(88);
      b.tile(96, 8, "?");
      b.tile(100, 8, "?");
      b.tile(100, 4, "M");
      b.tile(104, 8, "?");
      b.enemy(102);
      b.enemy(106);
      b.ground(116, 159);
      b.stairs(120, 4);
      b.stairs(126, 4, true);
      b.stairs(134, 8);
      b.flag(150);
    },
    {
      name: "1-1",
      place: "Brampton",
      years: "Chinguacousy S.S. · 2021–2025",
      intro: "High school. Collect A+ grades, and watch out for pop quizzes.",
      outro: ["Graduated with a 96.3% average", "Student Activity Council President", "Tamil Student Association President"],
      coinName: "Grades",
      coinValue: 1,
      enemyName: "Pop Quiz",
    },
  ),
  build(
    170,
    { sky: ["#ff9a7a", "#ffd6a6"], ground: "#5a4a62", groundTop: "#2a2230", groundDark: "#3e3346", brick: "#c2486a", far: "#e5a3a8", near: "#8a5a7a", stars: false, enemy: "hater", coin: "heart", landmark: "city" },
    (b) => {
      b.ground(0, 30);
      b.coins(8, 8, 3);
      b.tile(12, 8, "?");
      b.row(15, 8, 4, "B");
      b.tile(16, 8, "M");
      b.enemy(20);
      b.enemy(26);
      b.ground(34, 60);
      b.row(30, 8, 3, "X");
      b.coins(31, 6, 3);
      b.pipe(40, 3);
      b.enemy(46);
      b.row(50, 7, 6, "B");
      b.tile(52, 7, "?");
      b.tile(54, 7, "?");
      b.coins(50, 4, 6);
      b.enemy(55);
      b.ground(65, 74);
      b.row(62, 9, 2, "X");
      b.enemy(70);
      b.ground(79, 118);
      b.row(76, 8, 2, "X");
      b.stairs(84, 3);
      b.coins(88, 6, 5);
      b.row(88, 8, 5, "B");
      b.tile(90, 8, "?");
      b.enemy(92);
      b.enemy(95);
      b.pipe(100, 2);
      b.pipe(106, 4);
      b.enemy(110);
      b.enemy(113);
      b.ground(123, 169);
      b.row(119, 9, 3, "X");
      b.tile(128, 8, "M");
      b.row(132, 8, 4, "?");
      b.enemy(134);
      b.enemy(138);
      b.stairs(144, 7);
      b.flag(160);
    },
    {
      name: "1-2",
      place: "LoveYouReally",
      years: "The streetwear brand · 2023–2025",
      intro: "Started a clothing brand at 15. Collect followers and stomp the haters.",
      outro: ["Co-founded LoveYouReally Apparel", "Grew it to 10K+ followers", "Design, customers and fulfillment, at 15"],
      coinName: "Followers",
      coinValue: 250,
      enemyName: "Hater",
    },
  ),
  build(
    180,
    { sky: ["#140c2a", "#3a2266"], ground: "#8a8274", groundTop: "#4f2683", groundDark: "#5f584e", brick: "#7a5aa0", far: "#2a1d4a", near: "#3c2a62", stars: true, enemy: "midterm", coin: "credit", landmark: "uc" },
    (b) => {
      b.ground(0, 40);
      b.tile(10, 8, "?");
      b.row(14, 8, 3, "B");
      b.tile(15, 8, "M");
      b.enemy(18);
      b.pipe(24, 3);
      b.enemy(30);
      b.enemy(33);
      b.row(36, 7, 4, "B");
      b.coins(36, 5, 4);
      b.ground(45, 62);
      b.row(41, 9, 2, "X");
      b.enemy(52);
      b.enemy(55);
      b.pipe(58, 4);
      b.ground(67, 72);
      b.ground(77, 120);
      b.row(64, 8, 2, "X");
      b.row(73, 7, 2, "X");
      b.coins(73, 5, 2);
      b.row(82, 8, 6, "B");
      b.tile(83, 8, "?");
      b.tile(85, 8, "M");
      b.tile(87, 8, "?");
      b.row(84, 4, 3, "?");
      b.enemy(86);
      b.enemy(89);
      b.enemy(92);
      b.stairs(96, 4);
      b.stairs(100, 4, true);
      b.pipe(108, 3);
      b.enemy(112);
      b.enemy(115);
      b.ground(125, 179);
      b.row(121, 9, 2, "X");
      b.coins(128, 8, 6);
      b.enemy(134);
      b.enemy(137);
      b.enemy(140);
      b.stairs(150, 8);
      b.flag(168);
    },
    {
      name: "1-3",
      place: "Western",
      years: "Western University · 2025–",
      intro: "First year in London, Ontario. Earn your credits, survive the midterms.",
      outro: ["Engineering Science + Ivey HBA", "One of Canada's most selective dual degrees", "The adventure continues…"],
      coinName: "Credits",
      coinValue: 1,
      enemyName: "Midterm",
    },
  ),
];

const SOLID = new Set(["#", "B", "?", "M", "U", "X", "[", "]", "{", "}"]);

// ---------- game state ----------

interface Body {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  ground: boolean;
}
interface Enemy extends Body {
  alive: boolean;
  squash: number;
  flip: boolean;
}
interface Item extends Body {
  rise: number;
}
interface Fx {
  kind: "coin" | "bit" | "score";
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  text?: string;
}
type Phase = "title" | "intro" | "play" | "dying" | "clear" | "over" | "end";

interface State {
  phase: Phase;
  phaseT: number;
  level: number;
  grid: string[][];
  player: Body & { big: boolean; face: 1 | -1; hurt: number; walk: number; jumpHeld: boolean; coyote: number; buffer: number };
  enemies: Enemy[];
  items: Item[];
  fx: Fx[];
  bumps: { x: number; y: number; t: number }[];
  cam: number;
  coins: number;
  score: number;
  lives: number;
  flagSlide: number;
}

const freshLevel = (s: State, index: number) => {
  const L = LEVELS[index];
  s.level = index;
  s.grid = L.grid.map((r) => r.slice());
  s.player = { x: 2 * TILE, y: 10 * TILE, w: 12, h: 14, vx: 0, vy: 0, ground: false, big: s.player?.big ?? false, face: 1, hurt: 0, walk: 0, jumpHeld: false, coyote: 0, buffer: 0 };
  if (s.player.big) {
    s.player.h = 24;
    s.player.y -= 10;
  }
  s.enemies = L.enemies.map((e) => ({ x: e.x + 2, y: e.y + 2, w: 12, h: 14, vx: -28, vy: 0, ground: false, alive: true, squash: 0, flip: false }));
  s.items = [];
  s.fx = [];
  s.bumps = [];
  s.cam = 0;
  s.flagSlide = 0;
};

const newGame = (): State => {
  const s = { phase: "title", phaseT: 0, level: 0, coins: 0, score: 0, lives: 3 } as State;
  freshLevel(s, 0);
  return s;
};

// ---------- the component ----------

export interface SuperShajithProps {
  /** called once when the last level is cleared */
  onWin?: () => void;
}

const SuperShajith = ({ onWin }: SuperShajithProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keys = useRef<Record<string, boolean>>({});
  const touch = useRef({ left: false, right: false, jump: false, run: false });
  // a jump press is latched until the next game step reads it, so even the quickest tap counts
  const jumpTap = useRef(false);
  const onWinRef = useRef(onWin);
  onWinRef.current = onWin;
  const [, force] = useState(0);
  const stateRef = useRef<State>(newGame());

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let time = 0;

    const down = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Shift", "a", "d", "w", "s", "z", "x"].includes(k)) e.preventDefault();
      keys.current[k] = e.type === "keydown";
      if (e.type === "keydown" && !e.repeat && ["ArrowUp", "w", " ", "z"].includes(k)) jumpTap.current = true;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", down);

    const held = () => {
      const k = keys.current;
      const t = touch.current;
      return {
        left: !!(k.ArrowLeft || k.a || t.left),
        right: !!(k.ArrowRight || k.d || t.right),
        jump: !!(k.ArrowUp || k.w || k[" "] || k.z || t.jump || jumpTap.current),
        run: !!(k.Shift || k.x || t.run),
      };
    };

    // ---------- tiles ----------
    const tileAt = (s: State, tx: number, ty: number) => {
      if (tx < 0) return "X";
      if (ty < 0 || ty >= ROWS || tx >= s.grid[0].length) return " ";
      return s.grid[ty][tx];
    };
    const solidAt = (s: State, px: number, py: number) => SOLID.has(tileAt(s, Math.floor(px / TILE), Math.floor(py / TILE)));

    /** move a body, sliding along tiles; returns the tile it hit with its head, if any */
    const move = (s: State, b: Body, dt: number) => {
      let head: { tx: number; ty: number } | null = null;
      b.x += b.vx * dt;
      if (b.vx > 0) {
        if (solidAt(s, b.x + b.w, b.y + 1) || solidAt(s, b.x + b.w, b.y + b.h - 1) || (b.h > 16 && solidAt(s, b.x + b.w, b.y + b.h / 2))) {
          b.x = Math.floor((b.x + b.w) / TILE) * TILE - b.w - 0.01;
          b.vx = 0;
        }
      } else if (b.vx < 0) {
        if (solidAt(s, b.x, b.y + 1) || solidAt(s, b.x, b.y + b.h - 1) || (b.h > 16 && solidAt(s, b.x, b.y + b.h / 2))) {
          b.x = Math.floor(b.x / TILE + 1) * TILE + 0.01;
          b.vx = 0;
        }
      }
      b.y += b.vy * dt;
      b.ground = false;
      if (b.vy >= 0) {
        if (solidAt(s, b.x + 1, b.y + b.h) || solidAt(s, b.x + b.w - 1, b.y + b.h)) {
          b.y = Math.floor((b.y + b.h) / TILE) * TILE - b.h;
          b.vy = 0;
          b.ground = true;
        }
      } else {
        const lx = b.x + 2;
        const rx = b.x + b.w - 2;
        const hitL = solidAt(s, lx, b.y);
        const hitR = solidAt(s, rx, b.y);
        if (hitL || hitR) {
          // bump the tile nearest the middle of the head
          const mid = b.x + b.w / 2;
          const tx = hitL && hitR ? Math.floor(mid / TILE) : Math.floor((hitL ? lx : rx) / TILE);
          head = { tx, ty: Math.floor(b.y / TILE) };
          b.y = Math.floor(b.y / TILE + 1) * TILE;
          b.vy = 40;
        }
      }
      return head;
    };

    const addScore = (s: State, n: number, x: number, y: number) => {
      s.score += n;
      s.fx.push({ kind: "score", x, y, vx: 0, vy: -40, t: 0.8, text: String(n) });
    };
    const getCoin = (s: State, x: number, y: number, popped: boolean) => {
      s.coins += 1;
      s.score += 50;
      if (popped) s.fx.push({ kind: "coin", x, y, vx: 0, vy: -230, t: 0.55 });
    };

    const bump = (s: State, tx: number, ty: number) => {
      const t = tileAt(s, tx, ty);
      const p = s.player;
      if (t === "?" || t === "M") {
        s.grid[ty][tx] = "U";
        s.bumps.push({ x: tx, y: ty, t: 0.15 });
        if (t === "?") getCoin(s, tx * TILE + 4, ty * TILE - 8, true);
        else s.items.push({ x: tx * TILE + 2, y: ty * TILE, w: 12, h: 14, vx: 0, vy: 0, ground: false, rise: 0.6 });
      } else if (t === "B") {
        if (p.big) {
          s.grid[ty][tx] = " ";
          s.score += 20;
          for (const [vx, vy] of [[-60, -260], [60, -260], [-40, -180], [40, -180]]) s.fx.push({ kind: "bit", x: tx * TILE + 8, y: ty * TILE + 8, vx, vy, t: 1.2 });
        } else s.bumps.push({ x: tx, y: ty, t: 0.15 });
      }
      // an enemy standing on a bumped block gets knocked out
      for (const e of s.enemies) {
        if (e.alive && !e.squash && Math.abs(e.x + e.w / 2 - (tx * TILE + 8)) < 14 && Math.abs(e.y + e.h - ty * TILE) < 4) {
          e.alive = false;
          e.flip = true;
          e.vy = -200;
          addScore(s, 100, e.x, e.y);
        }
      }
    };

    const hurt = (s: State) => {
      const p = s.player;
      if (p.hurt > 0 || s.phase !== "play") return;
      if (p.big) {
        p.big = false;
        p.y += 10;
        p.h = 14;
        p.hurt = 1.6;
      } else die(s);
    };
    const die = (s: State) => {
      s.phase = "dying";
      s.phaseT = 0;
      s.player.vy = -330;
      s.player.big = false;
    };

    // ---------- one fixed step ----------
    const step = (s: State, dt: number) => {
      s.phaseT += dt;
      const input = held();
      if (s.phase === "title" || s.phase === "clear" || s.phase === "over" || s.phase === "end") {
        // jump to continue, after a short beat so a held key doesn't skip the card
        if (s.phaseT > 0.8 && input.jump && !s.player.jumpHeld) {
          if (s.phase === "title") {
            s.phase = "intro";
            s.phaseT = 0;
          } else if (s.phase === "clear") {
            if (s.level + 1 < LEVELS.length) {
              freshLevel(s, s.level + 1);
              s.phase = "intro";
              s.phaseT = 0;
            } else {
              s.phase = "end";
              s.phaseT = 0;
              onWinRef.current?.();
            }
          } else {
            const fresh = newGame();
            Object.assign(s, fresh);
          }
        }
        s.player.jumpHeld = input.jump;
        return;
      }
      if (s.phase === "intro") {
        if (s.phaseT > 2.4) {
          s.phase = "play";
          s.phaseT = 0;
        }
        return;
      }
      if (s.phase === "dying") {
        s.player.vy += 900 * dt;
        s.player.y += s.player.vy * dt;
        if (s.phaseT > 2.2) {
          s.lives -= 1;
          if (s.lives <= 0) {
            s.phase = "over";
            s.phaseT = 0;
          } else {
            s.player.big = false;
            freshLevel(s, s.level);
            s.phase = "intro";
            s.phaseT = 0;
          }
        }
        return;
      }

      const p = s.player;
      const L = LEVELS[s.level];
      // the flag: slide down, then walk off to the end card
      if (s.flagSlide > 0) {
        s.flagSlide += dt;
        if (p.y + p.h < 11 * TILE) p.y = Math.min(11 * TILE - p.h, p.y + 120 * dt);
        else {
          p.vx = 70;
          p.face = 1;
          p.walk += dt * 10;
          p.vy += 1400 * dt;
          move(s, p, dt);
        }
        if (s.flagSlide > 2.6) {
          s.phase = "clear";
          s.phaseT = 0;
        }
        return;
      }

      // running and jumping: snappy acceleration, more grip turning around, variable jump height
      const max = input.run ? 165 : 105;
      const acc = p.ground ? 620 : 420;
      if (input.left && !input.right) {
        p.vx -= (p.vx > 0 ? acc * 1.8 : acc) * dt;
        p.face = -1;
      } else if (input.right && !input.left) {
        p.vx += (p.vx < 0 ? acc * 1.8 : acc) * dt;
        p.face = 1;
      } else if (p.ground) {
        const f = 700 * dt;
        p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
      }
      p.vx = Math.max(-max, Math.min(max, p.vx));
      p.coyote = p.ground ? 0.09 : Math.max(0, p.coyote - dt);
      p.buffer = input.jump && !p.jumpHeld ? 0.12 : Math.max(0, p.buffer - dt);
      if (p.buffer > 0 && p.coyote > 0) {
        p.vy = -(390 + Math.abs(p.vx) * 0.35);
        p.coyote = 0;
        p.buffer = 0;
      }
      p.jumpHeld = input.jump;
      const rising = p.vy < 0;
      p.vy += (rising && input.jump ? 820 : 1600) * dt;
      p.vy = Math.min(p.vy, 430);
      const head = move(s, p, dt);
      if (head) bump(s, head.tx, head.ty);
      if (p.ground && Math.abs(p.vx) > 5) p.walk += dt * (6 + Math.abs(p.vx) * 0.06);
      if (p.hurt > 0) p.hurt -= dt;
      if (p.x < s.cam) {
        p.x = s.cam;
        p.vx = Math.max(0, p.vx);
      }
      if (p.y > VIEW_H + 16) return die(s);

      // coins sitting in the level
      for (let ty = Math.floor(p.y / TILE); ty <= Math.floor((p.y + p.h - 1) / TILE); ty++)
        for (let tx = Math.floor(p.x / TILE); tx <= Math.floor((p.x + p.w - 1) / TILE); tx++)
          if (tileAt(s, tx, ty) === "C") {
            s.grid[ty][tx] = " ";
            getCoin(s, tx * TILE, ty * TILE, false);
          }

      // the flag
      if (p.x + p.w > L.flagX * TILE - 2) {
        p.x = L.flagX * TILE - 4;
        p.vx = 0;
        p.vy = 0;
        s.flagSlide = 0.001;
        const height = Math.max(0, 11 * TILE - (p.y + p.h));
        addScore(s, 100 + Math.round(height / 16) * 400, p.x + 16, p.y);
        return;
      }

      // enemies: walk, turn at walls, get stomped
      for (const e of s.enemies) {
        if (!e.alive) {
          if (e.flip) {
            e.vy += 900 * dt;
            e.y += e.vy * dt;
          }
          continue;
        }
        if (e.squash > 0) {
          e.squash -= dt;
          if (e.squash <= 0) e.alive = false;
          continue;
        }
        // asleep until they come close to the screen
        if (e.x > s.cam + VIEW_W + 32) continue;
        const before = e.vx;
        e.vy = Math.min(e.vy + 1400 * dt, 430);
        move(s, e, dt);
        if (e.vx === 0) e.vx = -before;
        if (e.y > VIEW_H + 32) e.alive = false;
        if (p.hurt <= 0 && overlap(p, e)) {
          if (p.vy > 30 && p.y + p.h - e.y < 10) {
            e.squash = 0.45;
            p.vy = input.jump ? -380 : -240;
            addScore(s, 100, e.x, e.y - 6);
          } else hurt(s);
        }
      }
      // enemies turn when they bump into each other
      for (let i = 0; i < s.enemies.length; i++)
        for (let j = i + 1; j < s.enemies.length; j++) {
          const a = s.enemies[i];
          const b = s.enemies[j];
          if (a.alive && b.alive && !a.squash && !b.squash && overlap(a, b)) {
            a.vx = -Math.abs(a.vx) * Math.sign(b.x - a.x || 1);
            b.vx = Math.abs(b.vx) * Math.sign(b.x - a.x || 1);
          }
        }

      // coffee: rises out of its block, then slides along
      for (const it of s.items) {
        if (it.rise > 0) {
          it.rise -= dt;
          it.y -= (TILE / 0.6) * dt;
          if (it.rise <= 0) it.vx = 50;
          continue;
        }
        const before = it.vx;
        it.vy = Math.min(it.vy + 1200 * dt, 400);
        move(s, it, dt);
        if (it.vx === 0) it.vx = -before;
        if (overlap(p, it)) {
          it.y = 9999;
          addScore(s, 1000, p.x, p.y - 8);
          if (!p.big) {
            p.big = true;
            p.y -= 10;
            p.h = 24;
          }
        }
      }
      s.items = s.items.filter((it) => it.y < VIEW_H + 32);

      // the camera only scrolls forward, like the classics
      const target = p.x - VIEW_W * 0.4;
      s.cam = Math.max(s.cam, Math.min(target, s.grid[0].length * TILE - VIEW_W));
    };

    const overlap = (a: Body, b: Body) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    // ---------- drawing ----------
    const R = (x: number, y: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };

    const drawBackground = (s: State) => {
      const th = LEVELS[s.level].theme;
      const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      g.addColorStop(0, th.sky[0]);
      g.addColorStop(1, th.sky[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      if (th.stars)
        for (let i = 0; i < 60; i++) {
          const x = ((i * 97 - s.cam * 0.1) % VIEW_W + VIEW_W) % VIEW_W;
          R(x, (i * 53) % 110, 1, 1, i % 7 ? "rgba(255,255,255,0.6)" : "#fff");
        }
      else
        // clouds
        for (let i = 0; i < 6; i++) {
          const x = ((i * 140 + 30 - s.cam * 0.2) % (VIEW_W + 120) + VIEW_W + 120) % (VIEW_W + 120) - 60;
          const y = 20 + ((i * 37) % 50);
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.beginPath();
          ctx.ellipse(x, y, 22, 8, 0, 0, Math.PI * 2);
          ctx.ellipse(x - 12, y + 3, 12, 6, 0, 0, Math.PI * 2);
          ctx.ellipse(x + 13, y + 3, 13, 6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      // far skyline, then the level's landmark, then near hills/buildings, all with parallax
      for (let i = -1; i < 14; i++) {
        const x = i * 60 - ((s.cam * 0.3) % 60);
        const h = 40 + ((i * 29 + Math.floor(s.cam * 0.3 / 60) * 29) % 50);
        R(x, VIEW_H - 32 - h, 50, h, th.far);
        if (th.landmark !== "school") for (let w = 0; w < 6; w++) R(x + 6 + (w % 3) * 14, VIEW_H - 26 - h + Math.floor(w / 3) * 14, 6, 6, th.stars ? "rgba(255,210,120,0.55)" : "rgba(255,255,255,0.35)");
      }
      drawLandmark(s, th);
      for (let i = -1; i < 10; i++) {
        const x = i * 90 - ((s.cam * 0.55) % 90);
        if (th.landmark === "school") {
          ctx.fillStyle = th.near;
          ctx.beginPath();
          ctx.ellipse(x + 40, VIEW_H - 32, 50, 26, 0, Math.PI, 0);
          ctx.fill();
        } else R(x + 10, VIEW_H - 32 - 30, 40, 30, th.near);
      }
    };

    const drawLandmark = (s: State, th: Theme) => {
      // one big landmark that drifts by once per level
      const L = LEVELS[s.level];
      const x = L.flagX * TILE * 0.35 - s.cam * 0.35 + 90;
      if (x < -160 || x > VIEW_W + 40) return;
      const base = VIEW_H - 32;
      if (th.landmark === "school") {
        // the high school: a long brick building with a clock and a flag
        R(x, base - 60, 130, 60, "#b5705a");
        R(x + 50, base - 80, 30, 20, "#b5705a");
        R(x + 58, base - 74, 14, 14, "#f4f0e6");
        R(x + 64, base - 72, 2, 6, "#333");
        for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) R(x + 8 + i * 15, base - 50 + j * 20, 8, 10, "#cfe3f5");
        R(x + 60, base - 18, 10, 18, "#5a3a2a");
        R(x + 64, base - 104, 2, 24, "#ddd");
        R(x + 66, base - 104, 14, 8, "#d4202c");
      } else if (th.landmark === "city") {
        // the brand's pop-up shop: a storefront with the logo in the window
        R(x, base - 70, 120, 70, "#3a2a40");
        R(x - 4, base - 76, 128, 8, "#c2486a");
        ctx.fillStyle = "#ffe3ec";
        ctx.font = "bold 9px monospace";
        ctx.fillText("LOVEYOUREALLY", x + 18, base - 79);
        R(x + 10, base - 56, 46, 40, "#ffd6e0");
        R(x + 64, base - 56, 46, 40, "#ffd6e0");
        R(x + 26, base - 46, 14, 20, "#d4202c");
        R(x + 80, base - 46, 14, 20, "#1c1c1c");
        R(x + 50, base - 16, 20, 16, "#5a3a4a");
      } else {
        // University College: a stone gothic tower glowing purple
        R(x + 20, base - 50, 110, 50, "#6d6458");
        R(x + 55, base - 130, 34, 80, "#7a7064");
        R(x + 51, base - 138, 42, 10, "#6d6458");
        for (let i = 0; i < 4; i++) R(x + 52 + i * 10, base - 146, 6, 8, "#6d6458");
        R(x + 64, base - 120, 16, 24, "#b58cff");
        R(x + 70, base - 120, 4, 24, "#4f2683");
        for (let i = 0; i < 6; i++) R(x + 28 + i * 17, base - 40, 8, 14, "rgba(255,210,140,0.75)");
        ctx.fillStyle = "rgba(160,110,255,0.18)";
        ctx.beginPath();
        ctx.arc(x + 72, base - 100, 60, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawTile = (c: string, x: number, y: number, th: Theme, tx: number, ty: number, s: State) => {
      const bump = s.bumps.find((b) => b.x === tx && b.y === ty);
      if (bump) y -= Math.sin((1 - bump.t / 0.15) * Math.PI) * 5;
      if (c === "#") {
        R(x, y, 16, 16, th.ground);
        if (tileAt(s, tx, ty - 1) !== "#") {
          R(x, y, 16, 4, th.groundTop);
          R(x, y + 4, 16, 1, th.groundDark);
        }
        R(x + 3 + ((tx * 5) % 7), y + 8 + ((tx + ty) % 5), 2, 2, th.groundDark);
      } else if (c === "B") {
        R(x, y, 16, 16, th.brick);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(x, y + 7, 16, 1);
        ctx.fillRect(x, y + 15, 16, 1);
        ctx.fillRect(x + 7, y, 1, 7);
        ctx.fillRect(x + 3, y + 8, 1, 7);
        ctx.fillRect(x + 12, y + 8, 1, 7);
        R(x, y, 16, 1, "rgba(255,255,255,0.25)");
      } else if (c === "?" || c === "M") {
        const pulse = 0.75 + 0.25 * Math.sin(time * 6);
        R(x, y, 16, 16, `rgba(240,${Math.round(170 * pulse + 40)},60,1)`);
        R(x, y, 16, 1, "#fff2c0");
        R(x, y + 15, 16, 1, "#8a4a10");
        ctx.fillStyle = "#7a3a08";
        ctx.font = "bold 11px monospace";
        ctx.fillText("?", x + 5, y + 12);
        R(x + 1, y + 1, 1, 1, "#7a3a08");
        R(x + 14, y + 1, 1, 1, "#7a3a08");
      } else if (c === "U") {
        R(x, y, 16, 16, "#8a6a4a");
        R(x + 1, y + 1, 14, 14, "#9c7a56");
      } else if (c === "X") {
        R(x, y, 16, 16, th.groundDark);
        R(x + 1, y + 1, 14, 14, th.ground);
        R(x + 1, y + 1, 14, 2, "rgba(255,255,255,0.18)");
      } else if (c === "[" || c === "]" || c === "{" || c === "}") {
        const left = c === "[" || c === "{";
        const top = c === "[" || c === "]";
        const g = "#2f9a46";
        if (top) {
          R(left ? x - 2 : x, y, 18, 16, g);
          R(left ? x : x, y + 2, 3, 12, "#7fe08a");
          R(left ? x - 2 : x, y + 15, 18, 1, "#1d6a2e");
        } else {
          R(x, y, 16, 16, g);
          if (left) R(x + 2, y, 3, 16, "#7fe08a");
        }
      } else if (c === "C") drawCoin(x + 3, y + 2, th, time);
    };

    const drawCoin = (x: number, y: number, th: Theme, t: number) => {
      const squish = Math.abs(Math.cos(t * 4));
      const w = Math.max(2, Math.round(10 * squish));
      const cx = x + 5 - w / 2;
      if (th.coin === "heart") {
        ctx.fillStyle = "#ff5a8a";
        ctx.beginPath();
        ctx.arc(cx + w * 0.3, y + 4, w * 0.3, 0, Math.PI * 2);
        ctx.arc(cx + w * 0.7, y + 4, w * 0.3, 0, Math.PI * 2);
        ctx.lineTo(cx + w / 2, y + 12);
        ctx.fill();
      } else {
        R(cx, y, w, 12, th.coin === "credit" ? "#c9a8ff" : "#ffd23a");
        R(cx + 1, y + 1, Math.max(1, w - 2), 10, th.coin === "credit" ? "#a77cf0" : "#f0b020");
        if (squish > 0.6) {
          ctx.fillStyle = "#fff8d0";
          ctx.font = "bold 7px monospace";
          ctx.fillText(th.coin === "grade" ? "A" : "C", cx + w / 2 - 2, y + 9);
        }
      }
    };

    /** Shajith: black hair, a red hoodie (the room's red), jeans and white sneakers */
    const drawPlayer = (s: State) => {
      const p = s.player;
      if (p.hurt > 0 && Math.floor(p.hurt * 20) % 2 === 0) return;
      const x = Math.round(p.x - s.cam);
      const y = Math.round(p.y);
      const f = p.face;
      const big = p.big;
      const headH = 7;
      // small: 7 + 3 + 2 + shoes 2 = 14 px; big: 7 + 9 + 6 + 2 = 24 px, matching the physics box
      const bodyH = big ? 9 : 3;
      const legH = big ? 6 : 2;
      const stride = p.ground ? Math.sin(p.walk) : 0.6;
      ctx.save();
      ctx.translate(x + 6, y);
      ctx.scale(f, 1);
      // hair and face
      R(-4, 0, 9, 3, "#141414");
      R(-4, 3, 8, headH - 3, "#b07a52");
      R(-5, 2, 2, 3, "#141414");
      R(2, 4, 1, 1, "#141414");
      R(1, 6, 3, 1, "#7a4a30");
      // hoodie
      R(-5, headH, 10, bodyH, "#d4202c");
      R(-5, headH, 10, 1, "#a8161f");
      if (big) R(-1, headH + 3, 3, 3, "#f4f0e6");
      // arm swing
      const arm = Math.round(stride * 2);
      R(3 + (p.ground ? 0 : 1), headH + 1 + (p.ground ? arm : -2), 3, 4, "#d4202c");
      R(3 + (p.ground ? 0 : 1), headH + 5 + (p.ground ? arm : -2), 3, 1, "#b07a52");
      // legs
      const ly = headH + bodyH;
      const a = Math.round(stride * 2);
      R(-4 + a, ly, 4, legH, "#2c4a8a");
      R(1 - a, ly, 4, legH, "#2c4a8a");
      R(-5 + a, ly + legH, 5, 2, "#f4f4f4");
      R(1 - a, ly + legH, 5, 2, "#f4f4f4");
      ctx.restore();
    };

    const drawEnemy = (e: Enemy, s: State, th: Theme) => {
      const x = Math.round(e.x - s.cam);
      const y = Math.round(e.y);
      const squash = e.squash > 0;
      const h = squash ? 5 : 14;
      const top = y + (14 - h);
      ctx.save();
      if (e.flip) {
        ctx.translate(x + 6, top + h / 2);
        ctx.scale(1, -1);
        ctx.translate(-x - 6, -top - h / 2);
      }
      const step = Math.floor(time * 6) % 2;
      if (th.enemy === "quiz") {
        // a pop quiz: a sheet of paper with a big red F and angry eyes
        R(x, top, 12, h, "#f6f3ea");
        R(x, top, 12, 1, "#cfcabd");
        if (!squash) {
          ctx.fillStyle = "#d4202c";
          ctx.font = "bold 8px monospace";
          ctx.fillText("F", x + 7, top + 13);
          R(x + 2, top + 3, 2, 2, "#141414");
          R(x + 7, top + 3, 2, 2, "#141414");
          R(x + 1, top + 2, 3, 1, "#141414");
          R(x + 7, top + 2, 3, 1, "#141414");
          R(x + 1 + step, top + 14, 3, 2, "#141414");
          R(x + 8 - step, top + 14, 3, 2, "#141414");
        }
      } else if (th.enemy === "hater") {
        // a hater: a grumpy grey blob with a thumbs-down
        R(x, top + 2, 12, h - 2, "#7d7d86");
        R(x + 1, top, 10, 3, "#7d7d86");
        if (!squash) {
          R(x + 2, top + 4, 3, 2, "#fff");
          R(x + 7, top + 4, 3, 2, "#fff");
          R(x + 3, top + 5, 1, 1, "#141414");
          R(x + 8, top + 5, 1, 1, "#141414");
          R(x + 3, top + 9, 6, 1, "#141414");
          R(x + 1 + step, top + 13, 4, 2, "#3a3a40");
          R(x + 7 - step, top + 13, 4, 2, "#3a3a40");
        }
      } else {
        // a midterm: a fat purple textbook with fangs
        R(x, top, 12, h, "#5a2d91");
        R(x, top, 2, h, "#3a1a66");
        R(x + 10, top + 1, 2, h - 2, "#f4f0e6");
        if (!squash) {
          R(x + 3, top + 3, 2, 2, "#ffd23a");
          R(x + 7, top + 3, 2, 2, "#ffd23a");
          R(x + 3, top + 8, 1, 2, "#fff");
          R(x + 7, top + 8, 1, 2, "#fff");
          R(x + 1 + step, top + 14, 3, 2, "#2a1040");
          R(x + 8 - step, top + 14, 3, 2, "#2a1040");
        }
      }
      ctx.restore();
    };

    const drawCoffee = (it: Item, s: State) => {
      const x = Math.round(it.x - s.cam);
      const y = Math.round(it.y);
      R(x + 1, y + 3, 10, 11, "#f4f0e6");
      R(x + 1, y + 6, 10, 4, "#7a4a28");
      R(x, y + 1, 12, 3, "#3a2a20");
      R(x + 11, y + 6, 2, 5, "#f4f0e6");
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(x + 4, y - 2 - (Math.floor(time * 4) % 2), 1, 2);
      ctx.fillRect(x + 7, y - 3 + (Math.floor(time * 4) % 2), 1, 2);
    };

    const drawFlag = (s: State, th: Theme) => {
      const L = LEVELS[s.level];
      const x = L.flagX * TILE - s.cam + 7;
      if (x < -20 || x > VIEW_W + 20) return;
      R(x, 2 * TILE, 2, 9 * TILE, "#e8e8e8");
      R(x - 2, 2 * TILE - 4, 6, 6, "#ffd23a");
      const fy = 2 * TILE + 4 + Math.min(1, s.flagSlide / 1.2) * 7.5 * TILE;
      const color = th.landmark === "uc" ? "#4f2683" : th.landmark === "city" ? "#c2486a" : "#d4202c";
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, fy);
      ctx.lineTo(x - 18, fy + 6);
      ctx.lineTo(x, fy + 12);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 6px monospace";
      ctx.fillText(th.landmark === "uc" ? "W" : th.landmark === "city" ? "LYR" : "C", x - 10, fy + 8);
    };

    const text = (t: string, x: number, y: number, size: number, color = "#fff", align: CanvasTextAlign = "center") => {
      ctx.font = `bold ${size}px "Space Grotesk", system-ui, sans-serif`;
      ctx.textAlign = align;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillText(t, x + 1, y + 1);
      ctx.fillStyle = color;
      ctx.fillText(t, x, y);
      ctx.textAlign = "left";
    };

    const card = (s: State) => {
      ctx.fillStyle = "rgba(6,7,12,0.82)";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      const L = LEVELS[s.level];
      const blink = Math.floor(time * 2) % 2 === 0;
      if (s.phase === "title") {
        text("SUPER", VIEW_W / 2, 62, 14, "#fcd99a");
        text("SHAJITH", VIEW_W / 2, 92, 30, "#ffffff");
        text("A platformer through my life", VIEW_W / 2, 116, 9, "rgba(255,255,255,0.75)");
        text("Brampton → LoveYouReally → Western", VIEW_W / 2, 132, 8, "rgba(255,255,255,0.55)");
        if (blink) text("Press jump to start", VIEW_W / 2, 176, 10, "#fcd99a");
      } else if (s.phase === "intro") {
        text(`WORLD ${L.name}`, VIEW_W / 2, 70, 10, "#fcd99a");
        text(L.place, VIEW_W / 2, 98, 22);
        text(L.years, VIEW_W / 2, 118, 8, "rgba(255,255,255,0.65)");
        text(L.intro, VIEW_W / 2, 150, 8, "rgba(255,255,255,0.85)");
        text(`× ${s.lives}`, VIEW_W / 2, 180, 10);
      } else if (s.phase === "clear") {
        text(`WORLD ${L.name} CLEAR`, VIEW_W / 2, 56, 10, "#fcd99a");
        L.outro.forEach((line, i) => text(line, VIEW_W / 2, 90 + i * 22, i === 0 ? 13 : 9, i === 0 ? "#fff" : "rgba(255,255,255,0.8)"));
        if (blink && s.phaseT > 0.8) text(s.level + 1 < LEVELS.length ? "Press jump for the next world" : "Press jump", VIEW_W / 2, 186, 9, "#fcd99a");
      } else if (s.phase === "over") {
        text("GAME OVER", VIEW_W / 2, 100, 20);
        text("Every setback is a setup. Try again?", VIEW_W / 2, 124, 8, "rgba(255,255,255,0.75)");
        if (blink && s.phaseT > 0.8) text("Press jump", VIEW_W / 2, 170, 10, "#fcd99a");
      } else if (s.phase === "end") {
        text("TO BE CONTINUED…", VIEW_W / 2, 70, 16, "#fcd99a");
        text("Shajith Sasikumar", VIEW_W / 2, 104, 14);
        text("BESc + Ivey HBA · Western University", VIEW_W / 2, 122, 8, "rgba(255,255,255,0.75)");
        text(`Score ${s.score}`, VIEW_W / 2, 150, 10);
        if (blink && s.phaseT > 0.8) text("Press jump to play again", VIEW_W / 2, 186, 9, "#fcd99a");
      }
    };

    const draw = (s: State) => {
      const L = LEVELS[s.level];
      const th = L.theme;
      drawBackground(s);
      const c0 = Math.floor(s.cam / TILE);
      for (let ty = 0; ty < ROWS; ty++)
        for (let tx = c0; tx <= c0 + VIEW_W / TILE + 1; tx++) {
          const c = tileAt(s, tx, ty);
          if (c !== " " && tx >= 0) drawTile(c, tx * TILE - s.cam, ty * TILE, th, tx, ty, s);
        }
      drawFlag(s, th);
      for (const it of s.items) drawCoffee(it, s);
      for (const e of s.enemies) if (e.alive || e.flip) drawEnemy(e, s, th);
      if (s.phase !== "title") drawPlayer(s);
      for (const f of s.fx) {
        const x = f.x - s.cam;
        if (f.kind === "coin") drawCoin(x, f.y, th, time * 3);
        else if (f.kind === "bit") R(x, f.y, 5, 5, th.brick);
        else text(f.text ?? "", x, f.y, 7, "#fff");
      }
      // HUD
      if (s.phase !== "title") {
        text("SHAJITH", 10, 14, 8, "#fff", "left");
        text(String(s.score).padStart(6, "0"), 10, 25, 8, "#fff", "left");
        text(L.coinName.toUpperCase(), 100, 14, 8, "#fff", "left");
        text(`${(s.coins * L.coinValue).toLocaleString()}`, 100, 25, 8, "#fcd99a", "left");
        text(`WORLD ${L.name}`, 190, 14, 8, "#fff", "left");
        text(L.place, 190, 25, 8, "rgba(255,255,255,0.8)", "left");
        text(`× ${s.lives}`, VIEW_W - 10, 14, 8, "#fff", "right");
      }
      if (s.phase !== "play" && s.phase !== "dying") card(s);
    };

    const tickFx = (s: State, dt: number) => {
      for (const f of s.fx) {
        f.t -= dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.kind !== "score") f.vy += 900 * dt;
      }
      s.fx = s.fx.filter((f) => f.t > 0);
      for (const b of s.bumps) b.t -= dt;
      s.bumps = s.bumps.filter((b) => b.t > 0);
    };

    const loop = (now: number) => {
      const s = stateRef.current;
      acc += Math.min(0.1, (now - last) / 1000);
      last = now;
      while (acc >= STEP) {
        step(s, STEP);
        jumpTap.current = false;
        tickFx(s, STEP);
        time += STEP;
        acc -= STEP;
      }
      draw(s);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    force((n) => n + 1);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", down);
    };
  }, []);

  // touch: hold-to-press buttons
  const pad = (k: keyof typeof touch.current, label: string, className = "") => (
    <button
      type="button"
      aria-label={k}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
        touch.current[k] = true;
        if (k === "jump") jumpTap.current = true;
      }}
      onPointerUp={() => (touch.current[k] = false)}
      onPointerCancel={() => (touch.current[k] = false)}
      onPointerLeave={() => (touch.current[k] = false)}
      className={`grid touch-none select-none place-items-center rounded-2xl border border-white/15 bg-white/10 text-lg font-bold text-white active:scale-95 active:bg-white/25 ${className}`}
    >
      {label}
    </button>
  );

  return (
    <div className="text-center">
      <p className="mb-4 text-sm text-white/70">
        <span className="[@media(pointer:coarse)]:hidden">Move with ← → or A/D, jump with Space, ↑ or W, run with Shift.</span>
        <span className="hidden [@media(pointer:coarse)]:inline">Use the buttons below: move, run, and jump.</span>
      </p>
      <div className="relative inline-block overflow-hidden rounded-lg border border-white/10">
        <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} className="block max-w-full [image-rendering:pixelated]" style={{ aspectRatio: `${VIEW_W}/${VIEW_H}`, width: 720 }} />
      </div>
      {/* touch controls, only on touch screens */}
      <div className="mx-auto mt-4 hidden max-w-sm items-center justify-between gap-3 [@media(pointer:coarse)]:flex">
        <div className="flex gap-2">
          {pad("left", "◀", "h-14 w-14")}
          {pad("right", "▶", "h-14 w-14")}
        </div>
        <div className="flex gap-2">
          {pad("run", "B", "h-14 w-14 text-amber-200")}
          {pad("jump", "A", "h-16 w-16 bg-amber-200/20 text-amber-100")}
        </div>
      </div>
    </div>
  );
};

export default SuperShajith;
