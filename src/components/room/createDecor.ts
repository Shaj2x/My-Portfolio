import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { paintTexture } from "./paintTexture";

/**
 * The small things that make the room his: the fragrance collection on its riser, the plushies and
 * plants on the window sill, and the clutter on the dresser. Each is modelled from the close-up
 * photos (D and the sill crops), procedurally: primitives, lathes and canvas-painted labels.
 * Sizes are in metres; every builder places its object with its base at `at`.
 */

export interface DecorContext {
  /** reflections for glass and polished metal (a small room environment map) */
  env: THREE.Texture | null;
  rand: () => number;
}

export function createDecor({ env, rand }: DecorContext) {
  const between = (a: number, b: number) => a + rand() * (b - a);
  const mats = new Map<string, THREE.Material>();
  const matte = (color: string, roughness = 0.8) => {
    const key = `m|${color}|${roughness}`;
    let m = mats.get(key);
    if (!m) mats.set(key, (m = new THREE.MeshStandardMaterial({ color, roughness })));
    return m;
  };
  const metal = (color: string, roughness = 0.25) => {
    const key = `x|${color}|${roughness}`;
    let m = mats.get(key);
    if (!m) mats.set(key, (m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 1, envMap: env, envMapIntensity: 0.9 })));
    return m;
  };
  /** perfume glass: tinted, glossy, a little see-through */
  const glass = (color: string, opacity = 0.78) => {
    const key = `g|${color}|${opacity}`;
    let m = mats.get(key);
    if (!m) mats.set(key, (m = new THREE.MeshStandardMaterial({ color, roughness: 0.06, metalness: 0.15, transparent: true, opacity, envMap: env, envMapIntensity: 1.1 })));
    return m;
  };
  const printed = (tex: THREE.Texture, roughness = 0.6) => new THREE.MeshStandardMaterial({ map: tex, roughness });

  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], x: number, y: number, z: number, shadows = true) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const rbox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.0005, h / 2 - 0.0005, d / 2 - 0.0005));
  /** a label decal on the front (+z) face of something `d` deep */
  const decal = (parent: THREE.Object3D, tex: THREE.Texture, w: number, h: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5 }));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const label = (w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) => paintTexture(w, h, draw);

  // ---------- fragrances ----------

  type Cap =
    | { kind: "cyl"; r: number; h: number; m: THREE.Material }
    | { kind: "square"; s: number; h: number; m: THREE.Material }
    | { kind: "ball"; r: number; m: THREE.Material }
    | { kind: "ring"; r: number; m: THREE.Material }
    | { kind: "fan"; m: THREE.Material }
    | { kind: "dome"; r: number; m: THREE.Material }
    | { kind: "gem"; r: number; m: THREE.Material }
    | { kind: "ornate"; r: number; m: THREE.Material };

  const putCap = (g: THREE.Group, cap: Cap, y: number) => {
    switch (cap.kind) {
      case "cyl":
        add(g, new THREE.CylinderGeometry(cap.r, cap.r, cap.h, 24), cap.m, 0, y + cap.h / 2, 0);
        break;
      case "square":
        add(g, rbox(cap.s, cap.h, cap.s, 0.003), cap.m, 0, y + cap.h / 2, 0);
        break;
      case "ball":
        add(g, new THREE.CylinderGeometry(cap.r * 0.4, cap.r * 0.4, 0.008, 12), cap.m, 0, y + 0.004, 0);
        add(g, new THREE.SphereGeometry(cap.r, 24, 16), cap.m, 0, y + 0.006 + cap.r, 0);
        break;
      case "ring": {
        const ring = add(g, new THREE.TorusGeometry(cap.r, cap.r * 0.32, 10, 28), cap.m, 0, y + cap.r * 1.1, 0);
        ring.rotation.y = Math.PI / 2;
        add(g, new THREE.CylinderGeometry(cap.r * 0.5, cap.r * 0.5, 0.008, 14), cap.m, 0, y + 0.004, 0);
        break;
      }
      case "fan":
        // the pleated fan stopper: a few thin blades spread like a hand of cards
        for (let i = -2; i <= 2; i++) {
          const blade = add(g, new THREE.BoxGeometry(0.014, 0.045, 0.004), cap.m, i * 0.006, y + 0.024, 0, false);
          blade.rotation.z = i * 0.28;
        }
        add(g, new THREE.CylinderGeometry(0.012, 0.014, 0.012, 16), cap.m, 0, y + 0.006, 0);
        break;
      case "dome":
        add(g, new THREE.SphereGeometry(cap.r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), cap.m, 0, y, 0);
        break;
      case "gem": {
        const gem = add(g, new THREE.OctahedronGeometry(cap.r, 0), cap.m, 0, y + cap.r * 0.9, 0);
        gem.scale.set(1, 0.8, 1);
        break;
      }
      case "ornate":
        // a sculpted metal crown: a stack of rings narrowing to a knob
        add(g, new THREE.CylinderGeometry(cap.r * 0.7, cap.r, 0.012, 20), cap.m, 0, y + 0.006, 0);
        add(g, new THREE.TorusGeometry(cap.r * 0.75, 0.004, 8, 20), cap.m, 0, y + 0.016, 0).rotation.x = Math.PI / 2;
        add(g, new THREE.SphereGeometry(cap.r * 0.6, 18, 12), cap.m, 0, y + 0.026, 0);
        break;
    }
  };

  type BodyShape = "rect" | "round" | "shield" | "gem" | "box";
  interface Bottle {
    x: number;
    shape: BodyShape;
    w: number;
    h: number;
    d: number;
    body: THREE.Material | THREE.Material[];
    cap?: Cap;
    /** a printed label on the front face: texture, size and height of its centre (as a share of h) */
    face?: { tex: THREE.Texture; w: number; h: number; at?: number };
    /** juice inside clear glass */
    juice?: string;
    turn?: number;
  }

  const buildBottle = (parent: THREE.Object3D, b: Bottle, y0: number, z: number) => {
    const g = new THREE.Group();
    g.position.set(b.x, y0, z);
    g.rotation.y = b.turn ?? between(-0.12, 0.12);
    parent.add(g);
    let top = b.h;
    if (b.shape === "rect" || b.shape === "box") {
      add(g, rbox(b.w, b.h, b.d, b.shape === "box" ? 0.002 : 0.006), b.body, 0, b.h / 2, 0);
      if (b.juice) add(g, rbox(b.w * 0.82, b.h * 0.7, b.d * 0.7, 0.004), matte(b.juice, 0.4), 0, b.h * 0.4, 0, false);
    } else if (b.shape === "round") {
      add(g, new THREE.CylinderGeometry(b.w / 2, b.w / 2, b.h, 32), b.body, 0, b.h / 2, 0);
      if (b.juice) add(g, new THREE.CylinderGeometry(b.w * 0.4, b.w * 0.4, b.h * 0.7, 20), matte(b.juice, 0.4), 0, b.h * 0.4, 0, false);
    } else if (b.shape === "shield") {
      // a faceted shield: eight-sided, flattened, narrowing to the shoulders
      const shield = add(g, new THREE.CylinderGeometry(b.w * 0.34, b.w / 2, b.h * 0.8, 8), b.body, 0, b.h * 0.4, 0);
      shield.scale.z = b.d / b.w;
      const shoulder = add(g, new THREE.CylinderGeometry(b.w * 0.12, b.w * 0.34, b.h * 0.2, 8), b.body, 0, b.h * 0.9, 0);
      shoulder.scale.z = b.d / b.w;
    } else {
      // a cut gem standing on its point, as the Marwa bottle does
      const gem = add(g, new THREE.IcosahedronGeometry(b.w / 2, 0), b.body, 0, b.h / 2, 0);
      gem.scale.set(1, b.h / b.w, b.d / b.w);
      top = b.h * 0.92;
    }
    if (b.face) decal(g, b.face.tex, b.face.w, b.face.h, 0, b.h * (b.face.at ?? 0.5), (b.shape === "round" ? b.w / 2 : b.d / 2) + 0.0012);
    if (b.cap) putCap(g, b.cap, top);
    return g;
  };

  // painted labels, read off the photo
  const breezeBox = label(160, 240, (c, w, h) => {
    c.fillStyle = "#f3f1ec";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#1c1c1c";
    c.font = "italic 600 34px Georgia, serif";
    c.textAlign = "center";
    c.fillText("Breeze", w / 2, 52);
    // the line-drawn tree: a trunk and a scribbled crown
    c.strokeStyle = "#2a2a2a";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(w / 2, h - 30);
    c.lineTo(w / 2 - 4, h - 90);
    c.stroke();
    c.lineWidth = 1.5;
    for (let i = 0; i < 90; i++) {
      const a = rand() * Math.PI * 2;
      const r = rand() * 42;
      c.beginPath();
      c.arc(w / 2 + Math.cos(a) * r, 140 + Math.sin(a) * r * 0.8, 4 + rand() * 5, 0, Math.PI * 1.4);
      c.stroke();
    }
  });
  const radioBox = label(160, 240, (c, w, h) => {
    c.fillStyle = "#f4f1ea";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#3a2a20";
    c.font = "italic 600 24px Georgia, serif";
    c.textAlign = "center";
    c.fillText("Vintage Radio", w / 2, 50);
    // the copper radio: a rounded cabinet, a dial and a grille
    c.fillStyle = "#b8653a";
    c.beginPath();
    c.roundRect(28, 92, w - 56, 92, 22);
    c.fill();
    c.fillStyle = "#e9c9a2";
    c.beginPath();
    c.arc(w / 2 + 26, 138, 24, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#7a3c1e";
    c.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.moveTo(42, 110 + i * 10);
      c.lineTo(84, 110 + i * 10);
      c.stroke();
    }
  });
  const sequin = label(128, 160, (c, w, h) => {
    c.fillStyle = "#1a2236";
    c.fillRect(0, 0, w, h);
    // the mirrored mosaic of the bottle's face
    for (let y = 0; y < h; y += 10)
      for (let x = (y / 10) % 2 ? 5 : 0; x < w; x += 10) {
        c.fillStyle = `rgba(${200 + rand() * 55},${200 + rand() * 55},${210 + rand() * 45},${0.25 + rand() * 0.6})`;
        c.beginPath();
        c.moveTo(x + 5, y);
        c.lineTo(x + 10, y + 5);
        c.lineTo(x + 5, y + 10);
        c.lineTo(x, y + 5);
        c.fill();
      }
  });
  const speckle = label(128, 192, (c, w, h) => {
    c.fillStyle = "#c9c6c1";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      c.fillStyle = `rgba(30,30,30,${0.2 + rand() * 0.6})`;
      c.fillRect(rand() * w, rand() * h, 1.5, 1.5);
    }
    // the black flower emblem
    c.fillStyle = "#151515";
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      c.beginPath();
      c.arc(w * 0.62 + Math.cos(a) * 12, h * 0.42 + Math.sin(a) * 12, 7, 0, Math.PI * 2);
      c.fill();
    }
  });
  const vFace = label(128, 192, (c, w, h) => {
    c.fillStyle = "#121212";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "rgba(255,255,255,0.08)";
    for (let y = 6; y < h; y += 9) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    c.strokeStyle = "#8a8a8a";
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(w * 0.3, h * 0.28);
    c.lineTo(w * 0.5, h * 0.72);
    c.lineTo(w * 0.7, h * 0.28);
    c.stroke();
  });
  const navyGold = label(96, 240, (c, w, h) => {
    c.fillStyle = "#1d2c63";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "rgba(220,185,110,0.75)";
    c.lineWidth = 1.5;
    for (let y = -w; y < h; y += 22) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y + w);
      c.moveTo(w, y);
      c.lineTo(0, y + w);
      c.stroke();
    }
  });
  const honor = label(128, 176, (c, w, h) => {
    c.fillStyle = "#f2f0eb";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#a9a49a";
    c.lineWidth = 2;
    c.strokeRect(18, 40, w - 36, h - 70);
    c.beginPath();
    c.moveTo(w / 2, 50);
    c.lineTo(w - 30, h / 2);
    c.lineTo(w / 2, h - 40);
    c.lineTo(30, h / 2);
    c.closePath();
    c.stroke();
  });
  const ninePm = label(128, 256, (c, w, h) => {
    c.fillStyle = "#151517";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) {
      c.fillStyle = `rgba(255,255,255,${rand() * 0.08})`;
      c.fillRect(rand() * w, rand() * h, 2, 2);
    }
    c.fillStyle = "#c9a54d";
    c.font = "700 120px Georgia, serif";
    c.textAlign = "center";
    c.fillText("9", w / 2, 150);
    c.font = "600 28px Georgia, serif";
    c.fillText("pm", w / 2 + 6, 186);
  });
  const youFace = label(128, 160, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = "rgba(255,240,215,0.85)";
    c.font = "300 54px Georgia, serif";
    c.textAlign = "center";
    c.fillText("YOU", w / 2, h / 2 + 18);
  });
  const marwa = label(96, 128, (c, w, h) => {
    c.fillStyle = "#e9dcc4";
    c.beginPath();
    c.roundRect(4, 4, w - 8, h - 8, 10);
    c.fill();
    c.fillStyle = "#4a3a28";
    c.textAlign = "center";
    c.font = "600 22px Georgia, serif";
    c.fillText("مروة", w / 2, 52);
    c.font = "600 16px Georgia, serif";
    c.fillText("MARWA", w / 2, 84);
  });
  const lion = label(128, 160, (c, w, h) => {
    c.fillStyle = "#141414";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#b8924a";
    c.lineWidth = 3;
    c.strokeRect(14, 14, w - 28, h - 28);
    // a lion's mane: a ring of strokes around a face
    for (let k = 0; k < 22; k++) {
      const a = (k / 22) * Math.PI * 2;
      c.beginPath();
      c.moveTo(w / 2 + Math.cos(a) * 16, h / 2 + Math.sin(a) * 16);
      c.lineTo(w / 2 + Math.cos(a) * 34, h / 2 + Math.sin(a) * 34);
      c.stroke();
    }
    c.fillStyle = "#b8924a";
    c.beginPath();
    c.arc(w / 2, h / 2, 13, 0, Math.PI * 2);
    c.fill();
  });
  const espagnol = label(96, 96, (c, w, h) => {
    c.fillStyle = "#f3f1ec";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#2a2a2a";
    c.font = "italic 16px Georgia, serif";
    c.textAlign = "center";
    c.fillText("L'Espagnol", w / 2, h / 2 + 5);
  });
  const etched = label(128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = "rgba(255,255,255,0.55)";
    c.lineWidth = 3;
    for (let y = 10; y < h; y += 16) {
      c.beginPath();
      for (let x = 0; x <= w; x += 8) c.lineTo(x, y + Math.sin(x * 0.12) * 5);
      c.stroke();
    }
  });

  const gold = metal("#c9a24a", 0.28);
  const silver = metal("#c8ccd2", 0.22);
  const blackCap = matte("#121212", 0.35);
  const copper = metal("#b26a3c", 0.3);

  /** rows from the front (0, on the riser's base) to the back (3, the top step), left to right */
  const ROWS: Bottle[][] = [
    [
      { x: -0.15, shape: "rect", w: 0.066, h: 0.085, d: 0.034, body: glass("#e9d7b0", 0.55), juice: "#c88a3a", cap: { kind: "cyl", r: 0.013, h: 0.028, m: blackCap }, face: { tex: youFace, w: 0.05, h: 0.06 } },
      { x: -0.065, shape: "round", w: 0.05, h: 0.085, d: 0.05, body: glass("#f1e2a0", 0.6), juice: "#d9b64a", cap: { kind: "ball", r: 0.02, m: matte("#ece7dc", 0.5) } },
      { x: 0.025, shape: "round", w: 0.054, h: 0.09, d: 0.054, body: matte("#131314", 0.6), cap: { kind: "cyl", r: 0.027, h: 0.034, m: matte("#0e0e0e", 0.4) } },
      { x: 0.105, shape: "gem", w: 0.062, h: 0.1, d: 0.05, body: glass("#d8dce2", 0.7), cap: { kind: "gem", r: 0.016, m: silver }, face: { tex: marwa, w: 0.034, h: 0.044, at: 0.45 } },
      { x: 0.18, shape: "box", w: 0.052, h: 0.072, d: 0.05, body: matte("#141414", 0.5), face: { tex: lion, w: 0.048, h: 0.06 } },
    ],
    [
      { x: -0.14, shape: "rect", w: 0.06, h: 0.085, d: 0.04, body: matte("#f0eee8", 0.35), cap: { kind: "square", s: 0.032, h: 0.026, m: matte("#f0eee8", 0.35) }, face: { tex: honor, w: 0.05, h: 0.068 } },
      { x: -0.055, shape: "round", w: 0.052, h: 0.09, d: 0.052, body: matte("#141414", 0.4), cap: { kind: "ornate", r: 0.022, m: gold } },
      { x: 0.035, shape: "rect", w: 0.056, h: 0.11, d: 0.036, body: matte("#151517", 0.5), cap: { kind: "ball", r: 0.02, m: matte("#2a2a2c", 0.3) }, face: { tex: ninePm, w: 0.05, h: 0.1 } },
      { x: 0.115, shape: "rect", w: 0.055, h: 0.075, d: 0.036, body: glass("#c99a52", 0.7), juice: "#b8742e", cap: { kind: "fan", m: metal("#b8562e", 0.3) } },
      { x: 0.185, shape: "round", w: 0.05, h: 0.1, d: 0.05, body: glass("#5a1018", 0.85), cap: { kind: "cyl", r: 0.016, h: 0.026, m: blackCap } },
    ],
    [
      { x: -0.155, shape: "rect", w: 0.06, h: 0.065, d: 0.05, body: glass("#e8eef2", 0.45), cap: { kind: "square", s: 0.03, h: 0.022, m: glass("#e8eef2", 0.6) }, face: { tex: etched, w: 0.056, h: 0.06 } },
      { x: -0.08, shape: "rect", w: 0.06, h: 0.1, d: 0.036, body: printed(speckle, 0.5), cap: { kind: "ring", r: 0.018, m: blackCap } },
      { x: 0.0, shape: "round", w: 0.058, h: 0.09, d: 0.058, body: printed(vFace, 0.35), cap: { kind: "cyl", r: 0.02, h: 0.03, m: blackCap } },
      { x: 0.07, shape: "rect", w: 0.05, h: 0.09, d: 0.04, body: glass("#2a2c30", 0.9), cap: { kind: "cyl", r: 0.017, h: 0.03, m: blackCap } },
      { x: 0.14, shape: "round", w: 0.046, h: 0.12, d: 0.046, body: printed(navyGold, 0.3), cap: { kind: "cyl", r: 0.02, h: 0.036, m: gold } },
    ],
    [
      { x: -0.16, shape: "box", w: 0.075, h: 0.11, d: 0.045, body: matte("#f3f1ec", 0.7), face: { tex: breezeBox, w: 0.072, h: 0.106 } },
      { x: -0.075, shape: "rect", w: 0.07, h: 0.085, d: 0.034, body: printed(sequin, 0.2), cap: { kind: "square", s: 0.034, h: 0.03, m: silver } },
      { x: 0.0, shape: "rect", w: 0.045, h: 0.07, d: 0.034, body: glass("#e6d2b0", 0.6), juice: "#c49456", cap: { kind: "cyl", r: 0.016, h: 0.032, m: blackCap }, face: { tex: espagnol, w: 0.04, h: 0.03, at: 0.45 } },
      { x: 0.08, shape: "shield", w: 0.07, h: 0.1, d: 0.04, body: glass("#1d2b74", 0.92), cap: { kind: "ornate", r: 0.018, m: silver } },
      { x: 0.165, shape: "box", w: 0.07, h: 0.1, d: 0.045, body: matte("#f4f1ea", 0.7), face: { tex: radioBox, w: 0.068, h: 0.096 } },
    ],
  ];

  /** the black three-step riser and its bottles, standing on a surface at `at` (its centre) */
  /** returns each bottle's group, so a click on any of its meshes can spritz it */
  const perfumeShelf = (parent: THREE.Object3D, at: THREE.Vector3) => {
    const bottles: THREE.Group[] = [];
    const W = 0.44;
    const ROW = 0.055;
    const LIFT = [0.018, 0.075, 0.135, 0.195];
    const riser = matte("#151515", 0.55);
    const zFront = at.z + ROW * 2;
    for (let r = 0; r < 4; r++) {
      const zc = zFront - (r + 0.5) * ROW;
      add(parent, new THREE.BoxGeometry(W, LIFT[r], ROW), riser, at.x, at.y + LIFT[r] / 2, zc);
      for (const b of ROWS[r]) bottles.push(buildBottle(parent, { ...b, x: at.x + b.x }, at.y + LIFT[r], zc));
    }
    // the copper-domed bottle standing behind the Vintage Radio box, and the black cap behind Breeze
    const behind = new THREE.Group();
    behind.position.set(at.x + 0.165, at.y + LIFT[3] + 0.1, zFront - 3.8 * ROW);
    parent.add(behind);
    putCap(behind, { kind: "dome", r: 0.024, m: copper }, 0);
    const behind2 = new THREE.Group();
    behind2.position.set(at.x - 0.16, at.y + LIFT[3] + 0.11, zFront - 3.8 * ROW);
    parent.add(behind2);
    putCap(behind2, { kind: "cyl", r: 0.022, h: 0.02, m: blackCap }, 0);
    return bottles;
  };

  // ---------- window sill: plushies and plants ----------

  /** a small artificial plant: a matte black pot and a dome of bright leaves */
  const plant = (parent: THREE.Object3D, at: THREE.Vector3) => {
    add(parent, new THREE.CylinderGeometry(0.036, 0.03, 0.06, 24), matte("#141414", 0.7), at.x, at.y + 0.03, at.z);
    const LEAVES = 70;
    const leafGeo = new THREE.SphereGeometry(0.011, 8, 6);
    leafGeo.scale(1.5, 0.35, 0.9);
    const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ roughness: 0.55 }), LEAVES);
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    for (let i = 0; i < LEAVES; i++) {
      const a = rand() * Math.PI * 2;
      const up = rand();
      const r = 0.05 * Math.sqrt(1 - up * up) + 0.006;
      o.position.set(at.x + Math.cos(a) * r, at.y + 0.075 + up * 0.06, at.z + Math.sin(a) * r * 0.8);
      o.rotation.set(between(-0.6, 0.6), a, between(-0.5, 0.5));
      o.updateMatrix();
      leaves.setMatrixAt(i, o.matrix);
      leaves.setColorAt(i, col.set(rand() > 0.4 ? "#5e9a3c" : "#7cbc4c").multiplyScalar(between(0.8, 1.1)));
    }
    leaves.castShadow = false;
    // the leaves hang from a pivot at the soil, so the whole plant can sway in a breeze
    const sway = new THREE.Group();
    sway.position.set(at.x, at.y + 0.06, at.z);
    leaves.position.set(-at.x, -at.y - 0.06, -at.z);
    sway.add(leaves);
    parent.add(sway);
    return sway;
  };

  /** Spider-Ham: a red pig in a Spider-Man suit, sitting with his legs out, a loop on his head */
  const spiderHam = (parent: THREE.Object3D, at: THREE.Vector3) => {
    const suit = paintTexture(256, 256, (c, w, h) => {
      c.fillStyle = "#c8151d";
      c.fillRect(0, 0, w, h);
      c.strokeStyle = "rgba(60,0,0,0.55)";
      c.lineWidth = 1.5;
      for (let x = 0; x < w; x += 22) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, h);
        c.stroke();
      }
      for (let y = 0; y < h; y += 18) {
        c.beginPath();
        for (let x = 0; x <= w; x += 22) c.quadraticCurveTo(x - 11, y + 5, x, y);
        c.stroke();
      }
    });
    const red = new THREE.MeshStandardMaterial({ map: suit, roughness: 0.9 });
    const g = new THREE.Group();
    g.position.copy(at);
    g.rotation.y = 0.15;
    parent.add(g);
    add(g, new THREE.SphereGeometry(0.045, 24, 16), red, 0, 0.042, 0).scale.set(1, 0.95, 0.85);
    for (const s of [-1, 1]) {
      const leg = add(g, new THREE.CapsuleGeometry(0.017, 0.035, 6, 12), red, s * 0.025, 0.017, 0.035);
      leg.rotation.x = Math.PI / 2;
      const arm = add(g, new THREE.CapsuleGeometry(0.013, 0.03, 6, 12), red, s * 0.05, 0.05, 0.012);
      arm.rotation.z = s * 0.5;
    }
    const head = add(g, new THREE.SphereGeometry(0.056, 28, 20), red, 0, 0.115, 0.005);
    head.scale.set(1.05, 0.95, 0.9);
    for (const s of [-1, 1]) {
      const ear = add(g, new THREE.SphereGeometry(0.016, 14, 10), red, s * 0.036, 0.165, 0.0);
      ear.scale.set(0.9, 1.3, 0.6);
      ear.rotation.z = -s * 0.4;
      // the mask's big white eyes, outlined in black, tilted toward the snout
      const rim = add(g, new THREE.SphereGeometry(0.018, 16, 10), matte("#111111", 0.6), s * 0.024, 0.128, 0.046, false);
      rim.scale.set(1.05, 0.72, 0.35);
      rim.rotation.z = s * 0.45;
      const eye = add(g, new THREE.SphereGeometry(0.015, 16, 10), matte("#f6f6f4", 0.5), s * 0.024, 0.128, 0.05, false);
      eye.scale.set(1.0, 0.62, 0.3);
      eye.rotation.z = s * 0.45;
    }
    const snout = add(g, new THREE.CylinderGeometry(0.016, 0.018, 0.016, 20), red, 0, 0.096, 0.052);
    snout.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) add(g, new THREE.SphereGeometry(0.0035, 8, 6), matte("#4a0a0d"), s * 0.006, 0.096, 0.061, false);
    const loop = add(g, new THREE.TorusGeometry(0.012, 0.0022, 6, 18), matte("#eeeeea", 0.7), 0, 0.172, -0.004, false);
    loop.rotation.y = Math.PI / 2;
  };

  /** the crying-cat pillow: a flat cat-shaped cushion printed with the meme's teary orange tabby */
  const cryingCat = (parent: THREE.Object3D, at: THREE.Vector3) => {
    const w = 0.1;
    const h = 0.17;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + 0.012, 0);
    shape.lineTo(w / 2 - 0.012, 0);
    shape.quadraticCurveTo(w / 2, 0, w / 2, 0.012);
    shape.lineTo(w / 2, h - 0.04);
    shape.lineTo(w / 2 - 0.004, h); // right ear tip
    shape.lineTo(w / 2 - 0.03, h - 0.026);
    shape.quadraticCurveTo(0, h - 0.016, -w / 2 + 0.03, h - 0.026);
    shape.lineTo(-w / 2 + 0.004, h); // left ear tip
    shape.lineTo(-w / 2, h - 0.04);
    shape.lineTo(-w / 2, 0.012);
    shape.quadraticCurveTo(-w / 2, 0, -w / 2 + 0.012, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 4, curveSegments: 10 });
    const print = paintTexture(256, 436, (c, cw, ch) => {
      // orange tabby head, a pale muzzle and chest, greyer lower body
      const body = c.createLinearGradient(0, 0, 0, ch);
      body.addColorStop(0, "#d9925a");
      body.addColorStop(0.45, "#e6b08a");
      body.addColorStop(0.62, "#efe2d6");
      body.addColorStop(1, "#b9b2ab");
      c.fillStyle = body;
      c.fillRect(0, 0, cw, ch);
      c.strokeStyle = "rgba(150,80,40,0.45)";
      c.lineWidth = 6;
      for (let i = 0; i < 5; i++) {
        c.beginPath();
        c.moveTo(cw * 0.35 + i * 10, 40);
        c.lineTo(cw * 0.38 + i * 10, 95);
        c.stroke();
      }
      // the big glossy dark eyes, welling up
      for (const ex of [cw * 0.33, cw * 0.67]) {
        c.fillStyle = "#1a120e";
        c.beginPath();
        c.ellipse(ex, ch * 0.3, 26, 30, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "rgba(255,255,255,0.85)";
        c.beginPath();
        c.arc(ex - 8, ch * 0.28, 7, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "rgba(190,220,255,0.35)";
        c.beginPath();
        c.ellipse(ex, ch * 0.3 + 26, 22, 6, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = "#f2e8e0";
      c.beginPath();
      c.ellipse(cw / 2, ch * 0.42, 34, 24, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#d98b8b";
      c.beginPath();
      c.moveTo(cw / 2 - 9, ch * 0.385);
      c.lineTo(cw / 2 + 9, ch * 0.385);
      c.lineTo(cw / 2, ch * 0.405);
      c.fill();
    });
    // map the front cap's shape coordinates (metres) onto the print
    print.repeat.set(1 / w, 1 / h);
    print.offset.set(0.5, 0);
    const cat = new THREE.Mesh(geo, [new THREE.MeshStandardMaterial({ map: print, roughness: 0.85 }), matte("#e4c3a8", 0.9)]);
    cat.position.set(at.x, at.y + 0.006, at.z - 0.02);
    cat.rotation.x = -0.06;
    cat.castShadow = cat.receiveShadow = true;
    parent.add(cat);
  };

  /** the Chick-fil-A cow, holding his "EAT MOR CHIKIN" sign */
  const cow = (parent: THREE.Object3D, at: THREE.Vector3) => {
    const hide = paintTexture(128, 128, (c, w, h) => {
      c.fillStyle = "#f3f2ee";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#151515";
      for (const [x, y, r] of [[30, 40, 16], [90, 80, 20], [70, 20, 10], [20, 100, 12]]) {
        c.beginPath();
        c.ellipse(x, y, r, r * 0.75, rand(), 0, Math.PI * 2);
        c.fill();
      }
    });
    const white = new THREE.MeshStandardMaterial({ map: hide, roughness: 0.95 });
    const g = new THREE.Group();
    g.position.copy(at);
    g.rotation.y = 0.15;
    g.scale.setScalar(1.35);
    parent.add(g);
    add(g, rbox(0.075, 0.05, 0.05, 0.02), white, 0.01, 0.026, 0);
    const head = add(g, new THREE.SphereGeometry(0.026, 18, 12), white, -0.04, 0.058, 0.005);
    head.scale.set(1, 1.1, 0.95);
    add(g, new THREE.SphereGeometry(0.012, 12, 8), matte("#e9c7c0", 0.8), -0.052, 0.046, 0.022).scale.set(1.2, 0.8, 0.8);
    for (const s of [-1, 1]) add(g, new THREE.SphereGeometry(0.008, 10, 8), matte("#111111"), -0.04 + s * 0.012, 0.085, 0.0).scale.set(1, 0.6, 1);
    const sign = paintTexture(160, 96, (c, w, h) => {
      c.fillStyle = "#f7f5ef";
      c.fillRect(0, 0, w, h);
      c.strokeStyle = "#cfcac0";
      c.strokeRect(2, 2, w - 4, h - 4);
      c.fillStyle = "#1a1a1a";
      c.font = "700 26px 'Comic Sans MS', 'Chalkboard SE', sans-serif";
      c.textAlign = "center";
      c.fillText("EAT MOR", w / 2, 40);
      c.fillText("CHIKIN", w / 2, 74);
    });
    const board = add(g, new THREE.BoxGeometry(0.07, 0.042, 0.003), [matte("#f7f5ef"), matte("#f7f5ef"), matte("#f7f5ef"), matte("#f7f5ef"), new THREE.MeshStandardMaterial({ map: sign, roughness: 0.8 }), matte("#f7f5ef")], 0.012, 0.032, 0.03);
    board.rotation.x = -0.15;
  };

  /**
   * Babs, the blue-jay squish: an egg-shaped plush, bright blue on top, a white face mask with
   * thin round glasses over happy closed eyes, pink cheeks, a grey felt beak above an open smile,
   * a scalloped navy collar, a white belly, felt wings and a three-point crest, and her tag.
   * The print is painted onto a sphere's wrap-around texture, whose front (+z) is at u = 0.25.
   */
  const bird = (parent: THREE.Object3D, at: THREE.Vector3) => {
    const skin = paintTexture(1024, 512, (c, w, h) => {
      const cx = w * 0.25;
      const base = c.createLinearGradient(0, 0, 0, h);
      base.addColorStop(0, "#2a6de8");
      base.addColorStop(0.6, "#3b82f0");
      base.addColorStop(1, "#4a8ff2");
      c.fillStyle = base;
      c.fillRect(0, 0, w, h);
      // darker navy shading down the sides of the face, as on the print
      c.fillStyle = "#23408f";
      for (const sx of [-1, 1]) {
        c.beginPath();
        c.ellipse(cx + sx * w * 0.115, h * 0.5, w * 0.045, h * 0.1, 0, 0, Math.PI * 2);
        c.fill();
      }
      // white face mask: two soft lobes meeting at the beak
      c.fillStyle = "#f6f7f9";
      for (const sx of [-1, 1]) {
        c.beginPath();
        c.ellipse(cx + sx * w * 0.055, h * 0.43, w * 0.072, h * 0.115, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.fillRect(cx - w * 0.05, h * 0.38, w * 0.1, h * 0.16);
      // white belly
      c.beginPath();
      c.ellipse(cx, h * 0.75, w * 0.085, h * 0.16, 0, 0, Math.PI * 2);
      c.fill();
      // the scalloped navy collar, dipping in the middle
      c.strokeStyle = "#1c2f6e";
      c.lineWidth = h * 0.028;
      c.lineCap = "round";
      c.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const x = cx + (t - 0.5) * w * 0.3;
        const dip = Math.cos((t - 0.5) * Math.PI) * h * 0.07;
        const y = h * 0.53 + dip + Math.sin(t * Math.PI * 14) * h * 0.006;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
      // round glasses with a bridge, over happy closed eyes
      const ey = h * 0.41;
      const ex = w * 0.047;
      c.strokeStyle = "#22356e";
      c.lineWidth = 3;
      for (const sx of [-1, 1]) {
        c.beginPath();
        c.ellipse(cx + sx * ex, ey, w * 0.03, h * 0.058, 0, 0, Math.PI * 2);
        c.stroke();
      }
      c.beginPath();
      c.moveTo(cx - ex + w * 0.03, ey);
      c.lineTo(cx + ex - w * 0.03, ey);
      c.moveTo(cx - ex - w * 0.03, ey);
      c.lineTo(cx - w * 0.115, ey - h * 0.01);
      c.moveTo(cx + ex + w * 0.03, ey);
      c.lineTo(cx + w * 0.115, ey - h * 0.01);
      c.stroke();
      c.strokeStyle = "#16181f";
      c.lineWidth = 5;
      for (const sx of [-1, 1]) {
        c.beginPath();
        c.ellipse(cx + sx * ex, ey + h * 0.012, w * 0.012, h * 0.018, 0, Math.PI * 1.1, Math.PI * 1.9);
        c.stroke();
      }
      // pink cheeks
      c.fillStyle = "rgba(244,150,160,0.85)";
      for (const sx of [-1, 1]) {
        c.beginPath();
        c.ellipse(cx + sx * w * 0.078, h * 0.47, w * 0.016, h * 0.02, 0, 0, Math.PI * 2);
        c.fill();
      }
      // the open smile with its pink tongue, under the beak
      c.fillStyle = "#1b1416";
      c.beginPath();
      c.moveTo(cx - w * 0.018, h * 0.49);
      c.quadraticCurveTo(cx, h * 0.47, cx + w * 0.018, h * 0.49);
      c.quadraticCurveTo(cx, h * 0.55, cx - w * 0.018, h * 0.49);
      c.fill();
      c.fillStyle = "#f07a8c";
      c.beginPath();
      c.ellipse(cx + w * 0.003, h * 0.515, w * 0.01, h * 0.012, 0, 0, Math.PI * 2);
      c.fill();
      // a soft sheen on the shiny base fabric
      c.fillStyle = "rgba(255,255,255,0.12)";
      c.fillRect(0, h * 0.9, w, h * 0.1);
    });
    const R = 0.036;
    const g = new THREE.Group();
    g.position.copy(at);
    g.rotation.y = -0.15;
    parent.add(g);
    const body = add(g, new THREE.SphereGeometry(R, 40, 28), new THREE.MeshStandardMaterial({ map: skin, roughness: 0.95 }), 0, R * 1.2, 0);
    body.scale.set(1, 1.2, 0.88);
    // the grey felt beak, a flattened button on the face
    const beak = add(g, new THREE.SphereGeometry(0.0075, 16, 10), matte("#a9adb3", 1), 0, R * 1.2 + 0.006, R * 0.86, false);
    beak.scale.set(1, 0.9, 0.55);
    const felt = matte("#3d88f2", 1);
    // felt wings, flat and splayed a little
    for (const sx of [-1, 1]) {
      const wing = add(g, new THREE.CylinderGeometry(0.014, 0.014, 0.002, 18), felt, sx * (R + 0.002), R * 1.05, 0.006);
      wing.scale.set(0.75, 1, 1.2);
      wing.rotation.set(0.2, 0, sx * (Math.PI / 2 - 0.35));
    }
    // the three-point crest
    for (const [dx, h, tilt] of [[-0.004, 0.012, 0.35], [0.0, 0.016, 0], [0.004, 0.011, -0.35]] as const) {
      const prong = add(g, new THREE.ConeGeometry(0.003, h, 6), felt, dx, R * 2.38 + h / 2 - 0.002, -0.004, false);
      prong.scale.z = 0.4;
      prong.rotation.z = tilt;
    }
    // her tag, hanging from the right side
    const tagTex = paintTexture(96, 128, (c, w, h) => {
      c.fillStyle = "#f2f3f5";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#2b3a66";
      c.font = "700 22px system-ui, sans-serif";
      c.textAlign = "center";
      c.fillText("Babs", w / 2, 40);
      c.fillStyle = "#3b82f0";
      c.beginPath();
      c.arc(w / 2, 86, 22, 0, Math.PI * 2);
      c.fill();
    });
    const tag = add(g, new THREE.PlaneGeometry(0.02, 0.026), new THREE.MeshStandardMaterial({ map: tagTex, roughness: 0.8, side: THREE.DoubleSide }), R + 0.008, R * 0.9, 0.012, false);
    tag.rotation.set(0, 0.9, 0.2);
  };

  // ---------- dresser clutter ----------

  /** keys, watch, lanyard, wallet, lighter, chain tray and AirPods, laid out neatly in two squared-up rows
   *  across the front of the dresser: dish, watch, AirPods and lighter behind; wallet, lanyard and keys in front.
   *  Everything is built from soft, well-subdivided shapes (no sharp box edges), since they're seen up close. */
  const clutter = (parent: THREE.Object3D, at: THREE.Vector3) => {
    const y = at.y;
    const back = at.z - 0.035;
    const front = at.z + 0.045;
    // a rounded box with enough segments that its edges read as moulded, not cut
    const soft = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 6, Math.min(r, w / 2 - 0.0002, h / 2 - 0.0002, d / 2 - 0.0002));
    // a little chrome dish with a rolled lip, piled with a chain
    const dish = new THREE.Group();
    dish.position.set(at.x - 0.12, y, back);
    dish.scale.z = 0.7;
    parent.add(dish);
    add(dish, new THREE.CylinderGeometry(0.048, 0.044, 0.01, 64), metal("#cfd3d8", 0.18), 0, 0.005, 0);
    const lip = add(dish, new THREE.TorusGeometry(0.048, 0.003, 12, 64), metal("#d8dbe0", 0.15), 0, 0.01, 0, false);
    lip.rotation.x = Math.PI / 2;
    const link = new THREE.TorusGeometry(0.006, 0.0018, 10, 20);
    const links = new THREE.InstancedMesh(link, metal("#b9bdc3", 0.25), 40);
    const o = new THREE.Object3D();
    for (let i = 0; i < 40; i++) {
      const a = i * 0.55;
      const r = 0.01 + i * 0.0008;
      o.position.set(at.x - 0.12 + Math.cos(a) * r, y + 0.013 + rand() * 0.005, back + Math.sin(a) * r * 0.7);
      o.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      o.updateMatrix();
      links.setMatrixAt(i, o.matrix);
    }
    parent.add(links);
    // Casio-style digital watch: a rounded steel band, a soft case and a black face under a bezel
    const watch = new THREE.Group();
    watch.position.set(at.x + 0.02, y, back);
    parent.add(watch);
    add(watch, soft(0.15, 0.004, 0.018, 0.0019), metal("#c4c8cd", 0.3), 0, 0.002, 0, false);
    add(watch, soft(0.034, 0.011, 0.03, 0.005), metal("#b9bdc2", 0.3), 0, 0.0065, 0, false);
    add(watch, soft(0.025, 0.002, 0.019, 0.0009), matte("#1b2420", 0.3), 0, 0.0122, 0, false);
    // purple lanyard strap with embossed lettering, its edges rolled
    const strapTex = paintTexture(512, 64, (c, w, h) => {
      c.fillStyle = "#6e4c9e";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "rgba(40,20,70,0.35)";
      for (let i = 0; i < 9; i++) c.fillRect(70 + i * 40, 18, 28, 28);
    });
    const strapPlain = matte("#6e4c9e");
    const strap = add(parent, soft(0.26, 0.004, 0.032, 0.0019), [strapPlain, strapPlain, new THREE.MeshStandardMaterial({ map: strapTex, roughness: 0.8 }), strapPlain, strapPlain, strapPlain], at.x + 0.04, y + 0.002, front, false);
    // carabiner with keys and a fob at the strap's end
    const ring = add(parent, new THREE.TorusGeometry(0.018, 0.003, 12, 48), metal("#c9cdd2", 0.25), at.x + 0.2, y + 0.004, front, false);
    ring.rotation.x = Math.PI / 2;
    ring.scale.set(1.5, 1, 1);
    for (let i = 0; i < 3; i++) {
      // each key: a rounded blade and a round bow
      const key = new THREE.Group();
      // hanging off the ring toward the back, fanned just slightly
      key.position.set(at.x + 0.2 + (i - 1) * 0.006, y + 0.002 + i * 0.0026, front - 0.026);
      key.rotation.y = Math.PI / 2 + (i - 1) * 0.16;
      parent.add(key);
      const keyMat = metal(i === 1 ? "#c9a24a" : "#bfc3c8", 0.3);
      add(key, soft(0.026, 0.0026, 0.008, 0.0012), keyMat, 0.006, 0, 0, false);
      add(key, new THREE.CylinderGeometry(0.0075, 0.0075, 0.0026, 28), keyMat, -0.012, 0, 0, false);
    }
    add(parent, soft(0.026, 0.009, 0.026, 0.0044), matte("#121212", 0.45), at.x + 0.16, y + 0.0045, front + 0.03, false);
    // black card wallet with a green card peeking out
    const wallet = new THREE.Group();
    wallet.position.set(at.x - 0.15, y, front);
    parent.add(wallet);
    add(wallet, soft(0.085, 0.012, 0.06, 0.005), matte("#111111", 0.6), 0, 0.006, 0, false);
    add(wallet, soft(0.03, 0.002, 0.054, 0.0009), matte("#00704a", 0.5), 0.045, 0.006, 0, false);
    add(wallet, soft(0.03, 0.0022, 0.02, 0.0009), matte("#f4f4f2", 0.5), 0.045, 0.0062, -0.012, false);
    // teal lighter
    const lighter = add(parent, soft(0.07, 0.014, 0.022, 0.0068), matte("#1f9fc4", 0.3), at.x + 0.22, y + 0.007, back, false);
    lighter.rotation.y = Math.PI / 2;
    // AirPods case: a smooth white pebble
    add(parent, soft(0.05, 0.022, 0.044, 0.0105), matte("#f1f1ef", 0.35), at.x + 0.15, y + 0.011, back, false);
    return { strap, wallet };
  };

  return { perfumeShelf, plant, spiderHam, cryingCat, cow, bird, clutter };
}
