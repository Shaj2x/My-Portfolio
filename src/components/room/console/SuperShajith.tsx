import { useEffect, useRef, useState } from "react";
import ssCoin from "@/assets/ss-coin.png";

/*
 * Super Shajith: a side-scrolling platformer through Shajith's life, in the classic run-and-jump
 * format (original pixel art, drawn in code; no borrowed sprites).
 *
 *   1-1 The Grind       high school: dodge Pop Quizzes, collect A+ grades, graduate
 *   1-2 The Hustle      the streetwear brand: stomp the Haters, collect followers
 *   1-3 Next Level      first year: get past the Midterms to University College
 *
 * Coins are the black-and-white SS logo. ? blocks give coins or a fragrance to spray on:
 *   Breeze       (blue)   grow big: one free hit, and bricks break
 *   Oud Noir     (black)  big, and B/Shift sprays a cloud that knocks enemies out
 *   Citrus Rush  (orange) nine seconds unstoppable: faster, higher, enemies fall at a touch
 * Stomp enemies from above, don't fall in the gaps, and touch the flag. Keyboard, touch buttons, or a controller
 * (the console maps its D-pad to arrow keys and ✕ to Space).
 *
 * Extras: stomp combos (chain stomps without landing for more points, then extra lives), springs,
 * three hidden gold SS coins per world, a checkpoint halfway, best times, and 100 coins for a life.
 * Progress, gold coins and best times are saved on the device, so Continue picks up where you left off.
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
  coinName: string;
  /** how much one coin counts for in the HUD (followers go up in hundreds) */
  coinValue: number;
  enemyName: string;
  theme: Theme;
  grid: string[][];
  enemies: Spawn[];
  flagX: number;
  /** the checkpoint's column: die after passing it and you come back here */
  checkX: number;
  /** where the hidden gold coins are, in order along the level */
  golds: Spawn[];
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
function build(len: number, theme: Theme, spec: (b: Builder) => void, meta: Omit<Level, "grid" | "enemies" | "flagX" | "checkX" | "golds" | "theme">): Level {
  const grid = Array.from({ length: ROWS }, () => Array<string>(len).fill(" "));
  const enemies: Spawn[] = [];
  const golds: Spawn[] = [];
  let flagX = len - 6;
  let checkX = Math.floor(len / 2);
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
    spring: (x, y = 11) => set(x, y, "S"),
    gold: (x, y) => {
      set(x, y, "G");
      golds.push({ x, y });
    },
    checkpoint: (x) => {
      checkX = x;
    },
  };
  spec(b);
  golds.sort((a, c) => a.x - c.x);
  return { ...meta, theme, grid, enemies, flagX, checkX, golds };
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
  /** a spring: land on it to bounce up high (hold jump for higher) */
  spring: (x: number, y?: number) => void;
  /** a hidden gold SS coin; three per world */
  gold: (x: number, y: number) => void;
  checkpoint: (x: number) => void;
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
      b.tile(100, 4, "O");
      b.tile(104, 8, "?");
      b.enemy(102);
      b.enemy(106);
      b.ground(116, 159);
      b.stairs(120, 4);
      b.stairs(126, 4, true);
      b.stairs(134, 8);
      b.flag(150);
      // extras: gold coins over the tall pipe, up a spring, and low over the last gap
      b.gold(49, 4);
      b.spring(92);
      b.gold(92, 2);
      b.gold(114, 10);
      b.checkpoint(76);
    },
    {
      name: "1-1",
      place: "The Grind",
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
      b.tile(16, 8, "N");
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
      b.tile(128, 8, "O");
      b.row(132, 8, 4, "?");
      b.enemy(134);
      b.enemy(138);
      b.stairs(144, 7);
      b.flag(160);
      b.gold(32, 3);
      b.spring(68);
      b.gold(68, 2);
      b.gold(106, 4);
      b.checkpoint(82);
    },
    {
      name: "1-2",
      place: "The Hustle",
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
      b.tile(85, 8, "N");
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
      b.gold(37, 2);
      b.spring(70);
      b.gold(70, 2);
      b.gold(159, 1);
      b.checkpoint(80);
    },
    {
      name: "1-3",
      place: "Next Level",
      coinName: "Credits",
      coinValue: 1,
      enemyName: "Midterm",
    },
  ),
];

const SOLID = new Set(["#", "B", "?", "M", "N", "O", "U", "X", "S", "[", "]", "{", "}"]);
/** points for each stomp in a row without landing; past the end, each one is an extra life */
const COMBO = [100, 200, 400, 800, 1000, 2000, 4000, 8000];

// ---------- saved on this device ----------
const SAVE_KEY = "super-shajith:save";
interface Save {
  /** where to continue: the world, and whether its checkpoint was reached */
  level: number;
  checkpoint: boolean;
  lives: number;
  score: number;
  coins: number;
  big: boolean;
  spray: boolean;
  /** gold coins found, per world; they stay found */
  gold: boolean[][];
  /** best clear time per world, in seconds */
  best: (number | null)[];
}
const blankSave = (): Save => ({ level: 0, checkpoint: false, lives: 3, score: 0, coins: 0, big: false, spray: false, gold: LEVELS.map((L) => L.golds.map(() => false)), best: LEVELS.map(() => null) });
const loadSave = (): Save => {
  const save = blankSave();
  try {
    const v = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null");
    if (v && typeof v === "object") {
      if (Number.isInteger(v.level) && v.level >= 0 && v.level < LEVELS.length) save.level = v.level;
      save.checkpoint = !!v.checkpoint;
      if (Number.isFinite(v.lives) && v.lives > 0) save.lives = Math.min(99, v.lives);
      if (Number.isFinite(v.score)) save.score = Math.max(0, v.score);
      if (Number.isFinite(v.coins)) save.coins = Math.max(0, v.coins);
      save.big = !!v.big;
      save.spray = !!v.spray;
      if (Array.isArray(v.gold)) save.gold = save.gold.map((row, i) => row.map((_, j) => !!v.gold[i]?.[j]));
      if (Array.isArray(v.best)) save.best = save.best.map((_, i) => (Number.isFinite(v.best[i]) ? v.best[i] : null));
    }
  } catch {
    // start fresh
  }
  return save;
};
const writeSave = (save: Save) => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // not kept
  }
};
const goldCount = (save: Save) => save.gold.flat().filter(Boolean).length;
const goldTotal = LEVELS.reduce((n, L) => n + L.golds.length, 0);

// ---------- fragrances ----------
type Scent = "breeze" | "oud" | "citrus";
const SCENT_OF: Record<string, Scent> = { M: "breeze", N: "oud", O: "citrus" };
const SCENTS: Record<Scent, { name: string; hint: string; glass: string; liquid: string; cap: string; mist: string }> = {
  breeze: { name: "BREEZE", hint: "+1 hit", glass: "#cfe6ff", liquid: "#7fb8ff", cap: "#f4f4f4", mist: "200,225,255" },
  oud: { name: "OUD NOIR", hint: "B to spray", glass: "#2a2a30", liquid: "#141418", cap: "#e0b44a", mist: "230,200,140" },
  citrus: { name: "CITRUS RUSH", hint: "unstoppable!", glass: "#ffc27a", liquid: "#ff8a1e", cap: "#5fbf4a", mist: "255,200,120" },
};
const STAR_TIME = 9;

/** the SS logo, drawn as the coins */
const coinImg = typeof Image !== "undefined" ? Object.assign(new Image(), { src: ssCoin }) : null;

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
  scent: Scent;
}
interface Fx {
  kind: "coin" | "bit" | "score" | "mist";
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
  player: Body & { big: boolean; spray: boolean; star: number; face: 1 | -1; hurt: number; walk: number; jumpHeld: boolean; runHeld: boolean; sprayCool: number; coyote: number; buffer: number; combo: number };
  /** clouds of Oud Noir, sprayed forward; they knock out whatever they touch */
  clouds: { x: number; y: number; vx: number; t: number }[];
  enemies: Enemy[];
  items: Item[];
  fx: Fx[];
  bumps: { x: number; y: number; t: number }[];
  cam: number;
  coins: number;
  score: number;
  lives: number;
  flagSlide: number;
  checkpoint: boolean;
  /** seconds spent in this world (it keeps counting through lost lives) */
  time: number;
  save: Save;
  /** the title menu: 0 continue, 1 new game */
  menu: number;
  menuHeld: boolean;
  /** this clear beat the world's best time */
  record: boolean;
}

/** sets up a world; `respawn` keeps the checkpoint and the clock from the life just lost */
const freshLevel = (s: State, index: number, respawn = false) => {
  const L = LEVELS[index];
  if (!respawn || index !== s.level) {
    s.checkpoint = false;
    s.time = 0;
  }
  s.level = index;
  s.grid = L.grid.map((r) => r.slice());
  // gold coins already found show as faint outlines
  L.golds.forEach((g, i) => {
    if (s.save.gold[index][i]) s.grid[g.y][g.x] = "g";
  });
  const startX = s.checkpoint ? L.checkX * TILE + 2 : 2 * TILE;
  s.player = { x: startX, y: 10 * TILE, w: 12, h: 14, vx: 0, vy: 0, ground: false, big: s.player?.big ?? false, spray: s.player?.spray ?? false, star: 0, face: 1, hurt: 0, walk: 0, jumpHeld: true, runHeld: false, sprayCool: 0, coyote: 0, buffer: 0, combo: 0 };
  if (s.player.big) {
    s.player.h = 24;
    s.player.y -= 10;
  }
  s.enemies = L.enemies.map((e) => ({ x: e.x + 2, y: e.y + 2, w: 12, h: 14, vx: -28, vy: 0, ground: false, alive: true, squash: 0, flip: false }));
  s.items = [];
  s.clouds = [];
  s.fx = [];
  s.bumps = [];
  s.cam = Math.max(0, startX - VIEW_W * 0.3);
  s.flagSlide = 0;
  s.record = false;
};

/** remembers where you are, so Continue comes back here */
const saveProgress = (s: State) => {
  Object.assign(s.save, { level: s.level, checkpoint: s.checkpoint, lives: s.lives, score: s.score, coins: s.coins, big: s.player.big, spray: s.player.spray });
  writeSave(s.save);
};
const hasProgress = (save: Save) => save.level > 0 || save.checkpoint || save.score > 0;

const newGame = (): State => {
  const save = loadSave();
  const s = { phase: "title", phaseT: 0, level: 0, coins: 0, score: 0, lives: 3, save, menu: hasProgress(save) ? 0 : 1, menuHeld: false } as State;
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
        down: !!(k.ArrowDown || k.s),
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
    const oneUp = (s: State, x: number, y: number) => {
      s.lives = Math.min(99, s.lives + 1);
      s.fx.push({ kind: "score", x, y, vx: 0, vy: -36, t: 1.1, text: "1-UP" });
    };
    const getCoin = (s: State, x: number, y: number, popped: boolean) => {
      s.coins += 1;
      s.score += 50;
      if (popped) s.fx.push({ kind: "coin", x, y, vx: 0, vy: -230, t: 0.55 });
      if (s.coins % 100 === 0) oneUp(s, x, y - 10);
    };
    /** a stomp (or a citrus knock-out): worth more each time in a row before you land */
    const comboReward = (s: State, x: number, y: number) => {
      const p = s.player;
      if (p.combo < COMBO.length) addScore(s, COMBO[p.combo], x, y);
      else oneUp(s, x, y);
      p.combo += 1;
    };

    const bump = (s: State, tx: number, ty: number) => {
      const t = tileAt(s, tx, ty);
      const p = s.player;
      if (t === "?" || SCENT_OF[t]) {
        s.grid[ty][tx] = "U";
        s.bumps.push({ x: tx, y: ty, t: 0.15 });
        if (t === "?") getCoin(s, tx * TILE + 4, ty * TILE - 8, true);
        else s.items.push({ x: tx * TILE + 3, y: ty * TILE, w: 10, h: 14, vx: 0, vy: 0, ground: false, rise: 0.6, scent: SCENT_OF[t] });
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

    const knockOut = (s: State, e: Enemy, combo = false) => {
      e.alive = false;
      e.flip = true;
      e.vy = -220;
      if (combo) comboReward(s, e.x, e.y - 6);
      else addScore(s, 200, e.x, e.y - 6);
    };
    const mistPuff = (s: State, x: number, y: number, n: number, scent: Scent) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        s.fx.push({ kind: "mist", x, y, vx: Math.cos(a) * (30 + Math.random() * 40), vy: Math.sin(a) * (20 + Math.random() * 30) - 20, t: 0.9, text: scent });
      }
    };

    const hurt = (s: State) => {
      const p = s.player;
      if (p.hurt > 0 || p.star > 0 || s.phase !== "play") return;
      if (p.spray) {
        p.spray = false;
        p.hurt = 1.6;
      } else if (p.big) {
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
      s.player.spray = false;
      s.player.star = 0;
    };

    // ---------- one fixed step ----------
    const step = (s: State, dt: number) => {
      s.phaseT += dt;
      const input = held();
      if (s.phase === "title" || s.phase === "clear" || s.phase === "over" || s.phase === "end") {
        // on the title, left/right (or down) picks Continue or New game
        const side = input.left || input.right || input.down;
        if (s.phase === "title" && hasProgress(s.save) && side && !s.menuHeld) s.menu = 1 - s.menu;
        s.menuHeld = side;
        // jump to go on, after a short beat so a held key doesn't skip the card
        if (s.phaseT > 0.5 && input.jump && !s.player.jumpHeld) {
          const start = () => {
            s.phase = "intro";
            s.phaseT = 0;
          };
          if (s.phase === "title") {
            if (s.menu === 0 && hasProgress(s.save)) {
              const v = s.save;
              Object.assign(s, { lives: v.lives, score: v.score, coins: v.coins, checkpoint: v.checkpoint });
              s.player.big = v.big;
              s.player.spray = v.spray;
              s.level = v.level;
              freshLevel(s, v.level, true);
            } else {
              Object.assign(s, { lives: 3, score: 0, coins: 0 });
              s.player.big = false;
              s.player.spray = false;
              freshLevel(s, 0);
            }
            saveProgress(s);
            start();
          } else if (s.phase === "clear") {
            if (s.level + 1 < LEVELS.length) {
              freshLevel(s, s.level + 1);
              saveProgress(s);
              start();
            } else {
              s.phase = "end";
              s.phaseT = 0;
              // beaten: the next game starts from the top (gold coins and best times stay)
              Object.assign(s.save, { level: 0, checkpoint: false, lives: 3, score: 0, coins: 0, big: false, spray: false });
              writeSave(s.save);
              onWinRef.current?.();
            }
          } else if (s.phase === "over") {
            // try the same world again, from its start, with fresh lives
            Object.assign(s, { lives: 3, score: 0, coins: 0, checkpoint: false });
            s.player.big = false;
            s.player.spray = false;
            freshLevel(s, s.level);
            saveProgress(s);
            start();
          } else Object.assign(s, newGame());
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
            s.player.spray = false;
            freshLevel(s, s.level, true);
            saveProgress(s);
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
          const best = s.save.best[s.level];
          s.record = best === null || s.time < best;
          if (s.record) s.save.best[s.level] = Math.round(s.time * 10) / 10;
          writeSave(s.save);
        }
        return;
      }
      s.time += dt;

      // running and jumping: snappy acceleration, more grip turning around, variable jump height
      const star = p.star > 0;
      const max = (input.run ? 165 : 105) * (star ? 1.25 : 1);
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
        p.vy = -(390 + Math.abs(p.vx) * 0.35) * (star ? 1.12 : 1);
        p.coyote = 0;
        p.buffer = 0;
      }
      p.jumpHeld = input.jump;
      // Oud Noir: a press of B/Shift sprays a cloud forward
      if (p.spray && input.run && !p.runHeld && p.sprayCool <= 0) {
        s.clouds.push({ x: p.x + (p.face > 0 ? p.w : -6), y: p.y + 6, vx: p.face * 190 + p.vx * 0.5, t: 0.6 });
        p.sprayCool = 0.32;
      }
      p.runHeld = input.run;
      p.sprayCool = Math.max(0, p.sprayCool - dt);
      if (p.star > 0) {
        p.star -= dt;
        if (Math.random() < 0.5) s.fx.push({ kind: "mist", x: p.x + Math.random() * p.w, y: p.y + Math.random() * p.h, vx: 0, vy: -20, t: 0.5, text: "citrus" });
      }
      const rising = p.vy < 0;
      p.vy += (rising && input.jump ? 820 : 1600) * dt;
      p.vy = Math.min(p.vy, 430);
      const head = move(s, p, dt);
      if (head) bump(s, head.tx, head.ty);
      // a spring underfoot launches you; hold jump to go higher
      if (p.ground) {
        const sx = Math.floor((p.x + p.w / 2) / TILE);
        const sy = Math.floor((p.y + p.h + 1) / TILE);
        if (tileAt(s, sx, sy) === "S") {
          p.vy = input.jump ? -540 : -420;
          p.ground = false;
          p.coyote = 0;
          s.bumps.push({ x: sx, y: sy, t: 0.2 });
        }
      }
      if (p.ground && Math.abs(p.vx) > 5) p.walk += dt * (6 + Math.abs(p.vx) * 0.06);
      if (p.hurt > 0) p.hurt -= dt;
      // the start of the level is a wall
      if (p.x < 0) {
        p.x = 0;
        p.vx = Math.max(0, p.vx);
      }
      if (p.y > VIEW_H + 16) return die(s);

      // coins sitting in the level
      for (let ty = Math.floor(p.y / TILE); ty <= Math.floor((p.y + p.h - 1) / TILE); ty++)
        for (let tx = Math.floor(p.x / TILE); tx <= Math.floor((p.x + p.w - 1) / TILE); tx++)
          if (tileAt(s, tx, ty) === "C") {
            s.grid[ty][tx] = " ";
            getCoin(s, tx * TILE, ty * TILE, false);
          } else if (tileAt(s, tx, ty) === "G" || tileAt(s, tx, ty) === "g") {
            // a gold coin: found for good the first time
            const fresh = tileAt(s, tx, ty) === "G";
            s.grid[ty][tx] = " ";
            const i = L.golds.findIndex((g) => g.x === tx && g.y === ty);
            if (fresh && i >= 0) {
              s.save.gold[s.level][i] = true;
              writeSave(s.save);
            }
            addScore(s, fresh ? 2000 : 200, tx * TILE, ty * TILE);
            s.fx.push({ kind: "score", x: tx * TILE - 14, y: ty * TILE - 14, vx: 0, vy: -24, t: 1.3, text: fresh ? `GOLD SS ${s.save.gold[s.level].filter(Boolean).length}/${L.golds.length}` : "already found" });
            for (let k = 0; k < 8; k++) s.fx.push({ kind: "mist", x: tx * TILE + 8, y: ty * TILE + 8, vx: Math.cos(k) * 60, vy: Math.sin(k) * 60, t: 0.6, text: "gold" });
          }

      // the checkpoint
      if (!s.checkpoint && p.x > L.checkX * TILE) {
        s.checkpoint = true;
        s.fx.push({ kind: "score", x: L.checkX * TILE - 20, y: 7 * TILE, vx: 0, vy: -20, t: 1.4, text: "CHECKPOINT" });
        saveProgress(s);
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
        // they turn around at the edge of a drop instead of walking off it
        if (e.ground) {
          const aheadX = e.vx > 0 ? e.x + e.w + 1 : e.x - 1;
          if (!solidAt(s, aheadX, e.y + e.h + 2)) e.vx = -e.vx;
        }
        const before = e.vx;
        e.vy = Math.min(e.vy + 1400 * dt, 430);
        move(s, e, dt);
        if (e.vx === 0) e.vx = -before;
        if (e.y > VIEW_H + 32) e.alive = false;
        if (p.star > 0 && overlap(p, e)) {
          knockOut(s, e, true);
          continue;
        }
        if (p.hurt <= 0 && overlap(p, e)) {
          if (p.vy > 30 && p.y + p.h - e.y < 10) {
            e.squash = 0.45;
            p.vy = input.jump ? -380 : -240;
            comboReward(s, e.x, e.y - 6);
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

      // spray clouds drift forward, slow, and fade; anything they touch is knocked out
      for (const c of s.clouds) {
        c.t -= dt;
        c.x += c.vx * dt;
        c.vx *= 1 - 2.2 * dt;
        const box = { x: c.x - 6, y: c.y - 6, w: 14, h: 14 };
        for (const e of s.enemies) if (e.alive && !e.squash && overlap(box as Body, e)) knockOut(s, e);
        if (solidAt(s, c.x, c.y)) c.t = Math.min(c.t, 0.08);
      }
      s.clouds = s.clouds.filter((c) => c.t > 0);

      // fragrances: rise out of the block, then slide along until caught
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
          s.score += 1000;
          const info = SCENTS[it.scent];
          s.fx.push({ kind: "score", x: p.x - 10, y: p.y - 12, vx: 0, vy: -26, t: 1.6, text: `${info.name}: ${info.hint}` });
          mistPuff(s, p.x + p.w / 2, p.y + p.h / 2, 14, it.scent);
          if (it.scent === "citrus") p.star = STAR_TIME;
          else {
            if (!p.big) {
              p.big = true;
              p.y -= 10;
              p.h = 24;
            }
            if (it.scent === "oud") p.spray = true;
          }
        }
      }
      s.items = s.items.filter((it) => it.y < VIEW_H + 32);

      if (p.star <= 0 && p.ground) p.combo = 0;
      // the camera follows both ways, so you can walk back for something you missed; it only
      // moves once you leave the middle of the screen, so small steps don't make it wobble
      const want = Math.min(Math.max(s.cam, p.x - VIEW_W * 0.45), p.x - VIEW_W * 0.3);
      s.cam = Math.max(0, Math.min(want, s.grid[0].length * TILE - VIEW_W));
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
      if (bump && c !== "S") y -= Math.sin((1 - bump.t / 0.15) * Math.PI) * 5;
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
      } else if (c === "?" || c === "M" || c === "N" || c === "O") {
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
      else if (c === "G" || c === "g") drawGold(x, y, c === "g");
      else if (c === "S") {
        // a spring: red pad on a coil, squashed for a moment after a bounce
        const squash = bump ? 5 : 0;
        R(x + 1, y + 4 + squash, 14, 3, "#d4202c");
        R(x + 1, y + 4 + squash, 14, 1, "#ff6a6a");
        for (let i = 0; i < 3; i++) R(x + 3, y + 8 + squash + i * Math.max(1, 3 - squash / 2), 10, 1, "#cfd3da");
        R(x + 1, y + 14, 14, 2, "#6a6f78");
      }
    };

    /** a gold SS coin: bigger, ringed in gold, with a sparkle; faint once it's been found */
    const drawGold = (x: number, y: number, found: boolean) => {
      ctx.save();
      ctx.globalAlpha = found ? 0.35 : 1;
      const bob = Math.sin(time * 3 + x) * 1.5;
      ctx.fillStyle = "#f2c14e";
      ctx.beginPath();
      ctx.arc(x + 8, y + 8 + bob, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#a8781a";
      ctx.beginPath();
      ctx.arc(x + 8, y + 8 + bob, 6.5, 0, Math.PI * 2);
      ctx.fill();
      if (coinImg?.complete && coinImg.naturalWidth) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(coinImg, x + 2, y + 2 + bob, 12, 12);
        ctx.imageSmoothingEnabled = false;
      }
      if (!found && Math.floor(time * 4) % 4 === 0) {
        R(x + 13, y + 1 + bob, 1, 3, "#fff");
        R(x + 12, y + 2 + bob, 3, 1, "#fff");
      }
      ctx.restore();
    };

    /** a coin: the black-and-white SS logo, spinning (it narrows to its edge and back) */
    const drawCoin = (x: number, y: number, _th: Theme, t: number) => {
      const squish = Math.abs(Math.cos(t * 4));
      const w = Math.max(2, Math.round(11 * squish));
      const cx = x + 5.5 - w / 2;
      if (coinImg?.complete && coinImg.naturalWidth) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(coinImg, Math.round(cx), Math.round(y), w, 11);
        ctx.imageSmoothingEnabled = false;
        // its silver edge catching the light as it turns side-on
        if (squish < 0.35) R(cx, y + 1, w, 9, "#d8d8de");
      } else {
        R(cx, y, w, 11, "#141414");
        R(cx, y, w, 1, "#e6e6ea");
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
      if (p.star > 0 && Math.floor(time * 16) % 2 === 0) R(-5, headH, 10, bodyH, "#ff8a1e");
      // arm swing
      const arm = Math.round(stride * 2);
      R(3 + (p.ground ? 0 : 1), headH + 1 + (p.ground ? arm : -2), 3, 4, "#d4202c");
      R(3 + (p.ground ? 0 : 1), headH + 5 + (p.ground ? arm : -2), 3, 1, "#b07a52");
      // with Oud Noir he carries the bottle, ready to spray
      if (p.spray) {
        R(6 + (p.ground ? 0 : 1), headH + 2 + (p.ground ? arm : -2), 3, 4, "#141418");
        R(6 + (p.ground ? 0 : 1), headH + 1 + (p.ground ? arm : -2), 3, 1, "#e0b44a");
      }
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

    /** a fragrance: a little glass bottle with its colour, cap and label, glinting */
    const drawBottle = (it: Item, s: State) => {
      const x = Math.round(it.x - s.cam);
      const y = Math.round(it.y);
      const c = SCENTS[it.scent];
      // cap and atomiser
      R(x + 3, y, 4, 3, c.cap);
      R(x + 4, y + 3, 2, 1, "#9a9aa0");
      // glass body with the juice inside
      R(x, y + 4, 10, 10, c.glass);
      R(x + 1, y + 7, 8, 6, c.liquid);
      // label and a moving glint
      R(x + 2, y + 8, 6, 3, it.scent === "oud" ? "#e0b44a" : "#ffffff");
      const g = Math.floor(time * 3) % 6;
      if (g < 3) R(x + 1 + g, y + 5, 1, 2, "rgba(255,255,255,0.85)");
    };

    /** the checkpoint: a short pole whose flag runs up (and turns gold) once you pass */
    const drawCheckpoint = (s: State) => {
      const L = LEVELS[s.level];
      const x = L.checkX * TILE - s.cam + 7;
      if (x < -20 || x > VIEW_W + 20) return;
      const base = 12 * TILE;
      R(x, base - 44, 2, 44, "#cfd3da");
      R(x - 1, base - 46, 4, 3, "#f2c14e");
      const fy = s.checkpoint ? base - 44 : base - 14;
      R(x + 2, fy, 10, 7, s.checkpoint ? "#f2c14e" : "#8a8f98");
      R(x + 2, fy, 10, 1, "rgba(255,255,255,0.5)");
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
      const golds = (i: number, y: number) => {
        // the world's gold coins: filled once found
        const row = s.save.gold[i];
        row.forEach((got, j) => {
          const x = VIEW_W / 2 - (row.length - 1) * 9 + j * 18;
          ctx.fillStyle = got ? "#f2c14e" : "rgba(255,255,255,0.18)";
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
        });
      };
      const secs = (t: number | null) => (t === null ? "--" : `${t.toFixed(1)}s`);
      if (s.phase === "title") {
        text("SUPER", VIEW_W / 2, 58, 14, "#fcd99a");
        text("SHAJITH", VIEW_W / 2, 88, 30, "#ffffff");
        const found = goldCount(s.save);
        if (found) text(`Gold SS coins ${found}/${goldTotal}`, VIEW_W / 2, 112, 8, "#f2c14e");
        if (hasProgress(s.save)) {
          const opts = [`Continue · World ${LEVELS[s.save.level].name}${s.save.checkpoint ? " ½" : ""}`, "New game"];
          opts.forEach((o, i) => text(s.menu === i ? `▶ ${o}` : o, VIEW_W / 2, 146 + i * 18, 10, s.menu === i ? "#fcd99a" : "rgba(255,255,255,0.55)"));
          text("◀ ▶ to choose, jump to start", VIEW_W / 2, 196, 7, "rgba(255,255,255,0.4)");
        } else if (blink) text("Press jump to start", VIEW_W / 2, 160, 10, "#fcd99a");
      } else if (s.phase === "intro") {
        text(`WORLD ${L.name}`, VIEW_W / 2, 70, 10, "#fcd99a");
        text(L.place, VIEW_W / 2, 98, 22);
        golds(s.level, 124);
        text(s.checkpoint ? `× ${s.lives}   ·   from the checkpoint` : `× ${s.lives}`, VIEW_W / 2, 160, 10);
      } else if (s.phase === "clear") {
        text(`WORLD ${L.name} CLEAR`, VIEW_W / 2, 50, 12, "#fcd99a");
        text(`Time ${secs(s.time)}`, VIEW_W / 2, 84, 12, s.record ? "#fcd99a" : "#fff");
        text(s.record ? "New best!" : `Best ${secs(s.save.best[s.level])}`, VIEW_W / 2, 100, 8, s.record ? "#fcd99a" : "rgba(255,255,255,0.6)");
        golds(s.level, 124);
        text(`Score ${String(s.score).padStart(6, "0")}`, VIEW_W / 2, 154, 10);
        if (blink && s.phaseT > 0.5) text(s.level + 1 < LEVELS.length ? "Press jump for the next world" : "Press jump", VIEW_W / 2, 190, 9, "#fcd99a");
      } else if (s.phase === "over") {
        text("GAME OVER", VIEW_W / 2, 100, 20);
        if (blink && s.phaseT > 0.5) text(`Press jump to retry World ${L.name}`, VIEW_W / 2, 150, 9, "#fcd99a");
      } else if (s.phase === "end") {
        text("TO BE CONTINUED…", VIEW_W / 2, 64, 16, "#fcd99a");
        text(`Score ${String(s.score).padStart(6, "0")}`, VIEW_W / 2, 100, 12);
        text(`Gold SS coins ${goldCount(s.save)}/${goldTotal}`, VIEW_W / 2, 124, 9, "#f2c14e");
        if (goldCount(s.save) < goldTotal) text("Some are still hidden out there…", VIEW_W / 2, 140, 8, "rgba(255,255,255,0.55)");
        if (blink && s.phaseT > 0.5) text("Press jump", VIEW_W / 2, 186, 9, "#fcd99a");
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
      drawCheckpoint(s);
      for (const it of s.items) drawBottle(it, s);
      for (const c of s.clouds) {
        const k = c.t / 0.6;
        const x = c.x - s.cam;
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = `rgba(230,200,140,${0.5 * k})`;
          ctx.beginPath();
          ctx.arc(x + Math.sin(time * 9 + i) * 3, c.y + Math.cos(time * 7 + i * 2) * 3, 4 + (1 - k) * 6 - i, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (const e of s.enemies) if (e.alive || e.flip) drawEnemy(e, s, th);
      if (s.phase !== "title") drawPlayer(s);
      for (const f of s.fx) {
        const x = f.x - s.cam;
        if (f.kind === "coin") drawCoin(x, f.y, th, time * 3);
        else if (f.kind === "mist") {
          const k = Math.max(0, f.t / 0.9);
          ctx.fillStyle = f.text === "gold" ? `rgba(255,214,110,${0.7 * k})` : `rgba(${SCENTS[(f.text as Scent) ?? "breeze"].mist},${0.55 * k})`;
          ctx.beginPath();
          ctx.arc(x, f.y, 2 + (1 - k) * 5, 0, Math.PI * 2);
          ctx.fill();
        }
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
        s.save.gold[s.level].forEach((got, j, row) => {
          ctx.fillStyle = got ? "#f2c14e" : "rgba(255,255,255,0.25)";
          ctx.beginPath();
          ctx.arc(VIEW_W - 10 - (row.length - 1 - j) * 9 - 3, 22, 3, 0, Math.PI * 2);
          ctx.fill();
        });
        if (s.player.combo > 1) text(`COMBO ×${s.player.combo}`, VIEW_W / 2, 44, 8, "#fcd99a");
      }
      if (s.phase !== "play" && s.phase !== "dying") card(s);
    };

    const tickFx = (s: State, dt: number) => {
      for (const f of s.fx) {
        f.t -= dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.kind === "mist") {
          f.vx *= 1 - 3 * dt;
          f.vy *= 1 - 3 * dt;
        } else if (f.kind !== "score") f.vy += 900 * dt;
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
        <span className="[@media(pointer:coarse)]:hidden">Move with ← → or A/D, jump with Space, ↑ or W, run with Shift (and spray, once you've got Oud Noir). Progress saves on this device.</span>
        <span className="hidden [@media(pointer:coarse)]:inline">Use the buttons below: move, B to run (and spray), A to jump.</span>
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
