import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { COLORS, LAYOUT, ROOM, WINDOW } from "./roomLayout";

/**
 * Furniture and props of the real room, built procedurally from roomLayout.ts.
 * Everything is primitives, bent planes and canvas-painted textures; nothing is downloaded.
 */

function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function paintTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeat?: [number, number],
) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(...repeat);
  }
  return tex;
}

export interface FurnitureHandle {
  group: THREE.Group;
  /** world position of the floor lamp bulb */
  lampBulb: THREE.Vector3;
  /** centre and facing of each glowing screen, for area lights */
  screens: { center: THREE.Vector3; normal: THREE.Vector3; w: number; h: number; color: string; strength: number }[];
}

export function createFurniture(): FurnitureHandle {
  const rnd = seeded(11);
  const between = (a: number, b: number) => a + rnd() * (b - a);
  const group = new THREE.Group();

  const mats = new Map<string, THREE.MeshStandardMaterial>();
  const std = (color: string, roughness = 0.8, metalness = 0) => {
    const key = `${color}|${roughness}|${metalness}`;
    let m = mats.get(key);
    if (!m) mats.set(key, (m = new THREE.MeshStandardMaterial({ color, roughness, metalness })));
    return m;
  };
  const glow = (color: string, intensity = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) });

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const place = (mesh: THREE.Mesh, x: number, y: number, z: number, parent: THREE.Object3D = group, shadows = true) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const block = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D, shadows = true) => {
    const mesh = place(new THREE.Mesh(unitBox, m), x, y, z, parent, shadows);
    mesh.scale.set(w, h, d);
    return mesh;
  };
  const rounded = (w: number, h: number, d: number, r: number, m: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D, shadows = true) =>
    place(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), m), x, y, z, parent, shadows);
  const cyl = (rt: number, rb: number, h: number, m: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D, seg = 24) =>
    place(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m), x, y, z, parent);
  const ball = (r: number, m: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D, s: [number, number, number] = [1, 1, 1]) => {
    const mesh = place(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m), x, y, z, parent);
    mesh.scale.set(...s);
    return mesh;
  };
  const tube = (points: THREE.Vector3[], r: number, m: THREE.Material, parent: THREE.Object3D = group) => {
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, r, 8), m);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  /** a group at a floor position, turned so its local +z faces `yaw` */
  const anchor = (x: number, y: number, z: number, yaw = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    group.add(g);
    return g;
  };

  const steel = std(COLORS.steel, 0.45, 0.6);
  const black = std("#161616", 0.55);
  const white = std("#ecebe8", 0.5);
  const screens: FurnitureHandle["screens"] = [];

  // ---------- bed ----------
  {
    const { pos, mattress, frame, headboard } = LAYOUT.bed;
    const [cx, , cz] = pos;
    const x0 = cx - frame.w / 2;
    const z0 = cz - frame.l / 2;
    for (const [lx, lz] of [[0.03, 0.03], [frame.w - 0.03, 0.03], [0.03, frame.l - 0.03], [frame.w - 0.03, frame.l - 0.03], [frame.w / 2, frame.l - 0.03]])
      block(0.05, frame.h, 0.05, steel, x0 + lx, frame.h / 2, z0 + lz);
    // side and end rails, then the slat deck
    block(0.03, 0.07, frame.l, steel, x0 + 0.015, frame.h - 0.05, cz);
    block(0.03, 0.07, frame.l, steel, x0 + frame.w - 0.015, frame.h - 0.05, cz);
    block(frame.w, 0.07, 0.03, steel, cx, frame.h - 0.05, z0 + frame.l - 0.015);
    block(frame.w - 0.06, 0.015, frame.l - 0.06, black, cx, frame.h - 0.02, cz);

    const sheetTex = paintTexture(512, 512, (c, w, h) => {
      c.fillStyle = COLORS.sheet;
      c.fillRect(0, 0, w, h);
      // satin folds: long soft highlights and creases
      for (let i = 0; i < 26; i++) {
        const y = rnd() * h;
        const g = c.createLinearGradient(0, y - 12, 0, y + 12);
        const lit = rnd() > 0.5;
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(0.5, lit ? "rgba(255,140,140,0.18)" : "rgba(40,0,0,0.22)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g;
        c.save();
        c.translate(w / 2, y);
        c.rotate(between(-0.5, 0.5));
        c.fillRect(-w, -12, w * 2, 24);
        c.restore();
      }
    });
    const sheet = new THREE.MeshStandardMaterial({ map: sheetTex, roughness: 0.55 });
    rounded(mattress.w, mattress.h, mattress.l, 0.05, sheet, cx, frame.h + mattress.h / 2, cz);

    const hbMat = new THREE.MeshStandardMaterial({
      roughness: 0.6,
      map: paintTexture(512, 256, (c, w, h) => {
        c.fillStyle = COLORS.maple;
        c.fillRect(0, 0, w, h);
        for (let i = 0; i < 90; i++) {
          c.strokeStyle = `rgba(${rnd() > 0.5 ? "120,70,30" : "235,190,130"},${between(0.05, 0.18)})`;
          c.lineWidth = between(0.6, 2.2);
          const y = rnd() * h;
          c.beginPath();
          c.moveTo(0, y);
          c.bezierCurveTo(w * 0.3, y + between(-6, 6), w * 0.7, y + between(-6, 6), w, y + between(-4, 4));
          c.stroke();
        }
      }),
    });
    const hbBottom = 0.26;
    block(headboard.w, headboard.h - hbBottom, headboard.t, hbMat, cx + 0.03, (headboard.h + hbBottom) / 2, ROOM.back + headboard.t / 2 + 0.005);
    // brackets that bolt the headboard to the frame
    block(0.04, 0.14, 0.06, steel, x0 + 0.05, frame.h - 0.02, ROOM.back + 0.04);
    block(0.04, 0.14, 0.06, steel, x0 + frame.w - 0.05, frame.h - 0.02, ROOM.back + 0.04);

    const pillowMat = new THREE.MeshStandardMaterial({
      roughness: 0.35,
      metalness: 0.05,
      map: paintTexture(256, 256, (c, w, h) => {
        c.fillStyle = COLORS.pillow;
        c.fillRect(0, 0, w, h);
        c.fillStyle = COLORS.pillowPrint;
        c.beginPath();
        c.moveTo(w * 0.35, 0);
        c.bezierCurveTo(w * 0.55, h * 0.3, w * 0.45, h * 0.7, w * 0.8, h);
        c.lineTo(w, h);
        c.lineTo(w, 0);
        c.fill();
      }),
    });
    const pillow = rounded(0.66, 0.12, 0.44, 0.06, pillowMat, cx + 0.22, frame.h + mattress.h + 0.05, z0 + 0.34);
    pillow.rotation.y = -0.12;
    pillow.scale.y = 0.9;

    // the throw: a lumpy draped plane on the front half, spilling over the right edge and the foot
    const top = frame.h + mattress.h;
    const edgeX = cx + mattress.w / 2;
    const edgeZ = cz + mattress.l / 2;
    const lumps = Array.from({ length: 9 }, () => ({ x: between(-1.15, -0.2), z: between(-0.5, 0.2), r: between(0.12, 0.28), h: between(0.04, 0.13) }));
    const geo = new THREE.PlaneGeometry(1.3, 1.0, 70, 56);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) - 0.5;
      let z = p.getZ(i) - 0.2;
      let y = top + 0.012;
      for (const l of lumps) y += l.h * Math.exp(-((x - l.x) ** 2 + (z - l.z) ** 2) / (l.r * l.r));
      y += 0.012 * Math.sin(x * 23 + z * 9) + 0.008 * Math.sin(z * 31 - x * 7);
      // hang over the side and the foot
      if (x > edgeX) {
        const over = x - edgeX;
        y = Math.max(0.02, Math.min(y, top + 0.01) - over * 1.4);
        x = edgeX + 0.018 + over * 0.12;
      }
      if (z > edgeZ) {
        const over = z - edgeZ;
        y = Math.max(0.02, Math.min(y, top + 0.01) - over * 1.5);
        z = edgeZ + 0.018 + over * 0.1;
      }
      p.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    const blanketTex = paintTexture(1024, 1024, (c, w, h) => {
      c.fillStyle = COLORS.blanket;
      c.fillRect(0, 0, w, h);
      c.strokeStyle = COLORS.blanketStripe;
      for (let i = 0; i < 46; i++) {
        c.lineWidth = between(5, 14);
        const y0 = (i / 46) * h * 1.4 - h * 0.2;
        c.beginPath();
        for (let x = 0; x <= w; x += 16) c.lineTo(x, y0 + x * 0.35 + Math.sin(x * 0.02 + i) * 14);
        c.stroke();
      }
      // pink florals in one corner, as on the real throw
      for (let i = 0; i < 40; i++) {
        c.fillStyle = `rgba(${rnd() > 0.5 ? "240,120,150" : "255,190,200"},0.8)`;
        c.beginPath();
        c.ellipse(between(0, w * 0.35), between(h * 0.55, h), between(8, 26), between(6, 18), rnd() * 3, 0, Math.PI * 2);
        c.fill();
      }
    });
    const blanket = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: blanketTex, roughness: 0.9, side: THREE.DoubleSide }));
    blanket.castShadow = blanket.receiveShadow = true;
    group.add(blanket);
  }

  // ---------- dresser, perfume shelf and clutter ----------
  {
    const { pos, w, d, unitH } = LAYOUT.dresser;
    const [x, , z] = pos;
    const body = std(COLORS.dresser, 0.62);
    const front = std("#d8b283", 0.6);
    const pull = std(COLORS.pull, 0.8);
    for (let u = 0; u < 2; u++) {
      const y0 = u * unitH;
      block(w, unitH - 0.004, d, body, x, y0 + unitH / 2, z);
      block(w - 0.03, unitH - 0.04, 0.012, front, x, y0 + unitH / 2, z + d / 2 + 0.002);
      block(0.11, 0.022, 0.006, pull, x, y0 + unitH - 0.075, z + d / 2 + 0.009, group, false);
    }
    const top = unitH * 2;

    const pf = LAYOUT.perfume;
    for (let s = 0; s < 3; s++) {
      const sh = (pf.h * (3 - s)) / 3;
      block(pf.w, 0.018, pf.d / 3, black, pf.pos[0], top + sh, pf.pos[2] - pf.d / 3 + (s * pf.d) / 3);
      block(0.015, sh, pf.d / 3, black, pf.pos[0] - pf.w / 2 + 0.01, top + sh / 2, pf.pos[2] - pf.d / 3 + (s * pf.d) / 3);
      block(0.015, sh, pf.d / 3, black, pf.pos[0] + pf.w / 2 - 0.01, top + sh / 2, pf.pos[2] - pf.d / 3 + (s * pf.d) / 3);
    }
    const bottleColors = ["#c9a24a", "#2a3560", "#c98a3c", "#1a1a1a", "#e9e4d8", "#6b2a2a", "#b8c4cc", "#3a3a3a"];
    for (let s = 0; s < 3; s++) {
      const baseY = top + (pf.h * (3 - s)) / 3 + 0.009;
      const bz = pf.pos[2] - pf.d / 3 + (s * pf.d) / 3;
      const n = 6 + s;
      for (let i = 0; i < n; i++) {
        const bx = pf.pos[0] - pf.w / 2 + 0.035 + (i / (n - 1)) * (pf.w - 0.07) + between(-0.008, 0.008);
        const color = bottleColors[Math.floor(rnd() * bottleColors.length)];
        const glass = new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 });
        const kind = Math.floor(rnd() * 4);
        const h = between(0.07, 0.12);
        if (kind === 0) rounded(0.045, h, 0.035, 0.006, glass, bx, baseY + h / 2, bz, group, false);
        else if (kind === 1) cyl(0.022, 0.024, h, glass, bx, baseY + h / 2, bz, group, 16).castShadow = false;
        else if (kind === 2) rounded(0.05, h * 0.8, 0.03, 0.012, glass, bx, baseY + (h * 0.8) / 2, bz, group, false);
        else ball(0.03, glass, bx, baseY + 0.032, bz, group, [1, 1.15, 0.8]).castShadow = false;
        const capH = between(0.02, 0.035);
        const cap = rnd() > 0.5 ? std("#c9a24a", 0.3, 0.8) : std("#111111", 0.4);
        const hh = kind === 3 ? 0.07 : kind === 2 ? h * 0.8 : h;
        cyl(0.012, 0.012, capH, cap, bx, baseY + hh + capH / 2, bz, group, 12).castShadow = false;
      }
    }
    // boxed bottles standing at the back of the top step
    for (const [bx, c] of [[-0.12, "#f4f2ec"], [0.14, "#f1ede4"]] as const)
      block(0.07, 0.11, 0.05, std(c, 0.7), pf.pos[0] + bx, top + pf.h + 0.064, pf.pos[2] - pf.d / 3, group, false);

    // LED pillar candle, keys, lanyard, wallet, lighter, watch
    const cd = LAYOUT.candle.pos;
    cyl(0.04, 0.04, 0.1, std("#f1e7d2", 0.8), cd[0], top + 0.05, cd[2]);
    block(0.26, 0.004, 0.03, std("#6a4aa0", 0.8), x + 0.02, top + 0.002, z + 0.13, group, false).rotation.y = 0.25;
    block(0.1, 0.014, 0.08, std("#121212", 0.6), x - 0.02, top + 0.007, z + 0.18, group, false).rotation.y = -0.2;
    block(0.07, 0.014, 0.022, std("#2a9ad8", 0.4), x + 0.16, top + 0.007, z + 0.12, group, false).rotation.y = 0.5;
    const watch = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 24), std("#b8bcc2", 0.25, 0.9));
    watch.rotation.x = -Math.PI / 2;
    place(watch, x + 0.08, top + 0.008, z + 0.02, group, false);
    rounded(0.05, 0.022, 0.045, 0.01, white, x + 0.18, top + 0.011, z - 0.04, group, false);
  }

  // ---------- floor lamp ----------
  let lampBulb: THREE.Vector3;
  {
    const { pos, height, shadeY, shadeR, shadeH, shadeOffset } = LAYOUT.floorLamp;
    const [x, , z] = pos;
    cyl(0.14, 0.15, 0.025, black, x, 0.0125, z, group, 40);
    cyl(0.011, 0.011, height, black, x, height / 2, z, group, 12);
    const sx = x + shadeOffset[0];
    const sz = z + shadeOffset[1];
    tube([new THREE.Vector3(x, height - 0.02, z), new THREE.Vector3(x - 0.02, height + 0.05, z + 0.02), new THREE.Vector3(sx, height + 0.04, sz), new THREE.Vector3(sx, shadeY + shadeH / 2, sz)], 0.008, black);
    const linen = paintTexture(512, 256, (c, w, h) => {
      c.fillStyle = COLORS.shade;
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 700; i++) {
        c.strokeStyle = `rgba(150,130,100,${between(0.04, 0.14)})`;
        c.lineWidth = 1;
        const y = rnd() * h;
        const x0 = rnd() * w;
        c.beginPath();
        c.moveTo(x0, y);
        c.lineTo(x0 + between(10, 60), y + between(-1, 1));
        c.stroke();
      }
    });
    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(shadeR, shadeR, shadeH, 48, 1, true),
      new THREE.MeshStandardMaterial({ map: linen, emissive: "#ffcf96", emissiveMap: linen, emissiveIntensity: 0.9, side: THREE.DoubleSide, roughness: 0.9 }),
    );
    place(shade, sx, shadeY, sz, group, false);
    const rimMat = std("#9a958c", 0.6);
    for (const dy of [-shadeH / 2, shadeH / 2]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(shadeR, 0.004, 6, 48), rimMat);
      rim.rotation.x = Math.PI / 2;
      place(rim, sx, shadeY + dy, sz, group, false);
    }
    // the bright diffuser seen from below
    const disc = new THREE.Mesh(new THREE.CircleGeometry(shadeR * 0.96, 40), glow("#ffe3bd", 1.6));
    disc.rotation.x = Math.PI / 2;
    place(disc, sx, shadeY - shadeH / 2 + 0.01, sz, group, false);
    lampBulb = new THREE.Vector3(sx, shadeY, sz);
    ball(0.03, glow("#fff1d8", 3), sx, shadeY, sz, group).castShadow = false;
  }

  // ---------- desk ----------
  const deskTop = LAYOUT.desk.h;
  {
    const { pos, l, d, h } = LAYOUT.desk;
    const [x, , z] = pos;
    const oak = new THREE.MeshStandardMaterial({
      roughness: 0.55,
      map: paintTexture(512, 1024, (c, w, hh) => {
        c.fillStyle = COLORS.deskTop;
        c.fillRect(0, 0, w, hh);
        for (let i = 0; i < 160; i++) {
          c.strokeStyle = `rgba(${rnd() > 0.5 ? "110,80,50" : "225,200,165"},${between(0.05, 0.15)})`;
          c.lineWidth = between(0.8, 2.5);
          const xx = rnd() * w;
          c.beginPath();
          c.moveTo(xx, 0);
          c.bezierCurveTo(xx + between(-8, 8), hh * 0.3, xx + between(-8, 8), hh * 0.7, xx + between(-6, 6), hh);
          c.stroke();
        }
      }),
    });
    block(d, 0.03, l, oak, x, h - 0.015, z);
    const legH = h - 0.03;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) block(0.04, legH, 0.04, steel, x + dx * (d / 2 - 0.025), legH / 2, z + dz * (l / 2 - 0.025));
    block(0.03, 0.05, l - 0.05, steel, x - d / 2 + 0.025, h - 0.055, z);
    block(0.03, 0.05, l - 0.05, steel, x + d / 2 - 0.025, h - 0.055, z);
    block(d - 0.05, 0.05, 0.03, steel, x, h - 0.055, z - l / 2 + 0.025);
    block(d - 0.05, 0.05, 0.03, steel, x, h - 0.055, z + l / 2 - 0.025);
    // the low rail between the side frames
    block(0.03, 0.03, l - 0.05, steel, x + d / 2 - 0.025, 0.16, z);
    block(d - 0.05, 0.03, 0.03, steel, x, 0.16, z - l / 2 + 0.025);
    block(d - 0.05, 0.03, 0.03, steel, x, 0.16, z + l / 2 - 0.025);

    // desk mat
    block(0.36, 0.003, 0.82, std("#1a1a1c", 0.9), x - 0.1, h + 0.0015, z, group, false);
  }

  // ---------- curved monitor, facing the chair ----------
  {
    const { pos, w, h } = LAYOUT.monitor;
    const g = anchor(pos[0], deskTop, pos[2]);
    const chair = LAYOUT.chair.pos;
    g.lookAt(chair[0] - 0.2, deskTop, chair[2] - 0.15);
    const R = 1.0;
    const bend = (geo: THREE.PlaneGeometry, dz: number) => {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const a = p.getX(i) / R;
        p.setXYZ(i, R * Math.sin(a), p.getY(i), R * (1 - Math.cos(a)) + dz);
      }
      geo.computeVertexNormals();
      return geo;
    };
    const screenY = 0.36;
    const ps5 = paintTexture(1024, 600, (c, cw, ch) => {
      const g2 = c.createLinearGradient(0, 0, cw * 0.4, ch);
      g2.addColorStop(0, "#2a6fd0");
      g2.addColorStop(0.6, "#154a9e");
      g2.addColorStop(1, "#0a2254");
      c.fillStyle = g2;
      c.fillRect(0, 0, cw, ch);
      for (let i = 0; i < 180; i++) {
        c.fillStyle = `rgba(200,230,255,${between(0.05, 0.4)})`;
        c.beginPath();
        c.arc(rnd() * cw, ch * 0.5 + between(0, ch * 0.5), between(1, 5), 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = "#ffffff";
      c.textAlign = "center";
      c.font = "600 40px system-ui, sans-serif";
      c.fillText("Welcome Back to PlayStation", cw / 2, 120);
      c.font = "24px system-ui, sans-serif";
      c.fillStyle = "rgba(255,255,255,0.8)";
      c.fillText("Who's using this controller?", cw / 2, 162);
      // user tiles: an "add user" ring and two plain avatars (not copied from the photo)
      const tile = (x: number, r: number, fill: string) => {
        c.fillStyle = fill;
        c.beginPath();
        c.arc(x, 300, r, 0, Math.PI * 2);
        c.fill();
      };
      tile(cw / 2 - 200, 52, "rgba(255,255,255,0.18)");
      c.fillStyle = "#fff";
      c.font = "300 60px system-ui, sans-serif";
      c.fillText("+", cw / 2 - 200, 320);
      tile(cw / 2, 78, "#e8eef8");
      tile(cw / 2, 70, "#5b6f8c");
      tile(cw / 2 + 200, 52, "#c43b3b");
      c.fillStyle = "rgba(255,255,255,0.85)";
      c.font = "20px system-ui, sans-serif";
      c.fillText("Add User", cw / 2 - 200, 390);
      c.beginPath();
      c.arc(cw / 2, ch - 60, 14, 0, Math.PI * 2);
      c.strokeStyle = "rgba(255,255,255,0.7)";
      c.lineWidth = 2;
      c.stroke();
    });
    const screen = new THREE.Mesh(bend(new THREE.PlaneGeometry(w, h, 32, 1), 0), new THREE.MeshBasicMaterial({ map: ps5, toneMapped: false }));
    screen.position.y = screenY;
    g.add(screen);
    const shell = new THREE.Mesh(bend(new THREE.PlaneGeometry(w + 0.02, h + 0.02, 32, 1), -0.004), new THREE.MeshStandardMaterial({ color: "#141416", roughness: 0.5, side: THREE.DoubleSide }));
    shell.position.y = screenY;
    shell.castShadow = true;
    g.add(shell);
    rounded(0.3, 0.2, 0.05, 0.02, std("#141416", 0.5), 0, screenY, -0.03, g);
    // white V stand with a neck
    const standMat = std("#e8e8ea", 0.35, 0.3);
    block(0.04, 0.3, 0.02, standMat, 0, 0.17, -0.07, g).rotation.x = -0.12;
    for (const s of [-1, 1]) {
      const leg = block(0.03, 0.012, 0.3, standMat, s * 0.1, 0.006, 0.02, g);
      leg.rotation.y = s * 0.55;
    }
    // blue LED under the stand
    const led = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color("#2a44ff").multiplyScalar(1.4), transparent: true, opacity: 0.55, toneMapped: false }));
    led.rotation.x = -Math.PI / 2;
    led.position.set(0, 0.002, 0.0);
    g.add(led);

    g.updateMatrixWorld(true);
    const center = new THREE.Vector3(0, screenY, 0.03).applyMatrix4(g.matrixWorld);
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(g.matrixWorld);
    screens.push({ center, normal, w, h, color: "#4a8ef0", strength: 5 });
  }

  // ---------- laptop on its stand ----------
  {
    const [x, , z] = LAYOUT.laptop.pos;
    const g = anchor(x, deskTop, z, -Math.PI / 2 + 0.15);
    const alu = std("#c9cacc", 0.35, 0.7);
    // stand: two raked rails
    for (const s of [-1, 1]) block(0.02, 0.012, 0.26, alu, s * 0.13, 0.05, 0, g).rotation.x = 0.28;
    const tilt = new THREE.Group();
    tilt.position.set(0, 0.06, 0);
    tilt.rotation.x = 0.28;
    g.add(tilt);
    const keysTex = paintTexture(512, 256, (c, w, h) => {
      c.fillStyle = "#b9babd";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#1c1c1e";
      for (let r = 0; r < 6; r++) for (let k = 0; k < 14; k++) c.fillRect(40 + k * 31, 20 + r * 24, 26, 19);
      c.fillStyle = "#a8a9ad";
      c.fillRect(170, 175, 170, 70);
    });
    const deck = rounded(0.33, 0.012, 0.23, 0.006, new THREE.MeshStandardMaterial({ map: keysTex, roughness: 0.4, metalness: 0.4 }), 0, 0, 0, tilt);
    deck.rotation.y = Math.PI;
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.006, -0.115);
    hinge.rotation.x = -0.35;
    tilt.add(hinge);
    rounded(0.33, 0.22, 0.008, 0.006, alu, 0, 0.11, -0.004, hinge);
    const page = paintTexture(512, 340, (c, w, h) => {
      c.fillStyle = "#1b1c20";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#2a2c33";
      c.fillRect(0, 0, w, 30);
      c.fillStyle = "#3a3d46";
      c.fillRect(60, 8, w - 120, 14);
      c.fillStyle = "rgba(230,230,235,0.75)";
      c.fillRect(150, 110, 220, 10);
      for (let i = 0; i < 6; i++) c.fillRect(150, 140 + i * 16, between(120, 220), 5);
    });
    const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.19), new THREE.MeshBasicMaterial({ map: page, toneMapped: false }));
    lcd.position.set(0, 0.112, 0.001);
    hinge.add(lcd);
    g.updateMatrixWorld(true);
    screens.push({
      center: new THREE.Vector3(0, 0.112, 0.02).applyMatrix4(hinge.matrixWorld),
      normal: new THREE.Vector3(0, 0, 1).transformDirection(hinge.matrixWorld),
      w: 0.3,
      h: 0.19,
      color: "#cfe0ff",
      strength: 1.5,
    });
  }

  // ---------- desk props ----------
  {
    const facing = -Math.PI / 2;
    // keyboard: grey-white caps with slate-blue modifiers
    const kb = LAYOUT.keyboard.pos;
    const kg = anchor(kb[0], deskTop, kb[2], facing);
    const caps = paintTexture(512, 192, (c, w, h) => {
      c.fillStyle = "#dcdde1";
      c.fillRect(0, 0, w, h);
      const size = 30;
      for (let r = 0; r < 5; r++)
        for (let k = 0; k < 15; k++) {
          const mod = k === 0 || k >= 13 || r === 4;
          c.fillStyle = mod ? "#4d5a78" : "#c9ccd3";
          c.fillRect(14 + k * (size + 2.4), 18 + r * (size + 3), size, size);
        }
      c.fillStyle = "#c9ccd3";
      c.fillRect(14 + 4 * 32.4, 18 + 4 * 33, 6 * 32, 30);
    });
    const kbMats = [white, white, new THREE.MeshStandardMaterial({ map: caps, roughness: 0.6 }), white, white, white];
    const kbMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.035, 0.13), kbMats);
    place(kbMesh, 0, 0.018, 0, kg);
    kbMesh.rotation.x = 0.05;

    const ms = LAYOUT.mouse.pos;
    ball(0.035, std("#101012", 0.4), ms[0], deskTop + 0.012, ms[2], group, [0.9, 0.45, 1.5]);

    // DualSense: a white body with two grips and a black touch-pad band
    const ct = LAYOUT.controller.pos;
    const cg = anchor(ct[0], deskTop, ct[2], facing + 0.3);
    const dsWhite = std("#f2f2f2", 0.45);
    rounded(0.12, 0.035, 0.07, 0.015, dsWhite, 0, 0.022, 0, cg);
    for (const s of [-1, 1]) {
      const grip = ball(0.028, dsWhite, s * 0.06, 0.02, 0.03, cg, [1, 0.7, 1.6]);
      grip.rotation.y = s * 0.3;
    }
    block(0.06, 0.004, 0.045, std("#1a1a1a", 0.5), 0, 0.04, -0.005, cg, false);

    const mg = LAYOUT.mug.pos;
    const mugMat = std("#161616", 0.35);
    cyl(0.04, 0.037, 0.1, mugMat, mg[0], deskTop + 0.05, mg[2], group, 28);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.007, 8, 20), mugMat);
    place(handle, mg[0], deskTop + 0.05, mg[2] + 0.045);
    handle.rotation.y = Math.PI / 2;

    // alarm clock showing the time from the photo
    const cl = LAYOUT.clock.pos;
    const clockG = anchor(cl[0], deskTop, cl[2], facing);
    rounded(0.1, 0.055, 0.045, 0.012, white, 0, 0.028, 0, clockG);
    const face = paintTexture(128, 64, (c, w, h) => {
      c.fillStyle = "#23272b";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#cfe8ff";
      c.font = "600 34px ui-monospace, monospace";
      c.textAlign = "center";
      c.fillText("3:46", w / 2, 44);
    });
    const faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.035), new THREE.MeshBasicMaterial({ map: face, toneMapped: false }));
    faceMesh.position.set(0, 0.03, 0.0231);
    clockG.add(faceMesh);

    // gooseneck lamp (off)
    const dl = LAYOUT.deskLamp.pos;
    cyl(0.05, 0.055, 0.02, white, dl[0], deskTop + 0.01, dl[2]);
    tube([new THREE.Vector3(dl[0], deskTop + 0.02, dl[2]), new THREE.Vector3(dl[0], deskTop + 0.25, dl[2] + 0.02), new THREE.Vector3(dl[0] - 0.03, deskTop + 0.38, dl[2] + 0.05)], 0.008, white);
    const headMesh = place(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 10, 32), white), dl[0] - 0.05, deskTop + 0.42, dl[2] + 0.06);
    headMesh.rotation.y = -Math.PI / 2 + 0.4;
    const lens = place(new THREE.Mesh(new THREE.CircleGeometry(0.06, 32), std("#dfe3e8", 0.2)), dl[0] - 0.052, deskTop + 0.42, dl[2] + 0.06, group, false);
    lens.rotation.y = -Math.PI / 2 + 0.4;

    // ring light on a clamp arm (off)
    const rl = LAYOUT.ringLight.pos;
    block(0.04, 0.06, 0.05, black, rl[0], deskTop - 0.01, rl[2]);
    tube([new THREE.Vector3(rl[0], deskTop + 0.02, rl[2]), new THREE.Vector3(rl[0] - 0.02, deskTop + 0.35, rl[2] + 0.02), new THREE.Vector3(rl[0] - 0.06, deskTop + 0.62, rl[2] + 0.05), new THREE.Vector3(rl[0] - 0.1, deskTop + 0.72, rl[2] + 0.08)], 0.01, black);
    const ring = place(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.014, 10, 48), black), rl[0] - 0.12, deskTop + 0.73, rl[2] + 0.1);
    ring.rotation.x = Math.PI / 2 - 0.1;

    const sp = LAYOUT.speaker.pos;
    const spk = rounded(0.2, 0.08, 0.07, 0.03, std("#1a1a1a", 0.8), sp[0], deskTop + 0.04, sp[2]);
    spk.rotation.y = facing;
    const ss = LAYOUT.smallSpeaker.pos;
    ball(0.035, std("#141414", 0.5), ss[0], deskTop + 0.05, ss[2]);
    cyl(0.02, 0.028, 0.02, std("#141414", 0.5), ss[0], deskTop + 0.01, ss[2]);

    // PC tower under the front end of the desk, blue light at its front edge
    const pc = LAYOUT.pcTower.pos;
    block(0.2, 0.45, 0.42, std("#121214", 0.5), pc[0], 0.235, pc[2]);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.4), new THREE.MeshBasicMaterial({ color: new THREE.Color("#3050ff").multiplyScalar(2), toneMapped: false }));
    strip.position.set(pc[0] - 0.085, 0.235, pc[2] + 0.211);
    group.add(strip);
    for (const fx of [0, 0.02]) cyl(0.012, 0.012, 0.012, std("#3a3a3a"), pc[0] + fx - 0.05, 0.006, pc[2] + 0.18);
  }

  // ---------- chair ----------
  {
    const { pos, yaw } = LAYOUT.chair;
    const g = anchor(pos[0], 0, pos[2], yaw);
    const frame = std("#8a8a8e", 0.4, 0.6);
    const mesh = std("#1a1a1c", 0.85);
    for (const a of [Math.PI / 4, -Math.PI / 4]) {
      const leg = block(0.62, 0.025, 0.03, frame, 0, 0.07, 0, g);
      leg.rotation.y = a;
      for (const s of [-1, 1]) ball(0.025, std("#202022", 0.5), s * 0.3 * Math.cos(a), 0.025, -s * 0.3 * Math.sin(a), g);
    }
    cyl(0.018, 0.022, 0.36, frame, 0, 0.26, 0, g, 12);
    rounded(0.46, 0.06, 0.44, 0.03, mesh, 0, 0.47, 0.02, g);
    const back = rounded(0.44, 0.44, 0.03, 0.03, mesh, 0, 0.8, -0.21, g);
    back.rotation.x = -0.12;
    for (const s of [-1, 1]) block(0.02, 0.36, 0.02, frame, s * 0.2, 0.66, -0.2, g).rotation.x = -0.12;
  }

  // ---------- tapestry: "IF YOURE READING THIS ITS TOO LATE" ----------
  {
    const { pos, w, h } = LAYOUT.tapestry;
    const tex = paintTexture(1024, 944, (c, cw, ch) => {
      c.fillStyle = COLORS.tapestry;
      c.fillRect(0, 0, cw, ch);
      c.strokeStyle = COLORS.chalk;
      c.fillStyle = COLORS.chalk;
      c.lineCap = "round";
      c.lineJoin = "round";
      const lines = ["IF  YOURE", "READING", "THIS  ITS", "TOO  LATE"];
      c.font = "400 150px 'Chalkboard SE', 'Comic Sans MS', 'Segoe Print', sans-serif";
      c.textBaseline = "middle";
      lines.forEach((line, i) => {
        let x = 110 + i * 16;
        const y = 170 + i * 175;
        for (const ch2 of line) {
          c.save();
          c.translate(x, y + between(-6, 6));
          c.rotate(between(-0.08, 0.08));
          // a dry-brush look: the letter, then a faint offset stroke over it
          c.globalAlpha = 0.92;
          c.fillText(ch2, 0, 0);
          c.lineWidth = 2;
          c.globalAlpha = 0.35;
          c.strokeText(ch2, between(-4, 4), between(-4, 4));
          c.restore();
          x += ch2 === " " ? 38 : c.measureText(ch2).width * 0.98;
        }
      });
      // small praying hands near the bottom
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(cw * 0.42, ch * 0.93);
      c.quadraticCurveTo(cw * 0.43, ch * 0.84, cw * 0.44, ch * 0.83);
      c.quadraticCurveTo(cw * 0.45, ch * 0.84, cw * 0.46, ch * 0.93);
      c.moveTo(cw * 0.44, ch * 0.84);
      c.lineTo(cw * 0.44, ch * 0.93);
      c.stroke();
    });
    const geo = new THREE.PlaneGeometry(w, h, 30, 20);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, 0.006 * Math.sin(p.getX(i) * 14) * (0.4 + (h / 2 - p.getY(i)) / h));
    geo.computeVertexNormals();
    const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    cloth.rotation.y = -Math.PI / 2;
    place(cloth, pos[0] - 0.01, pos[1], pos[2], group, false);
  }

  // ---------- rugs ----------
  {
    const flat = (tex: THREE.Texture, w: number, l: number, x: number, z: number, yaw: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 1 }));
      m.rotation.set(-Math.PI / 2, 0, yaw);
      m.position.set(x, 0.004, z);
      m.receiveShadow = true;
      group.add(m);
    };
    const web = paintTexture(512, 512, (c, w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      const spokes = 10;
      const edge = (k: number) => (k % 2 ? 0.95 : 0.8) * (w / 2);
      c.fillStyle = "#1e1e22";
      c.beginPath();
      for (let k = 0; k <= spokes; k++) {
        const a = (k / spokes) * Math.PI * 2;
        const r = edge(k);
        if (k === 0) c.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        else {
          const am = ((k - 0.5) / spokes) * Math.PI * 2;
          c.quadraticCurveTo(cx + Math.cos(am) * r * 0.78, cy + Math.sin(am) * r * 0.78, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
      }
      c.fill();
      c.strokeStyle = "#e6e6e6";
      c.lineWidth = 7;
      for (let k = 0; k < spokes; k++) {
        const a = (k / spokes) * Math.PI * 2;
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(cx + Math.cos(a) * edge(k) * 0.96, cy + Math.sin(a) * edge(k) * 0.96);
        c.stroke();
      }
      for (let ringR = 45; ringR < w * 0.4; ringR += 42) {
        c.beginPath();
        for (let k = 0; k <= spokes; k++) {
          const a = (k / spokes) * Math.PI * 2;
          const am = ((k - 0.5) / spokes) * Math.PI * 2;
          const px = cx + Math.cos(a) * ringR;
          const py = cy + Math.sin(a) * ringR;
          if (k === 0) c.moveTo(px, py);
          else c.quadraticCurveTo(cx + Math.cos(am) * ringR * 0.8, cy + Math.sin(am) * ringR * 0.8, px, py);
        }
        c.stroke();
      }
    });
    const wr = LAYOUT.webRug;
    flat(web, wr.r * 2, wr.r * 2, wr.pos[0], wr.pos[2], 0.3);

    // a cartoon character lying on its back: cream body, orange hands, olive hat, maroon shoes
    const toon = paintTexture(512, 320, (c, w, h) => {
      const blob = (x: number, y: number, rx: number, ry: number, color: string, rot = 0) => {
        c.fillStyle = color;
        c.beginPath();
        c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
        c.fill();
      };
      c.lineWidth = 8;
      c.strokeStyle = "#2a1c1c";
      blob(90, 170, 70, 55, "#6e7a3c");
      blob(250, 160, 120, 80, "#f3e2cf");
      blob(160, 210, 28, 18, "#f28a45", 0.4);
      blob(330, 90, 32, 20, "#f28a45", -0.5);
      blob(420, 230, 55, 32, "#6a2a30", 0.3);
      blob(440, 120, 50, 30, "#6a2a30", -0.3);
      c.fillStyle = "#2a1c1c";
      blob(215, 140, 7, 9, "#2a1c1c");
      blob(255, 135, 7, 9, "#2a1c1c");
      c.beginPath();
      c.arc(235, 175, 18, 0.1, Math.PI - 0.1);
      c.stroke();
    });
    const cr = LAYOUT.cartoonRug;
    flat(toon, cr.w, cr.l, cr.pos[0], cr.pos[2], -0.4);
  }

  // ---------- window sill: plants and plushies ----------
  {
    const y = WINDOW.y0 + 0.015;
    const z = ROOM.back - 0.035;
    const leaf = std("#3f6b32", 0.7);
    const leafGeo = new THREE.IcosahedronGeometry(0.02, 0);
    for (const item of LAYOUT.sill) {
      const x = item.x;
      if (item.kind === "plant") {
        cyl(0.035, 0.028, 0.055, std("#161616", 0.6), x, y + 0.028, z, group, 18);
        for (let i = 0; i < 16; i++) {
          const m = place(new THREE.Mesh(leafGeo, leaf), x + between(-0.05, 0.05), y + between(0.07, 0.14), z + between(-0.03, 0.03), group, false);
          m.scale.set(1.4, 0.5, 0.9);
          m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
        }
      } else if (item.kind === "cow") {
        const cow = std("#f4f4f0", 0.9);
        rounded(0.08, 0.07, 0.05, 0.02, cow, x, y + 0.035, z, group, false);
        ball(0.03, cow, x, y + 0.095, z, group);
        ball(0.012, std("#161616"), x + 0.02, y + 0.06, z + 0.024, group);
        ball(0.01, std("#161616"), x - 0.025, y + 0.03, z + 0.024, group);
      } else if (item.kind === "spiderHam") {
        const red = std("#c4151c", 0.85);
        ball(0.045, red, x, y + 0.045, z, group, [1, 0.9, 0.8]);
        ball(0.05, red, x, y + 0.12, z, group, [1.1, 0.95, 0.85]);
        for (const s of [-1, 1]) ball(0.016, std("#f4f4f4", 0.6), x + s * 0.02, y + 0.13, z + 0.04, group, [1, 1.3, 0.4]);
        ball(0.012, std("#e98aa0", 0.8), x, y + 0.105, z + 0.045, group);
      } else if (item.kind === "cat") {
        const catFace = paintTexture(128, 160, (c, w, h) => {
          c.fillStyle = "#e0b9a0";
          c.fillRect(0, 0, w, h);
          c.fillStyle = "#c98a5e";
          c.fillRect(0, 0, w, 30);
          c.fillStyle = "#20140e";
          for (const ex of [40, 88]) {
            c.beginPath();
            c.ellipse(ex, 70, 14, 17, 0, 0, Math.PI * 2);
            c.fill();
          }
          c.fillStyle = "#ffffff";
          for (const ex of [36, 84]) c.fillRect(ex, 62, 5, 5);
          c.fillStyle = "#d38f86";
          c.fillRect(58, 96, 12, 7);
        });
        const catMats = Array.from({ length: 6 }, (_, i) => (i === 4 ? new THREE.MeshStandardMaterial({ map: catFace, roughness: 0.9 }) : std("#e0b9a0", 0.9)));
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.05), catMats);
        place(body, x, y + 0.06, z, group);
        for (const s of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.035, 4), std("#c98a5e", 0.9));
          place(ear, x + s * 0.03, y + 0.135, z, group, false);
        }
      } else if (item.kind === "bird") {
        ball(0.035, std("#3a6fb8", 0.85), x, y + 0.03, z, group, [1, 0.85, 0.9]);
        ball(0.022, std("#eef2f6", 0.9), x, y + 0.025, z + 0.018, group, [1, 0.8, 0.6]);
      } else {
        rounded(0.05, 0.014, 0.025, 0.006, white, x, y + 0.007, z, group, false);
      }
    }
  }

  // ---------- small fixtures: outlets, the light switch ----------
  {
    for (const o of LAYOUT.outlets) {
      const m = block(0.07, 0.115, 0.01, white, o.pos[0], o.pos[1], o.pos[2], group, false);
      if (o.facing === "back") m.position.z += 0.005;
      if (o.facing === "left") {
        m.rotation.y = Math.PI / 2;
        m.position.x += 0.005;
      }
      if (o.facing === "right") {
        m.rotation.y = Math.PI / 2;
        m.position.x -= 0.005;
      }
    }
    const sw = LAYOUT.lightSwitch.pos;
    block(0.01, 0.12, 0.075, white, sw[0] + 0.005, sw[1], sw[2], group, false);
  }

  return { group, lampBulb, screens };
}
