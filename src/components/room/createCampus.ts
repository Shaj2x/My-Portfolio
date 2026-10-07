import * as THREE from "three";
import type { Weather } from "./createAudio";

/*
 * Western University's campus at night, seen from the window: University
 * College's Gothic tower lit in Western purple, Middlesex College with its
 * patina cupola and clock, Weldon Library, trees, lamp-lit paths and the
 * stone Western sign. It sits a couple of hundred metres out and is meant
 * to hold up under the telescope, so lighting is painted ("baked") into
 * unlit materials instead of adding real lights that would cost every
 * material in the room.
 *
 * World units are metres. The ground is 8 m below the room's floor.
 */

type Track = <T extends { dispose: () => void }>(d: T) => T;

export interface Landmark {
  name: string;
  detail: string;
  position: THREE.Vector3;
}

export interface CampusConditions {
  /** 0 night … 1 full daylight */
  day: number;
  /** 0 … 1 how much sunset/sunrise colour */
  dusk: number;
  weather: Weather;
}

export interface Campus {
  group: THREE.Group;
  sky: THREE.MeshBasicMaterial;
  landmarks: Landmark[];
  update: (t: number) => void;
  /** repaint for the time of day and weather; returns the fog to use outside */
  setConditions: (c: CampusConditions) => { fogColor: THREE.Color; fogDensity: number };
}

export const GROUND_Y = -8;

// Ground texture covers the campus core at a usable resolution for the telescope
const G = { x0: -70, x1: 130, z0: -270, z1: -60 };

export function createCampus(track: Track, rand: () => number): Campus {
  const rr = (a: number, b: number) => a + rand() * (b - a);
  const group = new THREE.Group();

  const canvas = (w: number, h: number) => {
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(w));
    c.height = Math.max(2, Math.round(h));
    return { c, ctx: c.getContext("2d")! };
  };
  const texture = (c: HTMLCanvasElement) => {
    const t = track(new THREE.CanvasTexture(c));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const basic = (params: THREE.MeshBasicMaterialParameters) => track(new THREE.MeshBasicMaterial(params));

  // ---------- facade painter ----------

  interface FacadeOpts {
    w: number;
    h: number;
    stone?: string;
    cols?: number;
    rows?: number;
    winW?: number;
    winH?: number;
    top?: number; // metres of plain wall above the window rows
    bottom?: number; // metres below
    arch?: boolean;
    lit?: number; // share of windows lit
    flood?: string; // floodlight colour, painted rising from the ground
    floodReach?: number; // 0..1 of the height
    purple?: number; // strength of a purple uplight
    door?: boolean;
    clock?: number; // y (m from bottom) for a clock face
    bands?: boolean; // brutalist concrete bands (Weldon)
    purpleEven?: boolean; // floodlit evenly to the top, as UC's tower is
    belfry?: number; // y (m from bottom) of the base of a pair of tall lit lancet windows
    slits?: number[]; // heights of small lit slit windows down the middle
  }

  // daylight stone: the night colour lifted to sunlit sandstone
  const daylit = (hex: string, k = 2.5) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v: number) => Math.min(255, Math.round(v * k));
    return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
  };

  function facade(o: FacadeOpts, day = false) {
    const s = Math.min(28, 1024 / o.w, 1024 / o.h);
    const { c, ctx } = canvas(o.w * s, o.h * s);
    const W = c.width;
    const H = c.height;
    const m = (v: number) => v * s;
    ctx.fillStyle = day ? daylit(o.stone ?? "#3a3328") : (o.stone ?? "#3a3328");
    ctx.fillRect(0, 0, W, H);

    // stone coursing
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 1;
    for (let y = 0; y < o.h; y += 0.45) {
      ctx.beginPath();
      ctx.moveTo(0, H - m(y));
      ctx.lineTo(W, H - m(y));
      ctx.stroke();
      const off = (Math.round(y / 0.45) % 2) * 0.6;
      for (let x = off; x < o.w; x += 1.2) {
        ctx.beginPath();
        ctx.moveTo(m(x), H - m(y));
        ctx.lineTo(m(x), H - m(y + 0.45));
        ctx.stroke();
      }
    }
    for (let i = 0; i < W * H * 0.02; i++) {
      ctx.fillStyle = `rgba(${rand() > 0.5 ? "255,240,220" : "0,0,0"},${rr(0.02, 0.08)})`;
      ctx.fillRect(rand() * W, rand() * H, 2, 2);
    }

    // floodlight washing up the wall
    ctx.globalCompositeOperation = "lighter";
    if (o.flood && !day) {
      const g = ctx.createLinearGradient(0, H, 0, H - H * (o.floodReach ?? 0.8));
      g.addColorStop(0, o.flood);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // scalloped pools where each lamp sits
      for (let x = 0; x < o.w; x += 7) {
        const rg = ctx.createRadialGradient(m(x + 3.5), H, 0, m(x + 3.5), H, m(6));
        rg.addColorStop(0, o.flood);
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, W, H);
      }
    }
    if (o.purple && !day) {
      const g = ctx.createLinearGradient(0, H, 0, 0);
      const even = o.purpleEven ? 1 : 0;
      g.addColorStop(0, `rgba(170,80,255,${0.6 * o.purple})`);
      g.addColorStop(0.55, `rgba(140,60,240,${(0.35 + 0.25 * even) * o.purple})`);
      g.addColorStop(1, `rgba(${even ? "120,50,220" : "60,20,140"},${(0.12 + 0.33 * even) * o.purple})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = "source-over";

    if (o.bands) {
      // Weldon: heavy horizontal concrete bands over deep lit window strips, broken by fins
      const bandH = 1.6;
      for (let y = 1.2; y < o.h - 1.5; y += 3.4) {
        ctx.fillStyle = day ? "#34393f" : "#0b0f14";
        ctx.fillRect(0, H - m(y + bandH), W, m(bandH));
        for (let x = 0.4; x < o.w; x += 2.2) {
          const lit = rand() < (o.lit ?? 0.5);
          ctx.fillStyle = day
            ? `rgba(${Math.floor(rr(110, 160))},${Math.floor(rr(130, 170))},${Math.floor(rr(150, 190))},0.95)`
            : lit
              ? `rgba(210,232,255,${rr(0.55, 0.95)})`
              : "rgba(30,40,55,0.9)";
          ctx.fillRect(m(x), H - m(y + bandH - 0.2), m(1.7), m(bandH - 0.4));
        }
      }
      ctx.fillStyle = day ? "rgba(185,180,172,0.95)" : "rgba(90,86,80,0.85)";
      for (let x = 0; x < o.w; x += 4.4) ctx.fillRect(m(x), 0, m(0.45), H);
    }

    // windows
    const cols = o.cols ?? 0;
    const rows = o.rows ?? 0;
    const ww = o.winW ?? 1.1;
    const wh = o.winH ?? 2.2;
    const bottom = o.bottom ?? 1.5;
    const top = o.top ?? 1.5;
    const span = o.h - bottom - top;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const cx = ((col + 0.5) / cols) * o.w;
        const y0 = bottom + (rows === 1 ? (span - wh) / 2 : (r / (rows - 1)) * (span - wh));
        const x = m(cx - ww / 2);
        const yTop = H - m(y0 + wh);
        const lit = rand() < (o.lit ?? 0.4);
        const warm = rand() < 0.8;
        ctx.fillStyle = day
          ? `rgb(${Math.floor(rr(60, 105))},${Math.floor(rr(75, 115))},${Math.floor(rr(95, 140))})` // sky in the glass
          : lit
            ? warm
              ? `rgb(255,${Math.floor(rr(190, 220))},${Math.floor(rr(120, 160))})`
              : "rgb(220,235,255)"
            : "#0d1219";
        ctx.beginPath();
        if (o.arch) {
          const archH = ww * 0.9;
          ctx.moveTo(x, H - m(y0));
          ctx.lineTo(x, yTop + m(archH));
          ctx.quadraticCurveTo(x, yTop + m(archH * 0.25), x + m(ww / 2), yTop);
          ctx.quadraticCurveTo(x + m(ww), yTop + m(archH * 0.25), x + m(ww), yTop + m(archH));
          ctx.lineTo(x + m(ww), H - m(y0));
        } else {
          ctx.rect(x, yTop, m(ww), m(wh));
        }
        ctx.fill();
        // mullions and stone surround
        ctx.strokeStyle = day ? "rgba(60,52,42,0.85)" : lit ? "rgba(60,40,20,0.7)" : "rgba(0,0,0,0.5)";
        ctx.lineWidth = Math.max(1, m(0.08));
        ctx.beginPath();
        ctx.moveTo(x + m(ww / 2), yTop + m(ww * 0.4));
        ctx.lineTo(x + m(ww / 2), H - m(y0));
        ctx.moveTo(x, H - m(y0 + wh * 0.45));
        ctx.lineTo(x + m(ww), H - m(y0 + wh * 0.45));
        ctx.stroke();
      }
    }

    const warmGlass = (x: number, yTop: number, w: number, h: number) => {
      const g = ctx.createLinearGradient(0, yTop, 0, yTop + h);
      g.addColorStop(0, day ? "#3a4a66" : "#ffe2a8");
      g.addColorStop(1, day ? "#556583" : "#ffbf6a");
      ctx.fillStyle = g;
      ctx.fillRect(x, yTop, w, h);
    };
    if (o.belfry !== undefined) {
      // two tall lancets side by side, with a stone surround, a mullion and a transom
      const lw = 1.5;
      const lh = 6.2;
      for (const cx of [o.w / 2 - 1.1, o.w / 2 + 1.1]) {
        const x = m(cx - lw / 2);
        const yTop = H - m(o.belfry + lh);
        ctx.fillStyle = day ? "#6e6252" : "#2a1f2e";
        ctx.beginPath();
        ctx.moveTo(x - m(0.25), H - m(o.belfry - 0.2));
        ctx.lineTo(x - m(0.25), yTop + m(1.2));
        ctx.quadraticCurveTo(x - m(0.25), yTop - m(0.35), x + m(lw / 2), yTop - m(0.55));
        ctx.quadraticCurveTo(x + m(lw + 0.25), yTop - m(0.35), x + m(lw + 0.25), yTop + m(1.2));
        ctx.lineTo(x + m(lw + 0.25), H - m(o.belfry - 0.2));
        ctx.fill();
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, H - m(o.belfry));
        ctx.lineTo(x, yTop + m(1.2));
        ctx.quadraticCurveTo(x, yTop, x + m(lw / 2), yTop - m(0.2));
        ctx.quadraticCurveTo(x + m(lw), yTop, x + m(lw), yTop + m(1.2));
        ctx.lineTo(x + m(lw), H - m(o.belfry));
        ctx.clip();
        warmGlass(x, yTop - m(0.3), m(lw), m(lh + 0.4));
        ctx.restore();
        ctx.strokeStyle = day ? "rgba(60,52,42,0.9)" : "rgba(70,40,30,0.8)";
        ctx.lineWidth = Math.max(1, m(0.12));
        ctx.beginPath();
        ctx.moveTo(x + m(lw / 2), yTop + m(0.6));
        ctx.lineTo(x + m(lw / 2), H - m(o.belfry));
        for (const f of [0.45, 0.72]) {
          ctx.moveTo(x, H - m(o.belfry + lh * f));
          ctx.lineTo(x + m(lw), H - m(o.belfry + lh * f));
        }
        ctx.stroke();
      }
    }
    for (const sy of o.slits ?? []) warmGlass(W / 2 - m(0.18), H - m(sy + 1.3), m(0.36), m(1.3));

    if (o.door) {
      // pointed-arch entrance glowing warm at the base of the tower
      const dw = 2.6;
      const dh = 4.2;
      const x = W / 2 - m(dw / 2);
      const g = ctx.createLinearGradient(0, H - m(dh), 0, H);
      g.addColorStop(0, day ? "#4a2e1a" : "#ffcf8a");
      g.addColorStop(1, day ? "#2e1c10" : "#ffe7c0");
      ctx.fillStyle = day ? "#6a5a46" : "#1c150e";
      ctx.beginPath();
      ctx.moveTo(x - m(0.5), H);
      ctx.lineTo(x - m(0.5), H - m(dh - 0.6));
      ctx.quadraticCurveTo(W / 2 - m(dw / 2), H - m(dh + 1.3), W / 2, H - m(dh + 1.6));
      ctx.quadraticCurveTo(W / 2 + m(dw / 2), H - m(dh + 1.3), x + m(dw + 0.5), H - m(dh - 0.6));
      ctx.lineTo(x + m(dw + 0.5), H);
      ctx.fill();
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(x, H - m(dh - 0.8));
      ctx.quadraticCurveTo(x, H - m(dh + 0.3), W / 2, H - m(dh + 0.8));
      ctx.quadraticCurveTo(x + m(dw), H - m(dh + 0.3), x + m(dw), H - m(dh - 0.8));
      ctx.lineTo(x + m(dw), H);
      ctx.fill();
    }

    if (o.clock !== undefined) {
      const cy = H - m(o.clock);
      const r = m(1.6);
      ctx.fillStyle = "#1a1510";
      ctx.beginPath();
      ctx.arc(W / 2, cy, r * 1.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff1d2";
      ctx.beginPath();
      ctx.arc(W / 2, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#2a2118";
      ctx.lineWidth = Math.max(1, m(0.08));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(W / 2 + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82);
        ctx.lineTo(W / 2 + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95);
        ctx.stroke();
      }
      // 2:47
      const hand = (a: number, len: number, wdt: number) => {
        ctx.lineWidth = Math.max(1, m(wdt));
        ctx.beginPath();
        ctx.moveTo(W / 2, cy);
        ctx.lineTo(W / 2 + Math.sin(a) * r * len, cy - Math.cos(a) * r * len);
        ctx.stroke();
      };
      hand(((2 + 47 / 60) / 12) * Math.PI * 2, 0.5, 0.16);
      hand((47 / 60) * Math.PI * 2, 0.78, 0.1);
    }
    return texture(c);
  }

  type Pair = { night: THREE.Texture; day: THREE.Texture };
  const pair = (o: FacadeOpts): Pair => ({ night: facade(o), day: facade(o, true) });

  // materials that change between night and day (textures) or with the weather (colours)
  const swaps: { mat: THREE.MeshBasicMaterial; tex: Pair }[] = [];
  const colorSwaps: { mat: THREE.MeshBasicMaterial; night: THREE.Color; day: THREE.Color; snow?: THREE.Color }[] = [];
  const swapColor = (mat: THREE.MeshBasicMaterial, night: THREE.ColorRepresentation, day: THREE.ColorRepresentation, snow?: THREE.ColorRepresentation) => {
    colorSwaps.push({ mat, night: new THREE.Color(night), day: new THREE.Color(day), snow: snow !== undefined ? new THREE.Color(snow) : undefined });
    return mat;
  };

  // ---------- geometry helpers ----------

  const roofMat = swapColor(basic({ color: "#14171c" }), "#14171c", "#4d525a", "#d6dce3");
  const darkMat = swapColor(basic({ color: "#0a0c10" }), "#0a0c10", "#2a2c30");
  const stoneLit = swapColor(basic({ color: "#6e5c48" }), "#6e5c48", "#a8977c");
  const stonePurple = swapColor(basic({ color: new THREE.Color(0.42, 0.26, 0.62) }), new THREE.Color(0.42, 0.26, 0.62), "#a39279");

  /** A block with painted faces. front faces +z, toward the room. */
  function block(w: number, h: number, d: number, x: number, z: number, front: Pair, side: Pair, y0 = GROUND_Y) {
    const tint = new THREE.Color(0.95, 0.95, 1.0); // a dark, wet night: lit windows stay just under bloom
    const frontMat = basic({ map: front.night, color: tint });
    const sideMat = basic({ map: side.night, color: tint });
    swaps.push({ mat: frontMat, tex: front }, { mat: sideMat, tex: side });
    const mesh = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), [sideMat, sideMat, roofMat, darkMat, frontMat, frontMat]);
    mesh.position.set(x, y0 + h / 2, z);
    group.add(mesh);
    return mesh;
  }

  /** A gabled roof: ridge along x when alongX, else along z (gable end faces the room). */
  function gable(w: number, rise: number, d: number, x: number, y: number, z: number, alongX: boolean, material: THREE.Material = roofMat) {
    const span = alongX ? d : w;
    const len = alongX ? w : d;
    const shape = new THREE.Shape();
    shape.moveTo(-span / 2, 0);
    shape.lineTo(span / 2, 0);
    shape.lineTo(0, rise);
    shape.closePath();
    const geo = track(new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false }));
    geo.translate(0, 0, -len / 2);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    if (alongX) mesh.rotation.y = Math.PI / 2;
    group.add(mesh);
    return mesh;
  }

  function battlements(w: number, d: number, x: number, y: number, z: number, material: THREE.Material) {
    const geo = track(new THREE.BoxGeometry(0.7, 0.9, 0.7));
    const pts: [number, number][] = [];
    for (let i = -w / 2; i <= w / 2 + 0.01; i += 1.4) pts.push([i, -d / 2], [i, d / 2]);
    for (let i = -d / 2 + 1.4; i < d / 2; i += 1.4) pts.push([-w / 2, i], [w / 2, i]);
    const inst = new THREE.InstancedMesh(geo, material, pts.length);
    const o = new THREE.Object3D();
    pts.forEach(([px, pz], i) => {
      o.position.set(x + px, y + 0.45, z + pz);
      o.updateMatrix();
      inst.setMatrixAt(i, o.matrix);
    });
    group.add(inst);
  }

  function pinnacle(x: number, y: number, z: number, h: number, material: THREE.Material) {
    const shaft = new THREE.Mesh(track(new THREE.BoxGeometry(1.1, h * 0.45, 1.1)), material);
    shaft.position.set(x, y + h * 0.225, z);
    const spire = new THREE.Mesh(track(new THREE.ConeGeometry(0.75, h * 0.55, 4)), material);
    spire.position.set(x, y + h * 0.45 + h * 0.275, z);
    spire.rotation.y = Math.PI / 4;
    const finial = new THREE.Mesh(track(new THREE.SphereGeometry(0.18, 8, 6)), material);
    finial.position.set(x, y + h + 0.1, z);
    group.add(shaft, spire, finial);
  }

  // ---------- sky and distant London ----------

  const skyC = canvas(1024, 512);
  // fixed cloud shapes so repaints for different weather don't jump around
  const clouds = Array.from({ length: 70 }, () => ({ x: rand() * 1024, y: rr(120, 470), rx: rr(60, 210), ry: rr(18, 52), a: rr(0.5, 1) }));
  const mixHex = (a: string, b: string, k: number) => new THREE.Color(a).lerp(new THREE.Color(b), k);
  const drawSky = ({ day, dusk, weather }: CampusConditions) => {
    const { ctx } = skyC;
    const overcast = weather !== "clear";
    // [top, middle, horizon] for night, day and dusk
    const night = overcast ? ["#020307", "#070b13", "#1f1a1c"] : ["#01030a", "#061126", "#16223a"];
    const noon = overcast ? (weather === "snow" ? ["#9aa2ad", "#bcc3cc", "#d9dde2"] : ["#6f7a86", "#8e98a3", "#b3bac2"]) : ["#2f64a8", "#6b9bd0", "#bcd6ec"];
    const eve = overcast ? ["#2b2a3a", "#5a4a58", "#9a7068"] : ["#1d2350", "#7a4a78", "#f39a5a"];
    const stops = [0, 0.55, 1].map((pos, i) => {
      const c = mixHex(night[i], noon[i], day).lerp(new THREE.Color(eve[i]), dusk);
      return [pos, `#${c.getHexString()}`] as const;
    });
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    stops.forEach(([pos, col]) => g.addColorStop(pos, col));
    ctx.filter = "none";
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);
    ctx.filter = "blur(18px)";
    const count = overcast ? clouds.length : 14;
    for (let i = 0; i < count; i++) {
      const cl = clouds[i];
      const shade = overcast ? THREE.MathUtils.lerp(60, 205, day) : THREE.MathUtils.lerp(40, 245, day);
      const alpha = (overcast ? 0.18 : 0.12 + day * 0.25) * cl.a;
      const tint = dusk > 0.1 ? `${Math.round(shade + 40 * dusk)},${Math.round(shade * 0.8)},${Math.round(shade * 0.8)}` : `${Math.round(shade)},${Math.round(shade + 3)},${Math.round(shade + 10)}`;
      ctx.fillStyle = `rgba(${tint},${alpha})`;
      ctx.beginPath();
      ctx.ellipse(cl.x, cl.y, cl.rx, cl.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.filter = "none";
    skyTex.needsUpdate = true;
  };
  const skyTex = texture(skyC.c);
  const sky = basic({ map: skyTex, fog: false, depthWrite: false });
  const skyMesh = new THREE.Mesh(track(new THREE.PlaneGeometry(2600, 900)), sky);
  skyMesh.position.set(40, GROUND_Y + 380, -700);
  skyMesh.renderOrder = -2;
  group.add(skyMesh);

  const STARS = 1600;
  const starPos = new Float32Array(STARS * 3);
  for (let i = 0; i < STARS; i++) starPos.set([rr(-900, 1000), GROUND_Y + rr(40, 560), -690], i * 3);
  const starGeo = track(new THREE.BufferGeometry());
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const starMat = track(new THREE.PointsMaterial({ color: "#e8eeff", size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -1;
  group.add(stars);
  const moonC = canvas(256, 256);
  {
    const { ctx } = moonC;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,250,235,1)");
    g.addColorStop(0.22, "rgba(245,240,225,1)");
    g.addColorStop(0.26, "rgba(200,210,235,0.35)");
    g.addColorStop(1, "rgba(120,140,190,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "rgba(170,165,150,0.35)"; // maria
    for (const [x, y, r] of [[112, 116, 12], [140, 136, 9], [122, 146, 7]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const moonMat = basic({ map: texture(moonC.c), transparent: true, fog: false, depthWrite: false, opacity: 0, color: new THREE.Color(1.6, 1.6, 1.6) });
  const moon = new THREE.Mesh(track(new THREE.PlaneGeometry(70, 70)), moonMat);
  moon.position.set(150, GROUND_Y + 175, -685);
  moon.renderOrder = -1;
  group.add(moon);

  const skylineC = canvas(2048, 256);
  const skylineDayC = canvas(2048, 256);
  {
    const { ctx } = skylineC;
    for (let i = 0; i < 160; i++) {
      const bw = rr(14, 60);
      const bh = rr(20, i % 9 === 0 ? 200 : 110);
      const bx = rand() * 2048;
      ctx.fillStyle = "#070a10";
      ctx.fillRect(bx, 256 - bh, bw, bh);
      skylineDayC.ctx.fillStyle = `rgb(${Math.floor(rr(120, 150))},${Math.floor(rr(128, 155))},${Math.floor(rr(138, 165))})`;
      skylineDayC.ctx.fillRect(bx, 256 - bh, bw, bh);
      for (let wy = 256 - bh + 4; wy < 250; wy += 7) {
        for (let wx = bx + 3; wx < bx + bw - 3; wx += 6) {
          if (rand() < 0.22) {
            ctx.fillStyle = rand() < 0.8 ? `rgba(255,190,120,${rr(0.4, 0.9)})` : `rgba(150,210,255,${rr(0.4, 0.8)})`;
            ctx.fillRect(wx, wy, 2, 3);
          }
        }
      }
    }
  }
  const skylineMat = swapColor(basic({ map: texture(skylineC.c), transparent: true, fog: false, depthWrite: false, color: "#5a6070" }), "#5a6070", "#ffffff");
  swaps.push({ mat: skylineMat, tex: { night: skylineMat.map!, day: texture(skylineDayC.c) } });
  const skyline = new THREE.Mesh(track(new THREE.PlaneGeometry(1500, 190)), skylineMat);
  skyline.position.set(40, GROUND_Y + 95 - 30, -640);
  skyline.renderOrder = -1;
  group.add(skyline);

  // ---------- ground ----------

  const farGround = new THREE.Mesh(track(new THREE.PlaneGeometry(2400, 1400)), swapColor(basic({ color: "#06090b" }), "#06090b", "#34432f", "#cfd5dc"));
  farGround.rotation.x = -Math.PI / 2;
  farGround.position.set(40, GROUND_Y - 0.05, -500);
  group.add(farGround);

  const lamps: THREE.Vector2[] = [];
  for (let x = 4; x <= 60; x += 8) lamps.push(new THREE.Vector2(x, -116));
  for (const z of [-124, -132, -140]) lamps.push(new THREE.Vector2(26.5, z), new THREE.Vector2(33.5, z));
  for (let i = 0; i < 5; i++) lamps.push(new THREE.Vector2(52 + i * 5, -150 - i * 5));
  for (let x = -20; x <= 20; x += 8) lamps.push(new THREE.Vector2(x, -170));

  const GW = 2048;
  const GH = Math.round((2048 * (G.z1 - G.z0)) / (G.x1 - G.x0));
  const paintGround = (day: boolean) => {
    const { c: gc, ctx } = canvas(GW, GH);
    const px = (x: number) => ((x - G.x0) / (G.x1 - G.x0)) * GW;
    const pz = (z: number) => ((z - G.z0) / (G.z1 - G.z0)) * GH;
    const pm = GW / (G.x1 - G.x0);
    ctx.fillStyle = day ? "#4a6a3a" : "#0a110c";
    ctx.fillRect(0, 0, GW, GH);
    for (let i = 0; i < 90000; i++) {
      ctx.fillStyle = day ? `rgba(${rand() > 0.5 ? "120,160,90" : "20,40,20"},${rr(0.05, 0.2)})` : `rgba(${rand() > 0.5 ? "40,70,40" : "0,0,0"},${rr(0.05, 0.2)})`;
      ctx.fillRect(rand() * GW, rand() * GH, 2, 2);
    }
    // wet concrete paths
    ctx.strokeStyle = day ? "#8a8b86" : "#1d1f22";
    ctx.lineCap = "round";
    ctx.lineWidth = 4 * pm;
    const path = (pts: [number, number][]) => {
      ctx.beginPath();
      pts.forEach(([x, z], i) => (i ? ctx.lineTo(px(x), pz(z)) : ctx.moveTo(px(x), pz(z))));
      ctx.stroke();
    };
    path([[-60, -116], [120, -116]]);
    path([[30, -116], [30, -146]]);
    path([[45, -116], [52, -150], [72, -170]]);
    path([[-60, -170], [30, -166], [60, -178]]);
    ctx.lineWidth = 7 * pm;
    path([[30, -95], [30, -116]]);
    if (day) return texture(gc);
    // light pools, a little glossy from the rain
    ctx.globalCompositeOperation = "lighter";
    for (const l of lamps) {
      const g = ctx.createRadialGradient(px(l.x), pz(l.y), 0, px(l.x), pz(l.y), 9 * pm);
      g.addColorStop(0, "rgba(255,190,110,0.55)");
      g.addColorStop(0.4, "rgba(255,160,80,0.18)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, GW, GH);
    }
    for (const [x, z, r] of [[30, -147, 14], [30, -111, 9]] as const) {
      const g = ctx.createRadialGradient(px(x), pz(z), 0, px(x), pz(z), r * pm);
      g.addColorStop(0, "rgba(150,70,255,0.5)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, GW, GH);
    }
    ctx.globalCompositeOperation = "source-over";
    return texture(gc);
  };
  const groundTex: Pair = { night: paintGround(false), day: paintGround(true) };
  const groundMat = swapColor(basic({ map: groundTex.night, color: "#9a9aa4" }), "#9a9aa4", "#ffffff");
  swaps.push({ mat: groundMat, tex: groundTex });
  const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(G.x1 - G.x0, G.z1 - G.z0)), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((G.x0 + G.x1) / 2, GROUND_Y, (G.z0 + G.z1) / 2);
  group.add(ground);
  // a blanket of snow laid over the ground, shown on snowy days and nights
  const snowC = canvas(1024, 1024);
  {
    const { ctx } = snowC;
    ctx.fillStyle = "rgba(236,240,246,0.9)";
    ctx.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 26000; i++) {
      ctx.fillStyle = `rgba(${rand() > 0.5 ? "255,255,255" : "150,160,175"},${rr(0.05, 0.25)})`;
      ctx.fillRect(rand() * 1024, rand() * 1024, 3, 3);
    }
  }
  const snowTex = texture(snowC.c);
  snowTex.wrapS = snowTex.wrapT = THREE.RepeatWrapping;
  snowTex.repeat.set(6, 6);
  const snowMat = basic({ map: snowTex, transparent: true });
  const snowCover = new THREE.Mesh(track(new THREE.PlaneGeometry(G.x1 - G.x0, G.z1 - G.z0)), snowMat);
  snowCover.rotation.x = -Math.PI / 2;
  snowCover.position.set((G.x0 + G.x1) / 2, GROUND_Y + 0.03, (G.z0 + G.z1) / 2);
  snowCover.visible = false;
  group.add(snowCover);

  // ---------- University College ----------

  const UC = { x: 30, z: -150 };
  // The tower: tall and slender, floodlit purple all the way up, a pair of lit lancets in its
  // belfry, small lit slits below, a corner turret rising above the battlements, and a porch at
  // its foot with the arched entrance. Built from the photo of UC at dusk.
  const towerH = 40;
  const towerW = 8;
  const tz = UC.z + 3;
  const towerOpts = { w: towerW, h: towerH, stone: "#3a3030", purple: 1.15, purpleEven: true, flood: "rgba(170,90,255,0.3)", floodReach: 0.9 };
  const towerFront = pair({ ...towerOpts, belfry: 28.5, slits: [13, 17.5, 22] });
  const towerSide = pair({ ...towerOpts, stone: "#40362e", belfry: 28.5, slits: [17.5] });
  block(towerW, towerH, towerW, UC.x, tz, towerFront, towerSide);
  const towerTop = GROUND_Y + towerH;
  battlements(towerW, towerW, UC.x, towerTop, tz, stonePurple);
  // a slender pinnacle on the left front corner, a turret on the right
  pinnacle(UC.x - towerW / 2 + 0.4, towerTop, tz + towerW / 2 - 0.4, 5, stonePurple);
  pinnacle(UC.x - towerW / 2 + 0.4, towerTop, tz - towerW / 2 + 0.4, 3.5, stonePurple);
  pinnacle(UC.x + towerW / 2 - 0.4, towerTop, tz - towerW / 2 + 0.4, 3.5, stonePurple);
  const turretX = UC.x + towerW / 2 - 0.9;
  const turretZ = tz + towerW / 2 - 0.9;
  const turret = new THREE.Mesh(track(new THREE.CylinderGeometry(1.5, 1.5, 9, 8)), stonePurple);
  turret.position.set(turretX, towerTop - 4.5 + 4, turretZ);
  group.add(turret);
  const merlonGeo = track(new THREE.BoxGeometry(0.55, 0.8, 0.55));
  const merlons = new THREE.InstancedMesh(merlonGeo, stonePurple, 8);
  const mo = new THREE.Object3D();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    mo.position.set(turretX + Math.cos(a) * 1.45, towerTop + 4 + 0.4, turretZ + Math.sin(a) * 1.45);
    mo.rotation.y = -a;
    mo.updateMatrix();
    merlons.setMatrixAt(i, mo.matrix);
  }
  group.add(merlons);
  // the flag, on its tall pole from the turret
  const pole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.06, 0.06, 9, 6)), darkMat);
  pole.position.set(turretX, towerTop + 4 + 4.5, turretZ);
  group.add(pole);
  const flagGeo = track(new THREE.PlaneGeometry(2.6, 1.5, 12, 1));
  flagGeo.translate(1.3, 0, 0);
  const flag = new THREE.Mesh(flagGeo, basic({ color: new THREE.Color(0.5, 0.22, 0.85), side: THREE.DoubleSide }));
  flag.position.set(turretX, towerTop + 4 + 8.2, turretZ);
  flag.rotation.y = -0.3;
  group.add(flag);
  // the porch: the arched entrance and a lit window band above it, battlemented
  const porchW = 7.4;
  const porchH = 9;
  const porchFront = pair({ w: porchW, h: porchH, stone: "#3a3030", purple: 1.1, purpleEven: true, door: true, cols: 3, rows: 1, winW: 1.5, winH: 1.8, bottom: 6.4, top: 0.8, lit: 1 });
  const porchSide = pair({ w: 3, h: porchH, stone: "#40362e", purple: 1.1 });
  block(porchW, porchH, 3, UC.x, tz + towerW / 2 + 1.5, porchFront, porchSide);
  battlements(porchW, 3, UC.x, GROUND_Y + porchH, tz + towerW / 2 + 1.5, stonePurple);

  // the wings: on the left the great hall, with tall arched windows lit gold and pinnacled
  // buttresses under a low metal roof; on the right a plainer, lower range of square windows
  const metalRoof = swapColor(basic({ color: "#2b3036" }), "#2b3036", "#7d8790", "#d6dce3");
  const hallW = 26;
  const hallH = 15;
  const hallFront = pair({ w: hallW, h: hallH, cols: 6, rows: 2, winW: 2.2, winH: 4.2, bottom: 1.6, top: 1.6, arch: true, lit: 0.95, flood: "rgba(255,190,120,0.35)", floodReach: 0.5, stone: "#3d352b" });
  const hallSide = pair({ w: 13, h: hallH, cols: 3, rows: 2, winW: 2, winH: 4, arch: true, lit: 0.8, stone: "#352e25" });
  const hallX = UC.x - towerW / 2 - hallW / 2;
  block(hallW, hallH, 13, hallX, UC.z, hallFront, hallSide);
  gable(hallW, 2.6, 13, hallX, GROUND_Y + hallH, UC.z, true, metalRoof);
  for (let i = 0; i <= 6; i++) pinnacle(hallX - hallW / 2 + (i / 6) * hallW, GROUND_Y + hallH, UC.z + 6.6, 2.8, stoneLit);
  const rangeW = 26;
  const rangeH = 12;
  const rangeFront = pair({ w: rangeW, h: rangeH, cols: 9, rows: 3, winW: 1.1, winH: 1.9, bottom: 1.4, top: 1.2, lit: 0.55, flood: "rgba(255,190,120,0.3)", floodReach: 0.5, stone: "#3a3226" });
  const rangeSide = pair({ w: 12, h: rangeH, cols: 4, rows: 3, winW: 1.1, winH: 1.9, lit: 0.4, stone: "#30291f" });
  const rangeX = UC.x + towerW / 2 + rangeW / 2;
  block(rangeW, rangeH, 12, rangeX, UC.z - 0.5, rangeFront, rangeSide);
  battlements(rangeW, 12, rangeX, GROUND_Y + rangeH, UC.z - 0.5, stoneLit);
  // a projecting bay at the far end of each range, as in the photo
  for (const [side, h] of [[-1, hallH + 1], [1, rangeH + 1]] as const) {
    const px = UC.x + side * (towerW / 2 + 26 + 4);
    const pav = pair({ w: 8, h, cols: 2, rows: 3, winW: 1.2, winH: 2.2, bottom: 1.6, top: 2, arch: side < 0, lit: 0.5, flood: "rgba(255,190,120,0.35)", stone: "#3a3226" });
    block(8, h, 16, px, UC.z + 1, pav, side < 0 ? hallSide : rangeSide);
    battlements(8, 16, px, GROUND_Y + h, UC.z + 1, stoneLit);
  }

  // ---------- Middlesex College ----------

  const MC = { x: 70, z: -185 };
  const mcFront = pair({ w: 30, h: 13, cols: 11, rows: 2, winW: 1.1, winH: 2.3, bottom: 2, top: 2, lit: 0.4, flood: "rgba(255,190,120,0.4)", stone: "#3c3a36" });
  const mcSide = pair({ w: 14, h: 13, cols: 5, rows: 2, lit: 0.3, stone: "#33312d" });
  block(30, 13, 14, MC.x, MC.z, mcFront, mcSide);
  gable(30, 4.5, 14, MC.x, GROUND_Y + 13, MC.z, true);
  const mcTowerH = 24;
  const mcTower = pair({ w: 7, h: mcTowerH, cols: 1, rows: 3, winW: 1.3, winH: 2.6, bottom: 3, top: 8, lit: 0.5, flood: "rgba(255,200,140,0.5)", floodReach: 0.6, clock: mcTowerH - 3.2, stone: "#403d38" });
  const mcTowerSide = pair({ w: 7, h: mcTowerH, cols: 1, rows: 3, winW: 1.3, winH: 2.6, bottom: 3, top: 8, lit: 0.3, flood: "rgba(255,200,140,0.35)", clock: mcTowerH - 3.2, stone: "#37342f" });
  block(7, mcTowerH, 7, MC.x - 6, MC.z + 5, mcTower, mcTowerSide);
  const patina = swapColor(basic({ color: new THREE.Color(0.28, 0.5, 0.44) }), new THREE.Color(0.28, 0.5, 0.44), "#6aa593", "#c9d8d4");
  const drum = new THREE.Mesh(track(new THREE.CylinderGeometry(2.6, 2.9, 4.5, 8)), patina);
  drum.position.set(MC.x - 6, GROUND_Y + mcTowerH + 2.25, MC.z + 5);
  const dome = new THREE.Mesh(track(new THREE.SphereGeometry(2.7, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), patina);
  dome.position.set(MC.x - 6, GROUND_Y + mcTowerH + 4.5, MC.z + 5);
  const lantern = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.7, 0.8, 2.2, 8)),
    swapColor(basic({ color: new THREE.Color(1.6, 1.25, 0.8) }), new THREE.Color(1.6, 1.25, 0.8), "#d4ccb8"),
  );
  lantern.position.set(MC.x - 6, GROUND_Y + mcTowerH + 7.9, MC.z + 5);
  const spire = new THREE.Mesh(track(new THREE.ConeGeometry(0.8, 3.2, 8)), patina);
  spire.position.set(MC.x - 6, GROUND_Y + mcTowerH + 10.6, MC.z + 5);
  group.add(drum, dome, lantern, spire);

  // ---------- Weldon Library ----------

  const WL = { x: -8, z: -200 };
  const wlFront = pair({ w: 56, h: 15, bands: true, lit: 0.6, flood: "rgba(200,220,255,0.18)", floodReach: 0.4, stone: "#2e2d2b" });
  const wlSide = pair({ w: 30, h: 15, bands: true, lit: 0.5, stone: "#292826" });
  block(56, 15, 30, WL.x, WL.z, wlFront, wlSide);
  block(40, 3, 22, WL.x, WL.z, wlSide, wlSide, GROUND_Y + 15);

  // ---------- Western sign ----------

  const paintSign = (day: boolean) => {
    const { c: sc, ctx } = canvas(1024, 180);
    ctx.fillStyle = day ? "#a4927a" : "#4a4033";
    ctx.fillRect(0, 0, 1024, 180);
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = `rgba(${rand() > 0.5 ? "255,240,220" : "0,0,0"},0.08)`;
      ctx.fillRect(rand() * 1024, rand() * 180, 2, 2);
    }
    if (!day) {
      const g = ctx.createLinearGradient(0, 180, 0, 0);
      g.addColorStop(0, "rgba(160,80,255,0.55)");
      g.addColorStop(1, "rgba(160,80,255,0.05)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1024, 180);
    }
    ctx.font = "600 78px Georgia, 'Times New Roman', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = day ? "rgba(255,255,255,0.5)" : "rgba(190,120,255,0.9)"; // carved letters catch the light by day
    ctx.shadowBlur = day ? 2 : 18;
    ctx.fillStyle = day ? "#4f2a86" : "#f4ecff";
    ctx.fillText("WESTERN", 512, 72);
    ctx.shadowBlur = 8;
    ctx.font = "500 34px Georgia, 'Times New Roman', serif";
    ctx.fillText("U N I V E R S I T Y", 512, 138);
    return texture(sc);
  };
  const signTex: Pair = { night: paintSign(false), day: paintSign(true) };
  const signFace = swapColor(basic({ map: signTex.night, color: new THREE.Color(1.3, 1.3, 1.3) }), new THREE.Color(1.3, 1.3, 1.3), "#ffffff");
  swaps.push({ mat: signFace, tex: signTex });
  const signStone = swapColor(basic({ color: "#2e281f" }), "#2e281f", "#7d6e58");
  const sign = new THREE.Mesh(track(new THREE.BoxGeometry(10, 1.8, 0.9)), [signStone, signStone, signStone, signStone, signFace, signStone]);
  sign.position.set(30, GROUND_Y + 0.9, -110);
  group.add(sign);

  // ---------- lamp posts ----------

  const poleGeo = track(new THREE.CylinderGeometry(0.07, 0.1, 4.2, 6));
  const globeGeo = track(new THREE.SphereGeometry(0.32, 12, 10));
  const poles = new THREE.InstancedMesh(poleGeo, darkMat, lamps.length);
  const globes = new THREE.InstancedMesh(globeGeo, swapColor(basic({ color: new THREE.Color(3.2, 2.3, 1.3) }), new THREE.Color(3.2, 2.3, 1.3), "#bdb8ae"), lamps.length);
  const o = new THREE.Object3D();
  lamps.forEach((l, i) => {
    o.position.set(l.x, GROUND_Y + 2.1, l.y);
    o.updateMatrix();
    poles.setMatrixAt(i, o.matrix);
    o.position.y = GROUND_Y + 4.35;
    o.updateMatrix();
    globes.setMatrixAt(i, o.matrix);
  });
  group.add(poles, globes);

  // ---------- trees ----------

  const trees: { x: number; z: number; h: number; r: number }[] = [];
  const blocked = (x: number, z: number) =>
    (Math.abs(x - 30) < 9 && z > -150 && z < -100) || // the lawn in front of the tower and sign
    (z < -142 && z > -160 && x > 0 && x < 62) || // UC footprint
    (z < -176 && z > -194 && x > 52 && x < 88) ||
    (z < -184 && z > -216 && x > -38 && x < 22);
  let guard = 0;
  const sightClear = 7;
  while (trees.length < 90 && guard++ < 4000) {
    const x = rr(-60, 120);
    const z = rr(-260, -95);
    if (blocked(x, z)) continue;
    if (lamps.some((l) => Math.hypot(l.x - x, l.y - z) < 3)) continue;
    if (Math.abs(z + 116) < 3 || Math.abs(z + 170) < 3) continue; // paths
    // keep the sightline from the window to the tower and the sign clear
    const along = (z + 3) / (-150 + 3);
    if (along > 0 && along < 1 && Math.abs(x - (2 + 28 * along)) < sightClear) continue;
    trees.push({ x, z, h: rr(7, 13), r: rr(2.6, 4.6) });
  }
  const trunkGeo = track(new THREE.CylinderGeometry(0.25, 0.4, 1, 6));
  const crownGeo = track(new THREE.IcosahedronGeometry(1, 1));
  const trunks = new THREE.InstancedMesh(trunkGeo, swapColor(basic({ color: "#0b0907" }), "#0b0907", "#3a2c20"), trees.length);
  const BLOBS = 6;
  const crowns = new THREE.InstancedMesh(crownGeo, basic({ color: "#ffffff" }), trees.length * BLOBS);
  const c = new THREE.Color();
  const crownNight: THREE.Color[] = [];
  const crownDay: THREE.Color[] = [];
  trees.forEach((tr, i) => {
    o.rotation.set(0, 0, 0);
    o.position.set(tr.x, GROUND_Y + tr.h * 0.3, tr.z);
    o.scale.set(1, tr.h * 0.6, 1);
    o.updateMatrix();
    trunks.setMatrixAt(i, o.matrix);
    // trees near a lamp pick up its warm light
    const nearLamp = Math.max(0, ...lamps.map((l) => 1 - Math.hypot(l.x - tr.x, l.y - tr.z) / 14));
    const nearTower = Math.max(0, 1 - Math.hypot(tr.x - 30, tr.z + 147) / 26);
    for (let b = 0; b < BLOBS; b++) {
      o.position.set(tr.x + rr(-1, 1) * tr.r * 0.5, GROUND_Y + tr.h * rr(0.6, 0.9), tr.z + rr(-1, 1) * tr.r * 0.5);
      o.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      o.scale.setScalar(tr.r * rr(0.55, 0.85));
      o.updateMatrix();
      crowns.setMatrixAt(i * BLOBS + b, o.matrix);
      const k = rr(0.8, 1.2);
      c.setRGB(0.025 * k, 0.05 * k, 0.035 * k)
        .add(new THREE.Color(0.16, 0.12, 0.05).multiplyScalar(nearLamp * (b < 3 ? 1 : 0.5)))
        .add(new THREE.Color(0.08, 0.03, 0.14).multiplyScalar(nearTower));
      crowns.setColorAt(i * BLOBS + b, c);
      crownNight.push(c.clone());
      crownDay.push(new THREE.Color(0.1 * k, 0.2 * k, 0.08 * k).multiplyScalar(rr(0.8, 1.25)));
    }
  });
  group.add(trunks, crowns);

  const landmarks: Landmark[] = [
    { name: "University College", detail: "Western's Gothic landmark; its tower glows purple at night", position: new THREE.Vector3(UC.x, GROUND_Y + 22, UC.z + 3) },
    { name: "Middlesex College", detail: "The patina cupola and clock tower", position: new THREE.Vector3(MC.x - 6, GROUND_Y + 22, MC.z + 5) },
    { name: "Weldon Library", detail: "Western's main library, still lit for late study", position: new THREE.Vector3(WL.x, GROUND_Y + 8, WL.z) },
    { name: "The Western sign", detail: "At the foot of the lawn below UC", position: new THREE.Vector3(30, GROUND_Y + 1, -110) },
  ];

  // ---------- rain across campus ----------
  // Tens of thousands of streaks animated entirely in the vertex shader; they fade with distance
  // like the fog, so through the telescope the air between the window and the school reads as wet.
  const DROPS = 30000;
  const RB = { x0: -30, x1: 90, y0: GROUND_Y, y1: GROUND_Y + 42, z0: -215, z1: -12 };
  const rPos = new Float32Array(DROPS * 6);
  const rEnd = new Float32Array(DROPS * 2);
  const rSeed = new Float32Array(DROPS * 2);
  for (let i = 0; i < DROPS; i++) {
    const x = rr(RB.x0, RB.x1);
    const y = rr(RB.y0, RB.y1);
    const z = rr(RB.z0, RB.z1);
    rPos.set([x, y, z, x, y, z], i * 6);
    rEnd.set([0, 1], i * 2);
    const sd = rand();
    rSeed.set([sd, sd], i * 2);
  }
  const rainGeo = track(new THREE.BufferGeometry());
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rPos, 3));
  rainGeo.setAttribute("aEnd", new THREE.BufferAttribute(rEnd, 1));
  rainGeo.setAttribute("aSeed", new THREE.BufferAttribute(rSeed, 1));
  const rainMat = track(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 }, uY0: { value: RB.y0 }, uH: { value: RB.y1 - RB.y0 },
        // rain by default; snow is slower, shorter and drifts side to side
        uSpeed: { value: 1 }, uLen: { value: 1 }, uSway: { value: 0 },
        uColor: { value: new THREE.Color(0.62, 0.7, 0.82) }, uAlpha: { value: 0.32 },
      },
      vertexShader: /* glsl */ `
        attribute float aEnd; attribute float aSeed;
        uniform float uTime; uniform float uY0; uniform float uH; uniform float uSpeed; uniform float uLen; uniform float uSway;
        varying float vFade;
        void main() {
          vec3 p = position;
          float speed = (9.0 + aSeed * 4.0) * uSpeed;
          p.y = uY0 + mod(p.y - uY0 - uTime * speed, uH);
          p.y -= aEnd * (0.45 + aSeed * 0.3) * uLen;
          p.x -= aEnd * 0.09 * uLen; // a little wind
          p.x += sin(uTime * 0.9 + aSeed * 40.0) * uSway;
          p.z += cos(uTime * 0.7 + aSeed * 23.0) * uSway * 0.5;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vFade = (1.0 - smoothstep(25.0, 190.0, -mv.z)) * (0.55 + 0.45 * aEnd);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uAlpha; varying float vFade;
        void main() { gl_FragColor = vec4(uColor, uAlpha * vFade); }`,
    }),
  );
  const campusRain = new THREE.LineSegments(rainGeo, rainMat);
  campusRain.frustumCulled = false;
  group.add(campusRain);

  // the flag ripples a little in the wind
  const flagPos = flagGeo.attributes.position as THREE.BufferAttribute;
  const flagBase = Float32Array.from(flagPos.array as Float32Array);
  const update = (t: number) => {
    for (let i = 0; i < flagPos.count; i++) {
      const x = flagBase[i * 3];
      flagPos.setZ(i, Math.sin(x * 2.2 - t * 5) * 0.12 * (x / 2.6));
    }
    flagPos.needsUpdate = true;
    rainMat.uniforms.uTime.value = t;
  };

  const setConditions = (cond: CampusConditions) => {
    const { day, dusk, weather } = cond;
    const isDay = day > 0.5;
    const snowy = weather === "snow";
    for (const sw of swaps) {
      const tex = isDay ? sw.tex.day : sw.tex.night;
      if (sw.mat.map !== tex) sw.mat.map = tex;
    }
    for (const cs of colorSwaps) cs.mat.color.copy(snowy && cs.snow ? cs.snow : isDay ? cs.day : cs.night);
    const crownsSrc = isDay ? crownDay : crownNight;
    const white = new THREE.Color(0.85, 0.88, 0.92);
    crownsSrc.forEach((col, i) => crowns.setColorAt(i, snowy ? c.copy(col).lerp(white, isDay ? 0.45 : 0.18) : col));
    crowns.instanceColor!.needsUpdate = true;
    snowCover.visible = snowy;
    snowMat.color.setScalar(isDay ? 1 : 0.16);
    drawSky(cond);
    // clear nights: stars and the moon (fading out into dawn and dusk)
    const clearNight = weather === "clear" ? Math.max(0, 1 - day * 1.6 - dusk * 0.8) : 0;
    starMat.opacity = clearNight * 0.9;
    moonMat.opacity = clearNight;
    // precipitation
    campusRain.visible = weather !== "clear";
    const u = rainMat.uniforms;
    if (snowy) {
      u.uSpeed.value = 0.1;
      u.uLen.value = 0.12;
      u.uSway.value = 0.7;
      u.uColor.value.setRGB(0.95, 0.97, 1);
      u.uAlpha.value = isDay ? 0.8 : 0.5;
    } else {
      u.uSpeed.value = 1;
      u.uLen.value = 1;
      u.uSway.value = 0;
      u.uColor.value.setRGB(0.62, 0.7, 0.82);
      u.uAlpha.value = isDay ? 0.22 : 0.32;
    }
    // haze: thick in rain and snow, thin on clear days
    const fogNight = weather === "clear" ? "#070c16" : snowy ? "#0d1119" : "#070b12";
    const fogDay = weather === "clear" ? "#a9c1d8" : snowy ? "#c9ced6" : "#8e97a2";
    const fogColor = new THREE.Color(fogNight).lerp(new THREE.Color(fogDay), day).lerp(new THREE.Color(weather === "clear" ? "#c98a6a" : "#6a5a60"), dusk * 0.6);
    const fogDensity = weather === "clear" ? 0.0022 : snowy ? 0.0068 : 0.0055;
    return { fogColor, fogDensity };
  };

  return { group, sky, landmarks, update, setConditions };
}
