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
    // clear glass has almost no colour of its own: what shows is the juice behind it and thin
    // reflections, so the tint is kept dark and the reflections soft
    if (!m) mats.set(key, (m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color).multiplyScalar(0.3), roughness: 0.03, metalness: 0.05, transparent: true, opacity, clearcoat: 0.6, clearcoatRoughness: 0.04, envMap: env, envMapIntensity: 0.55 })));
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
  // The collection on the dresser, bottle by bottle, from the photos of the shelf: twenty bottles on
  // a black four-step riser, five to a step. Each has its own body, cap, finish and label.

  /** polished, clear-coated finishes for the bottles that are metal or lacquer */
  const lacquer = (color: string, roughness = 0.2, metalness = 1) => {
    const key = `l|${color}|${roughness}|${metalness}`;
    let m = mats.get(key);
    if (!m) mats.set(key, (m = new THREE.MeshPhysicalMaterial({ color, roughness, metalness, clearcoat: 1, clearcoatRoughness: 0.08, envMap: env, envMapIntensity: 1.1 })));
    return m;
  };
  /** cut glass: the same as glass, but each face catches the light on its own */
  const cutGlass = (color: string, opacity = 0.85) => {
    const key = `c|${color}|${opacity}`;
    let m = mats.get(key);
    if (!m)
      mats.set(
        key,
        (m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.04, metalness: 0.1, transparent: true, opacity, clearcoat: 0.7, clearcoatRoughness: 0.04, flatShading: true, envMap: env, envMapIntensity: 0.6 })),
      );
    return m;
  };
  /** the liquid inside clear glass: glossy and deep. Solid, so it's drawn before the glass around
   *  it (a see-through liquid inside see-through glass is hidden by it) */
  const juiceMat = (color: string) => {
    const key = `j|${color}`;
    let m = mats.get(key);
    if (!m) mats.set(key, (m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, envMap: env, envMapIntensity: 0.8 })));
    return m;
  };
  const cutMetal = (color: string, roughness = 0.18) => {
    const key = `f|${color}|${roughness}`;
    let m = mats.get(key);
    if (!m) mats.set(key, (m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 1, flatShading: true, envMap: env, envMapIntensity: 1.2 })));
    return m;
  };

  type Cap =
    | { kind: "cyl"; r: number; h: number; m: THREE.Material; ribs?: number }
    | { kind: "square"; s: number; h: number; m: THREE.Material; top?: THREE.Material }
    | { kind: "ball"; r: number; m: THREE.Material; neck?: THREE.Material }
    | { kind: "ring"; r: number; m: THREE.Material }
    | { kind: "fan"; m: THREE.Material }
    | { kind: "halfMoon"; r: number; t: number; m: THREE.Material }
    | { kind: "crystal"; w: number; h: number; d: number }
    | { kind: "faceted"; r: number; h: number; m: THREE.Material }
    | { kind: "monogram"; r: number; m: THREE.Material }
    | { kind: "sculpted"; r: number; m: THREE.Material }
    | { kind: "gem"; r: number; m: THREE.Material };

  const putCap = (g: THREE.Group, cap: Cap, y: number) => {
    switch (cap.kind) {
      case "cyl":
        add(g, new THREE.CylinderGeometry(cap.r, cap.r, cap.h, 28), cap.m, 0, y + cap.h / 2, 0);
        // a knurled or ringed collar, as on Mancera's and Legacy's caps
        for (let i = 0; i < (cap.ribs ?? 0); i++)
          add(g, new THREE.TorusGeometry(cap.r + 0.0006, 0.0009, 6, 28), cap.m, 0, y + cap.h * ((i + 1) / ((cap.ribs ?? 0) + 1)), 0, false).rotation.x = Math.PI / 2;
        break;
      case "square":
        add(g, rbox(cap.s, cap.h, cap.s, 0.003), cap.m, 0, y + cap.h / 2, 0);
        if (cap.top) add(g, rbox(cap.s * 0.86, 0.003, cap.s * 0.86, 0.001), cap.top, 0, y + cap.h + 0.0012, 0, false);
        break;
      case "ball":
        add(g, new THREE.CylinderGeometry(cap.r * 0.45, cap.r * 0.5, 0.009, 16), cap.neck ?? cap.m, 0, y + 0.0045, 0);
        add(g, new THREE.SphereGeometry(cap.r, 28, 20), cap.m, 0, y + 0.008 + cap.r, 0);
        break;
      case "ring": {
        const ring = add(g, new THREE.TorusGeometry(cap.r, cap.r * 0.3, 12, 32), cap.m, 0, y + 0.01 + cap.r * 1.05, 0);
        ring.rotation.y = Math.PI / 2;
        add(g, new THREE.CylinderGeometry(cap.r * 0.45, cap.r * 0.45, 0.012, 16), cap.m, 0, y + 0.006, 0);
        break;
      }
      case "fan":
        // Bujairami's sail: pleated copper blades fanned out above a jewelled crown ring
        add(g, new THREE.CylinderGeometry(0.013, 0.015, 0.012, 20), cap.m, 0, y + 0.006, 0);
        add(g, new THREE.TorusGeometry(0.0135, 0.0018, 6, 20), cap.m, 0, y + 0.012, 0).rotation.x = Math.PI / 2;
        for (let i = -2; i <= 2; i++) {
          const blade = add(g, new THREE.ConeGeometry(0.008, 0.042, 3), cap.m, i * 0.0045, y + 0.034, 0, false);
          blade.rotation.z = -i * 0.32;
          blade.scale.z = 0.35;
        }
        break;
      case "halfMoon": {
        // Lattafa Pride's cap: an upright half-disc, flat side down, facing the front
        const shape = new THREE.Shape();
        shape.absarc(0, 0, cap.r, 0, Math.PI, false);
        shape.lineTo(cap.r, 0);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: cap.t, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 2, curveSegments: 32 });
        geo.translate(0, 0, -cap.t / 2);
        add(g, geo, cap.m, 0, y + 0.004, 0);
        add(g, new THREE.BoxGeometry(cap.r * 1.2, 0.004, cap.t * 1.15), cap.m, 0, y + 0.002, 0);
        break;
      }
      case "crystal":
        // Khamrah's cap: a big block of cut crystal, diagonal grooves on its faces
        add(g, rbox(cap.w, cap.h, cap.d, 0.003), cutGlass("#eef3f6", 0.5), 0, y + cap.h / 2, 0);
        decal(g, etched, cap.w * 0.92, cap.h * 0.9, 0, y + cap.h / 2, cap.d / 2 + 0.0008);
        break;
      case "faceted":
        add(g, new THREE.CylinderGeometry(cap.r * 0.85, cap.r, cap.h, 8), cap.m, 0, y + cap.h / 2, 0);
        break;
      case "monogram":
        // Momento's cap: a gold drum, fluted at the base, with an open "R" medallion standing on top
        add(g, new THREE.CylinderGeometry(cap.r, cap.r * 1.05, 0.014, 32), cap.m, 0, y + 0.007, 0);
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2;
          add(g, new THREE.BoxGeometry(0.0016, 0.012, 0.0016), cap.m, Math.cos(a) * cap.r * 1.03, y + 0.007, Math.sin(a) * cap.r * 1.03, false);
        }
        add(g, new THREE.TorusGeometry(cap.r * 0.72, 0.0022, 8, 28), cap.m, 0, y + 0.014 + cap.r * 0.72, 0);
        add(g, new THREE.BoxGeometry(0.003, cap.r * 0.9, 0.003), cap.m, -0.003, y + 0.014 + cap.r * 0.72, 0, false);
        break;
      case "sculpted":
        // a chunky black cap, cast with knuckled ridges
        add(g, new THREE.CylinderGeometry(cap.r, cap.r * 1.05, 0.016, 20), cap.m, 0, y + 0.008, 0);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          add(g, new THREE.SphereGeometry(cap.r * 0.42, 12, 10), cap.m, Math.cos(a) * cap.r * 0.62, y + 0.02, Math.sin(a) * cap.r * 0.62, false);
        }
        add(g, new THREE.SphereGeometry(cap.r * 0.6, 16, 12), cap.m, 0, y + 0.026, 0);
        break;
      case "gem": {
        // Marwa's cap: a cut diamond, table up
        const gem = add(g, new THREE.CylinderGeometry(cap.r * 0.7, cap.r, cap.r * 1.3, 8), cap.m, 0, y + cap.r * 0.65, 0);
        gem.rotation.y = Math.PI / 8;
        break;
      }
    }
  };

  type BodyShape = "rect" | "round" | "box" | "gem" | "trophy" | "faceted";
  interface Bottle {
    /** what it is, for the record */
    name: string;
    x: number;
    shape: BodyShape;
    w: number;
    h: number;
    d: number;
    body: THREE.Material | THREE.Material[];
    cap?: Cap;
    /** a printed label on the front face: texture, size and height of its centre (as a share of h) */
    face?: { tex: THREE.Texture; w: number; h: number; at?: number };
    /** juice inside clear glass, and how full (share of the height) */
    juice?: string;
    fill?: number;
    /** anything else the bottle has (Taif's tentacles, Momento's gold foot) */
    extra?: (g: THREE.Group) => void;
    turn?: number;
  }

  const buildBottle = (parent: THREE.Object3D, b: Bottle, y0: number, z: number) => {
    const g = new THREE.Group();
    g.name = b.name;
    g.position.set(b.x, y0, z);
    g.rotation.y = b.turn ?? between(-0.08, 0.08);
    parent.add(g);
    let top = b.h;
    const fill = b.fill ?? 0.7;
    if (b.shape === "rect" || b.shape === "box") {
      add(g, rbox(b.w, b.h, b.d, b.shape === "box" ? 0.0025 : 0.007), b.body, 0, b.h / 2, 0);
      if (b.juice) add(g, rbox(b.w * 0.84, b.h * fill, b.d * 0.72, 0.004), juiceMat(b.juice), 0, 0.004 + (b.h * fill) / 2, 0, false);
    } else if (b.shape === "round") {
      add(g, new THREE.CylinderGeometry(b.w / 2, b.w / 2, b.h, 40), b.body, 0, b.h / 2, 0);
      if (b.juice) add(g, new THREE.CylinderGeometry(b.w * 0.42, b.w * 0.42, b.h * fill, 24), juiceMat(b.juice), 0, 0.004 + (b.h * fill) / 2, 0, false);
    } else if (b.shape === "faceted") {
      // an eight-sided cut-glass column, a little narrower at the shoulder
      add(g, new THREE.CylinderGeometry(b.w * 0.44, b.w / 2, b.h, 8), b.body, 0, b.h / 2, 0).rotation.y = Math.PI / 8;
      if (b.juice) add(g, new THREE.CylinderGeometry(b.w * 0.36, b.w * 0.4, b.h * fill, 8), juiceMat(b.juice), 0, 0.004 + (b.h * fill) / 2, 0, false);
    } else if (b.shape === "trophy") {
      // Invictus: a black cup on a stemmed foot, with two handles
      const p = [
        [0.4, 0], [0.48, 0.03], [0.3, 0.1], [0.2, 0.18], [0.3, 0.26], [0.48, 0.42], [0.52, 0.66], [0.46, 0.84], [0.3, 0.95], [0.18, 1],
      ].map(([r, y]) => new THREE.Vector2(r * b.w, y * b.h));
      add(g, new THREE.LatheGeometry(p, 40), b.body, 0, 0, 0);
      for (const s of [-1, 1]) {
        const handle = add(g, new THREE.TorusGeometry(b.h * 0.16, 0.0032, 8, 24, Math.PI), b.body, s * b.w * 0.5, b.h * 0.62, 0);
        handle.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
    } else {
      // Marwa: a faceted silver body, widest at the shoulder, standing on a narrow foot
      const p = [[0.3, 0], [0.42, 0.12], [0.5, 0.55], [0.46, 0.8], [0.3, 0.95], [0.18, 1]].map(([r, y]) => new THREE.Vector2(r * b.w, y * b.h));
      const gem = add(g, new THREE.LatheGeometry(p, 7), b.body, 0, 0, 0);
      gem.scale.z = b.d / b.w;
      top = b.h;
    }
    if (b.face) {
      const front = b.shape === "rect" || b.shape === "box" ? b.d / 2 : b.shape === "faceted" ? (b.w / 2) * Math.cos(Math.PI / 8) : b.shape === "gem" ? (b.d / 2) * 0.98 : b.w / 2;
      decal(g, b.face.tex, b.face.w, b.face.h, 0, b.h * (b.face.at ?? 0.5), front + 0.0012);
    }
    b.extra?.(g);
    if (b.cap) putCap(g, b.cap, top);
    return g;
  };

  // ---------- labels, read off the photos ----------
  const serif = "Georgia, 'Times New Roman', serif";
  const center = (c: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, color: string) => {
    c.font = font;
    c.fillStyle = color;
    c.textAlign = "center";
    c.fillText(text, x, y);
  };
  /** a printed box face: the background colour and whatever goes on it */
  const boxFace = (bg: string, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) =>
    label(192, 288, (c, w, h) => {
      c.fillStyle = bg;
      c.fillRect(0, 0, w, h);
      draw(c, w, h);
    });

  // Lattafa Pride Breeze: a white box, "Breeze" in script, a face drawn as a branching tree
  const breezeBox = boxFace("#f5f3ee", (c, w, h) => {
    center(c, "Breeze", w / 2, 58, `italic 700 38px ${serif}`, "#1b1b1b");
    c.strokeStyle = "#262626";
    c.lineCap = "round";
    const branch = (x: number, y: number, a: number, len: number, depth: number) => {
      if (depth === 0 || len < 3) return;
      const x2 = x + Math.cos(a) * len;
      const y2 = y + Math.sin(a) * len;
      c.lineWidth = Math.max(0.6, depth * 0.7);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x2, y2);
      c.stroke();
      branch(x2, y2, a - 0.45 + rand() * 0.2, len * 0.72, depth - 1);
      branch(x2, y2, a + 0.4 + rand() * 0.2, len * 0.7, depth - 1);
    };
    branch(w / 2 - 6, h - 46, -Math.PI / 2 - 0.12, 46, 7);
    // the profile of the face the tree makes, on its left
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(w / 2 - 40, 112);
    c.quadraticCurveTo(w / 2 - 58, 140, w / 2 - 46, 160);
    c.lineTo(w / 2 - 52, 170);
    c.quadraticCurveTo(w / 2 - 40, 190, w / 2 - 34, 214);
    c.stroke();
    center(c, "100ml  EAU DE PARFUM  3.4 FL.OZ", w / 2, h - 16, `600 10px ${serif}`, "#333");
  });
  // Lattafa Pride Vintage Radio: a white box with a wooden 1950s radio on it
  const radioBox = boxFace("#f5f2ea", (c, w, h) => {
    center(c, "Vintage Radio", w / 2, 56, `italic 600 27px ${serif}`, "#3b2a1f");
    const wood = c.createLinearGradient(30, 110, w - 30, 210);
    wood.addColorStop(0, "#8a4a26");
    wood.addColorStop(1, "#c07a46");
    c.fillStyle = wood;
    c.beginPath();
    c.roundRect(30, 112, w - 60, 100, 26);
    c.fill();
    c.fillStyle = "#3a2214";
    c.beginPath();
    c.roundRect(44, 128, 70, 66, 8);
    c.fill();
    c.strokeStyle = "#a76a3c";
    c.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      c.beginPath();
      c.moveTo(48, 134 + i * 9);
      c.lineTo(110, 134 + i * 9);
      c.stroke();
    }
    c.fillStyle = "#efe1c4";
    c.beginPath();
    c.arc(w - 64, 160, 26, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#7c4a24";
    c.lineWidth = 3;
    c.stroke();
    c.fillStyle = "#7c4a24";
    c.fillRect(w - 66, 140, 3, 40);
    center(c, "100ml  EAU DE PARFUM", w / 2, h - 16, `600 10px ${serif}`, "#3b2a1f");
  });
  // Rayhaan: a silver box-bottle covered in a raised geometric star lattice
  const rayhaanSilver = label(192, 224, (c, w, h) => {
    const bg = c.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#8d939c");
    bg.addColorStop(0.5, "#d6dade");
    bg.addColorStop(1, "#7a8089");
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "rgba(40,48,62,0.75)";
    c.lineWidth = 2;
    for (let y = 0; y < h + 24; y += 24)
      for (let x = (y / 24) % 2 ? 12 : 0; x < w + 24; x += 24) {
        c.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const r = k % 2 ? 6 : 12;
          c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        c.closePath();
        c.stroke();
      }
    c.fillStyle = "rgba(20,26,36,0.85)";
    c.fillRect(30, h - 52, w - 60, 26);
    center(c, "RAYHAAN", w / 2, h - 33, `700 18px ${serif}`, "#e8ebef");
  });
  // Paris Corner Rifaaqat: a white band with the name in Arabic and English, and the corner's tower
  const rifaaqat = label(128, 112, (c, w, h) => {
    c.fillStyle = "#f7f6f2";
    c.fillRect(0, 0, w, h);
    center(c, "رفاقات", w / 2, 36, `700 24px ${serif}`, "#2b2b2b");
    center(c, "Rifaaqat", w / 2, 64, `italic 600 22px ${serif}`, "#2b2b2b");
    c.fillStyle = "#3a3f52";
    c.beginPath();
    c.moveTo(w / 2, 74);
    c.lineTo(w / 2 + 9, 100);
    c.lineTo(w / 2 - 9, 100);
    c.closePath();
    c.fill();
  });
  // Mancera Instant Crush: a white label on the gold bottle, the big M and the name
  const mancera = label(128, 176, (c, w, h) => {
    c.fillStyle = "#f8f7f3";
    c.fillRect(0, 0, w, h);
    center(c, "M", w / 2, 50, `700 44px ${serif}`, "#111");
    center(c, "MANCERA", w / 2, 72, `600 14px ${serif}`, "#111");
    center(c, "PARIS", w / 2, 86, `500 9px ${serif}`, "#444");
    center(c, "INSTANT", w / 2, 122, `700 16px ${serif}`, "#111");
    center(c, "CRUSH", w / 2, 142, `700 16px ${serif}`, "#111");
    center(c, "EAU DE PARFUM", w / 2, 164, `500 9px ${serif}`, "#444");
  });
  // Lattafa Khamrah Qahwa: the name in gold on the smoky brown glass
  const khamrah = label(160, 112, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    center(c, "خمرة", w / 2, 44, `700 32px ${serif}`, "#d9b56a");
    center(c, "KHAMRAH", w / 2, 72, `700 16px ${serif}`, "#d9b56a");
    center(c, "QAHWA", w / 2, 92, `600 12px ${serif}`, "#d9b56a");
  });
  // the white speckled stone bottle with a black flower emblem (its "Legacy · Collector Edition" bottle)
  const speckle = label(160, 256, (c, w, h) => {
    c.fillStyle = "#d8d5cf";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      c.fillStyle = `rgba(25,25,25,${0.25 + rand() * 0.6})`;
      const s = 1 + rand() * 2.2;
      c.fillRect(rand() * w, rand() * h, s, s);
    }
    c.fillStyle = "#121212";
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      c.beginPath();
      c.arc(w * 0.62 + Math.cos(a) * 15, h * 0.4 + Math.sin(a) * 15, 8, 0, Math.PI * 2);
      c.fill();
    }
    center(c, "LEGACY", w / 2, h - 52, `700 15px ${serif}`, "#1a1a1a");
    center(c, "COLLECTOR EDITION", w / 2, h - 34, `600 10px ${serif}`, "#1a1a1a");
  });
  // Invictus Victory Elixir: the big silver V
  const vFace = label(128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = "#c9cdd2";
    c.lineWidth = 9;
    c.lineJoin = "miter";
    c.beginPath();
    c.moveTo(w * 0.24, h * 0.18);
    c.lineTo(w * 0.5, h * 0.82);
    c.lineTo(w * 0.76, h * 0.18);
    c.stroke();
  });
  // the clear bottle's vertical label
  const clearLabel = label(64, 192, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.save();
    c.translate(w / 2, h / 2);
    c.rotate(-Math.PI / 2);
    center(c, "EAU DE PARFUM", 0, 6, `700 15px ${serif}`, "rgba(20,20,20,0.85)");
    c.restore();
  });
  // Legacy, Royal Collection: royal blue, wrapped in a gold Moroccan lattice
  const legacyBlue = label(160, 320, (c, w, h) => {
    c.fillStyle = "#1f3596";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "rgba(226,190,112,0.9)";
    c.lineWidth = 2;
    const s = 26;
    for (let y = 0; y < h + s; y += s)
      for (let x = (y / s) % 2 ? s / 2 : 0; x < w + s; x += s) {
        c.beginPath();
        c.moveTo(x, y - s / 2);
        c.quadraticCurveTo(x + s / 2, y - s / 2, x + s / 2, y);
        c.quadraticCurveTo(x + s / 2, y + s / 2, x, y + s / 2);
        c.quadraticCurveTo(x - s / 2, y + s / 2, x - s / 2, y);
        c.quadraticCurveTo(x - s / 2, y - s / 2, x, y - s / 2);
        c.stroke();
      }
    c.fillStyle = "#1f3596";
    c.fillRect(34, h * 0.36, w - 68, 70);
    c.strokeStyle = "#e2be70";
    c.strokeRect(34, h * 0.36, w - 68, 70);
    center(c, "LEGACY", w / 2, h * 0.36 + 34, `700 20px ${serif}`, "#e2be70");
    center(c, "ROYAL COLLECTION", w / 2, h * 0.36 + 54, `600 9px ${serif}`, "#e2be70");
  });
  // Lattafa Badee Al Oud, Honor & Glory: white, a gold diamond frame and the name in Arabic and English
  const honor = label(160, 208, (c, w, h) => {
    c.fillStyle = "#f4f2ee";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#b99a5a";
    c.lineWidth = 2;
    c.strokeRect(12, 12, w - 24, h - 24);
    c.beginPath();
    c.moveTo(w / 2, 26);
    c.lineTo(w - 22, h / 2);
    c.lineTo(w / 2, h - 26);
    c.lineTo(22, h / 2);
    c.closePath();
    c.stroke();
    center(c, "بديع العود", w / 2, h / 2 - 6, `700 18px ${serif}`, "#2a2a2a");
    center(c, "BADEE AL OUD", w / 2, h / 2 + 16, `700 11px ${serif}`, "#2a2a2a");
    c.fillStyle = "#c7a457";
    c.fillRect(30, h - 46, w - 60, 18);
    center(c, "HONOR & GLORY", w / 2, h - 33, `700 10px ${serif}`, "#fff");
  });
  // Riiffs Momento: gold lettering on black
  const momento = label(128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    center(c, "MOMENTO", w / 2, 56, `600 19px ${serif}`, "#d8b768");
    center(c, "EXTRAIT DE PARFUM", w / 2, 74, `500 8px ${serif}`, "#b89a58");
    center(c, "RIIFFS", w / 2, 106, `700 12px ${serif}`, "#d8b768");
  });
  // Afnan 9pm Night Out: black crocodile leather, a gold 9 and "pm"
  const ninePm = label(160, 320, (c, w, h) => {
    c.fillStyle = "#141416";
    c.fillRect(0, 0, w, h);
    // the croc scales: irregular cells with lighter edges
    c.strokeStyle = "rgba(120,120,125,0.35)";
    c.lineWidth = 1.5;
    for (let y = 0; y < h; y += 16)
      for (let x = (y / 16) % 2 ? 9 : 0; x < w; x += 18) {
        c.beginPath();
        c.roundRect(x + rand() * 2, y + rand() * 2, 14 + rand() * 4, 12 + rand() * 3, 4);
        c.stroke();
      }
    const goldGrad = c.createLinearGradient(0, 80, 0, 230);
    goldGrad.addColorStop(0, "#f0d98e");
    goldGrad.addColorStop(1, "#a9822e");
    c.font = `700 170px ${serif}`;
    c.fillStyle = goldGrad;
    c.textAlign = "center";
    c.fillText("9", w / 2 + 6, 220);
    center(c, "pm", w / 2 - 22, 200, `700 30px ${serif}`, "#e3c56f");
    center(c, "Night Out", w / 2, 256, `italic 600 20px ${serif}`, "#e3c56f");
    center(c, "AFNAN", w / 2, h - 20, `700 13px ${serif}`, "#bfa25a");
  });
  // Bujairami Sydney: mirrored rose gold, the harbour skyline etched darker
  const bujairami = label(160, 192, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    center(c, "BUJAIRAMI", w / 2, 40, `700 16px ${serif}`, "#4a2a18");
    center(c, "SYDNEY", w / 2, 60, `600 12px ${serif}`, "#4a2a18");
    c.fillStyle = "rgba(70,38,20,0.6)";
    // the opera house sails and the bridge
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(40 + i * 14, 150);
      c.quadraticCurveTo(48 + i * 14, 112, 64 + i * 14, 108);
      c.lineTo(58 + i * 14, 150);
      c.fill();
    }
    c.strokeStyle = "rgba(70,38,20,0.6)";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(w - 40, 170, 34, Math.PI, Math.PI * 2);
    c.stroke();
  });
  // French Avenue Royal Blend Sequoia: a gold diamond plaque on the red glass
  const sequoia = label(96, 96, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = "#c7a457";
    c.beginPath();
    c.moveTo(w / 2, 4);
    c.lineTo(w - 4, h / 2);
    c.lineTo(w / 2, h - 4);
    c.lineTo(4, h / 2);
    c.closePath();
    c.fill();
    center(c, "ROYAL", w / 2, h / 2 - 8, `700 11px ${serif}`, "#2a1a10");
    center(c, "BLEND", w / 2, h / 2 + 5, `700 11px ${serif}`, "#2a1a10");
    center(c, "SEQUOIA", w / 2, h / 2 + 18, `600 8px ${serif}`, "#2a1a10");
  });
  // Emporio Armani Stronger With You Intensely, printed on the glass
  const youFace = label(160, 160, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    center(c, "STRONGER WITH", w / 2, 50, `500 12px ${serif}`, "rgba(255,244,225,0.9)");
    center(c, "YOU", w / 2, 100, `300 52px ${serif}`, "rgba(255,244,225,0.95)");
    center(c, "INTENSELY", w / 2, 124, `500 12px ${serif}`, "rgba(255,244,225,0.9)");
  });
  // Riiffs Taif: a round gold plaque with the name
  const taif = label(96, 96, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = "#d9c08a";
    c.beginPath();
    c.arc(w / 2, h / 2, w / 2 - 3, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#a88a4c";
    c.lineWidth = 3;
    c.stroke();
    center(c, "طائف", w / 2, h / 2 + 2, `700 20px ${serif}`, "#3a2a14");
    center(c, "TAIF", w / 2, h / 2 + 22, `700 12px ${serif}`, "#3a2a14");
  });
  // Armaf Odyssey Homme: white type on the black body
  const odyssey = label(128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    center(c, "ODYSSEY", w / 2, 54, `500 17px ${serif}`, "#e9e9e9");
    center(c, "HOMME", w / 2, 76, `500 17px ${serif}`, "#e9e9e9");
    center(c, "EAU DE PARFUM", w / 2, 98, `500 8px ${serif}`, "#bbbbbb");
  });
  // Arabiyat Prestige Marwa: a pale label on the silver gem
  const marwa = label(112, 144, (c, w, h) => {
    c.fillStyle = "#ece3d2";
    c.beginPath();
    c.roundRect(4, 4, w - 8, h - 8, 12);
    c.fill();
    center(c, "مروة", w / 2, 52, `700 26px ${serif}`, "#3c2e20");
    center(c, "MARWA", w / 2, 82, `700 17px ${serif}`, "#3c2e20");
    center(c, "ARABIYAT", w / 2, 106, `600 10px ${serif}`, "#3c2e20");
    center(c, "PRESTIGE", w / 2, 120, `500 8px ${serif}`, "#3c2e20");
  });
  // Rayhaan's lion: a roaring bronze lion's head in a frame, on black
  const lion = label(192, 224, (c, w, h) => {
    c.fillStyle = "#121212";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#a07d43";
    c.lineWidth = 4;
    c.beginPath();
    c.roundRect(14, 14, w - 28, h - 56, 18);
    c.stroke();
    const cx = w / 2;
    const cy = (h - 42) / 2 + 4;
    // the mane: flames of bronze around the head
    for (let k = 0; k < 30; k++) {
      const a = (k / 30) * Math.PI * 2;
      const r1 = 26;
      const r2 = 50 + rand() * 12;
      const grad = c.createLinearGradient(cx, cy, cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      grad.addColorStop(0, "#d4a95e");
      grad.addColorStop(1, "#5e4320");
      c.strokeStyle = grad;
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      c.quadraticCurveTo(cx + Math.cos(a + 0.2) * (r1 + r2) / 2, cy + Math.sin(a + 0.2) * (r1 + r2) / 2, cx + Math.cos(a + 0.12) * r2, cy + Math.sin(a + 0.12) * r2);
      c.stroke();
    }
    c.fillStyle = "#b8904c";
    c.beginPath();
    c.ellipse(cx, cy + 4, 26, 30, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#2a1c0c";
    for (const s of [-1, 1]) {
      c.beginPath();
      c.ellipse(cx + s * 10, cy - 6, 4, 2.5, s * 0.3, 0, Math.PI * 2);
      c.fill();
    }
    // the open, roaring mouth
    c.beginPath();
    c.ellipse(cx, cy + 20, 10, 8, 0, 0, Math.PI * 2);
    c.fill();
    center(c, "RAYHAAN", w / 2, h - 16, `700 16px ${serif}`, "#a07d43");
  });
  // the diagonal grooves cut into Khamrah's crystal cap
  const etched = label(128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = "rgba(255,255,255,0.6)";
    c.lineWidth = 3;
    for (let i = -h; i < w; i += 14) {
      c.beginPath();
      c.moveTo(i, h);
      c.lineTo(i + h, 0);
      c.stroke();
    }
  });

  const gold = metal("#d2ab55", 0.22);
  const silver = metal("#c8ccd2", 0.18);
  const gunmetal = metal("#4a4c52", 0.25);
  const copper = metal("#b8724a", 0.26);
  const blackCap = lacquer("#121212", 0.3, 0);
  const pewter = metal("#55565c", 0.45);

  /** Taif's gold octopus: tentacles curling down and around the round body from under the cap */
  const tentacles = (g: THREE.Group, w: number, h: number) => {
    // a gold crown under the cap where the tentacles meet
    add(g, new THREE.SphereGeometry(w * 0.3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), gold, 0, h - 0.002, 0, false);
    for (let i = 0; i < 6; i++) {
      const a0 = (i / 6) * Math.PI * 2 + 0.3;
      const dir = i % 2 ? 1 : -1;
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 14; k++) {
        const t = k / 14;
        // each one sweeps half way round the bottle as it comes down, then curls at the tip
        const a = a0 + dir * (t * 2.2 + (t > 0.8 ? (t - 0.8) * 6 : 0));
        const r = w / 2 + 0.0035 - (t > 0.85 ? (t - 0.85) * 0.03 : 0);
        pts.push(new THREE.Vector3(Math.cos(a) * r, h * (1 - t * 0.8), Math.sin(a) * r));
      }
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.0034, 8, false);
      add(g, tube, gold, 0, 0, 0, false);
    }
  };

  /** rows from the front (0, the riser's lowest step) to the back (3, the top step), left to right */
  const X = [-0.172, -0.086, 0, 0.086, 0.172];
  const ROWS: Bottle[][] = [
    [
      { name: "Emporio Armani Stronger With You Intensely", x: X[0], shape: "rect", w: 0.068, h: 0.082, d: 0.036, body: glass("#f7efe2", 0.28), juice: "#5e2806", fill: 0.84, cap: { kind: "ball", r: 0.015, m: gunmetal }, face: { tex: youFace, w: 0.058, h: 0.058 } },
      { name: "Riiffs Taif", x: X[1], shape: "round", w: 0.052, h: 0.086, d: 0.052, body: glass("#faf3d6", 0.28), juice: "#a87c0c", fill: 0.86, cap: { kind: "ball", r: 0.019, m: matte("#f1ede4", 0.45), neck: gold }, face: { tex: taif, w: 0.026, h: 0.026, at: 0.32 }, extra: (g) => tentacles(g, 0.052, 0.086) },
      { name: "Armaf Odyssey Homme", x: X[2], shape: "round", w: 0.06, h: 0.088, d: 0.06, body: lacquer("#151517", 0.25, 0.2), cap: { kind: "cyl", r: 0.029, h: 0.034, m: lacquer("#0e0e10", 0.35, 0.2) }, face: { tex: odyssey, w: 0.044, h: 0.044, at: 0.42 } },
      { name: "Arabiyat Prestige Marwa", x: X[3], shape: "gem", w: 0.062, h: 0.1, d: 0.046, body: cutMetal("#b9bdc4", 0.16), cap: { kind: "gem", r: 0.019, m: cutMetal("#c9ccd2", 0.14) }, face: { tex: marwa, w: 0.03, h: 0.038, at: 0.42 } },
      { name: "Rayhaan (lion)", x: X[4], shape: "box", w: 0.058, h: 0.072, d: 0.05, body: lacquer("#121212", 0.4, 0), cap: { kind: "cyl", r: 0.016, h: 0.024, m: blackCap }, face: { tex: lion, w: 0.054, h: 0.064 } },
    ],
    [
      { name: "Lattafa Badee Al Oud Honor & Glory", x: X[0], shape: "rect", w: 0.062, h: 0.088, d: 0.04, body: lacquer("#f2f0eb", 0.3, 0), cap: { kind: "square", s: 0.034, h: 0.028, m: lacquer("#f2f0eb", 0.3, 0), top: gold }, face: { tex: honor, w: 0.054, h: 0.07 } },
      { name: "Riiffs Momento", x: X[1], shape: "round", w: 0.052, h: 0.09, d: 0.052, body: lacquer("#121214", 0.25, 0.1), cap: { kind: "monogram", r: 0.022, m: gold }, face: { tex: momento, w: 0.04, h: 0.04, at: 0.55 }, extra: (g) => {
        // the knurled gold foot
        add(g, new THREE.CylinderGeometry(0.0268, 0.0268, 0.012, 40), gold, 0, 0.006, 0, false);
      } },
      { name: "Afnan 9pm Night Out", x: X[2], shape: "rect", w: 0.06, h: 0.118, d: 0.036, body: printed(ninePm, 0.5), cap: { kind: "ball", r: 0.021, m: pewter } },
      { name: "Bujairami Sydney", x: X[3], shape: "rect", w: 0.058, h: 0.078, d: 0.034, body: lacquer("#c99071", 0.18, 1), cap: { kind: "fan", m: copper }, face: { tex: bujairami, w: 0.05, h: 0.06 } },
      { name: "French Avenue Royal Blend Sequoia", x: X[4], shape: "faceted", w: 0.058, h: 0.112, d: 0.058, body: cutGlass("#5c0d16", 0.88), juice: "#3a060c", fill: 0.85, cap: { kind: "faceted", r: 0.02, h: 0.02, m: cutGlass("#2a0609", 0.95) }, face: { tex: sequoia, w: 0.024, h: 0.024, at: 0.3 } },
    ],
    [
      { name: "Lattafa Khamrah Qahwa", x: X[0], shape: "rect", w: 0.064, h: 0.058, d: 0.05, body: glass("#3a2418", 0.9), cap: { kind: "crystal", w: 0.06, h: 0.042, d: 0.048 }, face: { tex: khamrah, w: 0.05, h: 0.035, at: 0.5 } },
      { name: "Legacy · Collector Edition (speckled)", x: X[1], shape: "rect", w: 0.06, h: 0.1, d: 0.036, body: printed(speckle, 0.55), cap: { kind: "ring", r: 0.017, m: blackCap } },
      { name: "Paco Rabanne Invictus Victory Elixir", x: X[2], shape: "trophy", w: 0.06, h: 0.1, d: 0.06, body: lacquer("#101012", 0.22, 0.3), face: { tex: vFace, w: 0.034, h: 0.034, at: 0.52 } },
      { name: "clear bottle, sculpted black cap", x: X[3], shape: "rect", w: 0.052, h: 0.09, d: 0.036, body: glass("#eef0f2", 0.28), juice: "#cbbf98", fill: 0.62, cap: { kind: "sculpted", r: 0.017, m: blackCap }, face: { tex: clearLabel, w: 0.014, h: 0.05, at: 0.45 } },
      { name: "Legacy Royal Collection", x: X[4], shape: "round", w: 0.046, h: 0.122, d: 0.046, body: printed(legacyBlue, 0.3), cap: { kind: "cyl", r: 0.02, h: 0.036, m: gold, ribs: 5 } },
    ],
    [
      { name: "Lattafa Pride Breeze", x: X[0], shape: "box", w: 0.07, h: 0.104, d: 0.042, body: lacquer("#f5f3ee", 0.35, 0), cap: { kind: "halfMoon", r: 0.022, t: 0.016, m: lacquer("#141414", 0.4, 0) }, face: { tex: breezeBox, w: 0.068, h: 0.1 } },
      { name: "Rayhaan (silver)", x: X[1], shape: "rect", w: 0.07, h: 0.088, d: 0.038, body: printed(rayhaanSilver, 0.25), cap: { kind: "square", s: 0.03, h: 0.03, m: silver } },
      { name: "Paris Corner Rifaaqat", x: X[2], shape: "rect", w: 0.05, h: 0.074, d: 0.05, body: glass("#f2f4f5", 0.26), juice: "#7c4814", fill: 0.42, cap: { kind: "cyl", r: 0.017, h: 0.034, m: blackCap }, face: { tex: rifaaqat, w: 0.04, h: 0.035, at: 0.62 } },
      { name: "Mancera Instant Crush", x: X[3], shape: "rect", w: 0.052, h: 0.098, d: 0.036, body: lacquer("#d8b260", 0.16, 1), cap: { kind: "cyl", r: 0.013, h: 0.034, m: gold, ribs: 4 }, face: { tex: mancera, w: 0.036, h: 0.05, at: 0.42 } },
      { name: "Lattafa Pride Vintage Radio", x: X[4], shape: "box", w: 0.07, h: 0.104, d: 0.042, body: lacquer("#f5f2ea", 0.35, 0), cap: { kind: "halfMoon", r: 0.024, t: 0.016, m: copper }, face: { tex: radioBox, w: 0.068, h: 0.1 } },
    ],
  ];

  /** the black four-step riser and its bottles, standing on a surface at `at` (its centre) */
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
