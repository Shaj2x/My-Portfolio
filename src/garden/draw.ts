import type { Piece } from "./engine";

/*
 * Ma's Garden's art, all drawn in code: six fruits with their own shapes (so they're told apart by
 * shape as well as colour), the specials, the acorn, and the garden's weeds, hedges and vines.
 * Every function draws centred on (x, y) for a tile `s` pixels wide.
 */

/** the juice colour of each fruit, for splashes and the like */
export const JUICE = ["#e8344e", "#ff8a1a", "#ffcf2e", "#5cbf3a", "#4a6fe0", "#8a4fd6"];

type Ctx = CanvasRenderingContext2D;

const shade = (ctx: Ctx, x: number, y: number, r: number, stops: [string, string, string]) => {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.15);
  g.addColorStop(0, stops[0]);
  g.addColorStop(0.55, stops[1]);
  g.addColorStop(1, stops[2]);
  return g;
};
const shine = (ctx: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.55) => {
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};
const leaf = (ctx: Ctx, x: number, y: number, len: number, angle: number, color = "#3f9a2c") => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = Math.max(0.6, len * 0.06);
  ctx.beginPath();
  ctx.moveTo(len * 0.1, 0);
  ctx.lineTo(len * 0.85, 0);
  ctx.stroke();
  ctx.restore();
};
const stem = (ctx: Ctx, x: number, y: number, s: number, bend = 0.08) => {
  ctx.strokeStyle = "#7a4a22";
  ctx.lineWidth = s * 0.045;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + s * bend, y - s * 0.08, x + s * bend * 1.2, y - s * 0.14);
  ctx.stroke();
};

// ---------- the six fruits ----------

const strawberry = (ctx: Ctx, x: number, y: number, s: number) => {
  ctx.fillStyle = shade(ctx, x, y, s * 0.4, ["#ff8a8a", "#e8344e", "#a8122c"]);
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.4);
  ctx.bezierCurveTo(x - s * 0.36, y + s * 0.2, x - s * 0.44, y - s * 0.2, x - s * 0.2, y - s * 0.26);
  ctx.quadraticCurveTo(x, y - s * 0.32, x + s * 0.2, y - s * 0.26);
  ctx.bezierCurveTo(x + s * 0.44, y - s * 0.2, x + s * 0.36, y + s * 0.2, x, y + s * 0.4);
  ctx.fill();
  // seeds
  ctx.fillStyle = "#ffe79a";
  const seeds = [
    [-0.18, -0.1], [0, -0.13], [0.18, -0.1], [-0.12, 0.04], [0.12, 0.04], [-0.22, 0.04], [0.22, 0.04], [0, 0.06], [-0.07, 0.19], [0.07, 0.19], [0, 0.3],
  ];
  for (const [dx, dy] of seeds) {
    ctx.beginPath();
    ctx.ellipse(x + dx * s, y + dy * s, s * 0.018, s * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  shine(ctx, x - s * 0.15, y - s * 0.12, s * 0.07, s * 0.04, 0.5);
  // leafy cap
  for (let i = 0; i < 5; i++) leaf(ctx, x, y - s * 0.25, s * 0.19, -Math.PI / 2 + (i - 2) * 0.62, "#3f9a2c");
  ctx.fillStyle = "#2f7d22";
  ctx.beginPath();
  ctx.arc(x, y - s * 0.26, s * 0.045, 0, Math.PI * 2);
  ctx.fill();
};

const orange = (ctx: Ctx, x: number, y: number, s: number) => {
  const r = s * 0.37;
  ctx.fillStyle = shade(ctx, x, y + s * 0.02, r, ["#ffc76b", "#ff8a1a", "#d85f00"]);
  ctx.beginPath();
  ctx.arc(x, y + s * 0.03, r, 0, Math.PI * 2);
  ctx.fill();
  // the peel's little dimples
  ctx.fillStyle = "rgba(170,70,0,0.18)";
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4;
    const d = r * (0.3 + ((i * 37) % 10) / 16);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + s * 0.03 + Math.sin(a) * d, s * 0.014, 0, Math.PI * 2);
    ctx.fill();
  }
  shine(ctx, x - s * 0.13, y - s * 0.12, s * 0.09, s * 0.05, 0.55);
  stem(ctx, x, y - s * 0.32, s, 0.02);
  leaf(ctx, x + s * 0.01, y - s * 0.35, s * 0.2, -0.35);
};

const lemon = (ctx: Ctx, x: number, y: number, s: number) => {
  ctx.save();
  ctx.translate(x, y + s * 0.02);
  ctx.rotate(-0.35);
  ctx.fillStyle = shade(ctx, 0, 0, s * 0.4, ["#fff7a8", "#ffd92e", "#d9a400"]);
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.38, s * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  // the pointed ends
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * s * 0.37, 0, s * 0.07, s * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  shine(ctx, -s * 0.12, -s * 0.1, s * 0.12, s * 0.05, 0.6);
  ctx.restore();
  leaf(ctx, x + s * 0.12, y - s * 0.2, s * 0.17, -0.9);
};

const apple = (ctx: Ctx, x: number, y: number, s: number) => {
  ctx.fillStyle = shade(ctx, x, y, s * 0.4, ["#c9f58c", "#6cc93c", "#3a8a1f"]);
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.23);
  ctx.bezierCurveTo(x - s * 0.15, y - s * 0.35, x - s * 0.44, y - s * 0.3, x - s * 0.4, y + s * 0.03);
  ctx.bezierCurveTo(x - s * 0.36, y + s * 0.34, x - s * 0.14, y + s * 0.42, x, y + s * 0.36);
  ctx.bezierCurveTo(x + s * 0.14, y + s * 0.42, x + s * 0.36, y + s * 0.34, x + s * 0.4, y + s * 0.03);
  ctx.bezierCurveTo(x + s * 0.44, y - s * 0.3, x + s * 0.15, y - s * 0.35, x, y - s * 0.23);
  ctx.fill();
  shine(ctx, x - s * 0.17, y - s * 0.08, s * 0.08, s * 0.05, 0.55);
  stem(ctx, x, y - s * 0.22, s, 0.05);
  leaf(ctx, x + s * 0.04, y - s * 0.3, s * 0.2, -0.45, "#4fae34");
};

const blueberry = (ctx: Ctx, x: number, y: number, s: number) => {
  const r = s * 0.35;
  ctx.fillStyle = shade(ctx, x, y + s * 0.02, r, ["#9fbcff", "#4a6fe0", "#26388f"]);
  ctx.beginPath();
  ctx.arc(x, y + s * 0.03, r, 0, Math.PI * 2);
  ctx.fill();
  // the dusty bloom on its skin
  ctx.fillStyle = "rgba(220,230,255,0.18)";
  ctx.beginPath();
  ctx.arc(x + s * 0.06, y + s * 0.1, r * 0.75, 0, Math.PI * 2);
  ctx.fill();
  // its little crown
  ctx.fillStyle = "#1c2a6b";
  ctx.beginPath();
  const cy = y - s * 0.2;
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? s * 0.035 : s * 0.09;
    ctx.lineTo(x + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.75);
  }
  ctx.closePath();
  ctx.fill();
  shine(ctx, x - s * 0.13, y - s * 0.06, s * 0.08, s * 0.045, 0.5);
};

const grapes = (ctx: Ctx, x: number, y: number, s: number) => {
  stem(ctx, x, y - s * 0.24, s, 0.04);
  leaf(ctx, x + s * 0.03, y - s * 0.28, s * 0.19, -0.3, "#4fae34");
  const balls = [
    [-0.19, -0.13], [0, -0.15], [0.19, -0.13], [-0.1, 0.05], [0.1, 0.05], [-0.25, 0.04], [0.25, 0.04], [0, 0.23],
  ];
  for (const [dx, dy] of balls) {
    const bx = x + dx * s;
    const by = y + dy * s;
    ctx.fillStyle = shade(ctx, bx, by, s * 0.13, ["#d9b6ff", "#8a4fd6", "#4f2290"]);
    ctx.beginPath();
    ctx.arc(bx, by, s * 0.125, 0, Math.PI * 2);
    ctx.fill();
    shine(ctx, bx - s * 0.04, by - s * 0.04, s * 0.03, s * 0.02, 0.6);
  }
};

const FRUIT = [strawberry, orange, lemon, apple, blueberry, grapes];

export const drawFruit = (ctx: Ctx, color: number, x: number, y: number, s: number) => FRUIT[color]?.(ctx, x, y, s);

// ---------- specials ----------

const blossom = (ctx: Ctx, x: number, y: number, s: number, t: number) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.8);
  // a soft rainbow glow behind
  const glow = ctx.createRadialGradient(0, 0, s * 0.05, 0, 0, s * 0.5);
  glow.addColorStop(0, "rgba(255,255,220,0.9)");
  glow.addColorStop(1, "rgba(255,255,220,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 3);
    const g = ctx.createLinearGradient(0, 0, 0, -s * 0.4);
    g.addColorStop(0, "#fff");
    g.addColorStop(1, JUICE[i]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.2, s * 0.12, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = shade(ctx, 0, 0, s * 0.13, ["#fff6c2", "#ffcf3a", "#d99a00"]);
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // a twinkle
  const tw = (Math.sin(t * 5) + 1) / 2;
  ctx.fillStyle = `rgba(255,255,255,${0.4 + tw * 0.6})`;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const rr = i % 2 ? s * 0.025 : s * 0.08;
    ctx.lineTo(x + s * 0.24 + Math.cos(a) * rr, y - s * 0.26 + Math.sin(a) * rr);
  }
  ctx.fill();
};

const acorn = (ctx: Ctx, x: number, y: number, s: number) => {
  ctx.fillStyle = shade(ctx, x, y + s * 0.06, s * 0.3, ["#e8b47a", "#b5733a", "#7a4520"]);
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.08, s * 0.24, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - s * 0.06, y + s * 0.36);
  ctx.lineTo(x, y + s * 0.42);
  ctx.lineTo(x + s * 0.06, y + s * 0.36);
  ctx.fill();
  // the cap
  ctx.fillStyle = "#6b4426";
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.12, s * 0.3, s * 0.15, 0, Math.PI, Math.PI * 2);
  ctx.ellipse(x, y - s * 0.12, s * 0.3, s * 0.06, 0, 0, Math.PI);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,220,170,0.35)";
  ctx.lineWidth = s * 0.02;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * s * 0.1 - s * 0.04, y - s * 0.2);
    ctx.lineTo(x + i * s * 0.1 + s * 0.04, y - s * 0.08);
    ctx.stroke();
  }
  stem(ctx, x, y - s * 0.25, s, 0.03);
  shine(ctx, x - s * 0.09, y + s * 0.02, s * 0.05, s * 0.09, 0.35);
};

/** stripes across the fruit: they show which way it'll clear */
const stripes = (ctx: Ctx, x: number, y: number, s: number, horizontal: boolean, color: number) => {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y + s * 0.02, s * 0.4, 0, Math.PI * 2);
  ctx.clip();
  for (const off of [-0.17, 0, 0.17]) {
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    if (horizontal) ctx.fillRect(x - s * 0.5, y + off * s - s * 0.035, s, s * 0.07);
    else ctx.fillRect(x + off * s - s * 0.035, y - s * 0.5, s * 0.07, s);
    ctx.fillStyle = JUICE[color] + "aa";
    if (horizontal) ctx.fillRect(x - s * 0.5, y + off * s + s * 0.035, s, s * 0.018);
    else ctx.fillRect(x + off * s + s * 0.035, y - s * 0.5, s * 0.018, s);
  }
  ctx.restore();
};

/** a wreath of leaves and little white flowers around a wrapped fruit */
const wreath = (ctx: Ctx, x: number, y: number, s: number, t: number, armed: boolean) => {
  const pulse = armed ? 1 + Math.sin(t * 14) * 0.06 : 1;
  const r = s * 0.42 * pulse;
  if (armed) {
    const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 1.3);
    g.addColorStop(0, "rgba(255,240,180,0)");
    g.addColorStop(1, "rgba(255,240,180,0.6)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6 + t * 0.4;
    leaf(ctx, x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82, s * 0.15, a + Math.PI / 2, i % 2 ? "#4fae34" : "#3f9a2c");
  }
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + t * 0.4 + 0.26;
    const fx = x + Math.cos(a) * r * 0.9;
    const fy = y + Math.sin(a) * r * 0.9;
    ctx.fillStyle = "#fff";
    for (let p = 0; p < 5; p++) {
      const pa = (p * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(pa) * s * 0.03, fy + Math.sin(pa) * s * 0.03, s * 0.026, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ffcf3a";
    ctx.beginPath();
    ctx.arc(fx, fy, s * 0.02, 0, Math.PI * 2);
    ctx.fill();
  }
};

/** a piece: any fruit, special, or acorn */
export const drawPiece = (ctx: Ctx, p: Piece, x: number, y: number, s: number, t: number) => {
  if (p.kind === "blossom") return blossom(ctx, x, y, s, t);
  if (p.kind === "acorn") return acorn(ctx, x, y, s);
  if (p.kind === "wrapped") {
    wreath(ctx, x, y, s, t, !!p.armed);
    return drawFruit(ctx, p.color, x, y, s * 0.82);
  }
  drawFruit(ctx, p.color, x, y, s);
  if (p.kind === "stripedH" || p.kind === "stripedV") stripes(ctx, x, y, s, p.kind === "stripedH", p.color);
};

// ---------- the garden bed ----------

export const roundRect = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

/** weeds growing in a cell, under the fruit: one or two layers */
export const drawWeed = (ctx: Ctx, x: number, y: number, s: number, layers: number) => {
  ctx.fillStyle = layers > 1 ? "#4caf50" : "#8bd37b";
  roundRect(ctx, x - s * 0.47, y - s * 0.47, s * 0.94, s * 0.94, s * 0.16);
  ctx.fill();
  // little clover leaves
  ctx.fillStyle = layers > 1 ? "#2e7d32" : "#5fb552";
  const spots = [
    [-0.3, -0.3], [0.28, -0.26], [-0.26, 0.3], [0.3, 0.28], [0, -0.36], [-0.36, 0.02], [0.36, 0], [0, 0.36],
  ];
  for (const [dx, dy] of spots) {
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(x + dx * s + Math.cos(a) * s * 0.035, y + dy * s + Math.sin(a) * s * 0.035, s * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

/** a hedge filling a cell: a round bush, with flowers on a two-layer one */
export const drawHedge = (ctx: Ctx, x: number, y: number, s: number, layers: number) => {
  const blobs = [
    [-0.2, 0.12, 0.24], [0.2, 0.12, 0.24], [0, -0.1, 0.27], [-0.22, -0.12, 0.18], [0.22, -0.12, 0.18], [0, 0.2, 0.22],
  ];
  for (const [dx, dy, r] of blobs) {
    ctx.fillStyle = shade(ctx, x + dx * s, y + dy * s, r * s, layers > 1 ? ["#6fbf5a", "#2f7d32", "#1b5e20"] : ["#9ad67f", "#56a845", "#357a2a"]);
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
  if (layers > 1)
    for (const [dx, dy] of [
      [-0.18, -0.08], [0.16, -0.16], [0.06, 0.16], [-0.1, 0.22],
    ]) {
      ctx.fillStyle = "#ff8fb3";
      for (let p = 0; p < 5; p++) {
        const pa = (p * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.arc(x + dx * s + Math.cos(pa) * s * 0.035, y + dy * s + Math.sin(pa) * s * 0.035, s * 0.03, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#fff3b0";
      ctx.beginPath();
      ctx.arc(x + dx * s, y + dy * s, s * 0.022, 0, Math.PI * 2);
      ctx.fill();
    }
};

/** a vine wound round a fruit */
export const drawVine = (ctx: Ctx, x: number, y: number, s: number) => {
  ctx.strokeStyle = "#2e6b1f";
  ctx.lineWidth = s * 0.06;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - s * 0.44, y - s * 0.3);
  ctx.bezierCurveTo(x - s * 0.1, y - s * 0.5, x + s * 0.1, y + s * 0.5, x + s * 0.44, y + s * 0.3);
  ctx.moveTo(x + s * 0.44, y - s * 0.3);
  ctx.bezierCurveTo(x + s * 0.1, y - s * 0.5, x - s * 0.1, y + s * 0.5, x - s * 0.44, y + s * 0.3);
  ctx.stroke();
  ctx.strokeStyle = "#5fae3c";
  ctx.lineWidth = s * 0.025;
  ctx.stroke();
  for (const [dx, dy, a] of [
    [-0.3, -0.36, -0.6], [0.3, 0.36, 2.4], [0.32, -0.34, -2.4], [-0.32, 0.34, 0.6],
  ])
    leaf(ctx, x + dx * s, y + dy * s, s * 0.16, a, "#3f9a2c");
};

/** the basket under a column where acorns leave the board */
export const drawBasket = (ctx: Ctx, x: number, y: number, s: number) => {
  ctx.fillStyle = "#c98a4a";
  ctx.beginPath();
  ctx.moveTo(x - s * 0.22, y);
  ctx.lineTo(x + s * 0.22, y);
  ctx.lineTo(x + s * 0.16, y + s * 0.2);
  ctx.lineTo(x - s * 0.16, y + s * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#8a5a2a";
  ctx.lineWidth = s * 0.02;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.22 + i * s * 0.11, y);
    ctx.lineTo(x - s * 0.16 + i * s * 0.08, y + s * 0.2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, s * 0.18, Math.PI, Math.PI * 2);
  ctx.stroke();
};
