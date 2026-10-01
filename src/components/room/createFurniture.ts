import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { createDecor } from "./createDecor";
import { paintTexture } from "./paintTexture";
import { COLORS, LAYOUT, ROOM, WINDOW } from "./roomLayout";

export { paintTexture };

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

export interface FurnitureHandle {
  group: THREE.Group;
  /** the floor lamp: its bulb position, the meshes that switch it when clicked, and its glow (0 off, 1 full) in a colour */
  lamp: { bulb: THREE.Vector3; parts: THREE.Object3D[]; setGlow: (k: number, color: THREE.Color) => void };
  /** the binoculars on the window sill: where they sit, which way they look, and the meshes that pick them up */
  binoculars: { position: THREE.Vector3; direction: THREE.Vector3; parts: THREE.Object3D[] };
  /** the sunset lamp on the desk: where its lens is, the point on the wall it projects onto, its meshes, and its lens glow (0–1) */
  sunset: { lens: THREE.Vector3; target: THREE.Vector3; parts: THREE.Object3D[]; setGlow: (k: number) => void };
  /** centre and facing of each glowing screen, for area lights */
  screens: { center: THREE.Vector3; normal: THREE.Vector3; w: number; h: number; color: string; strength: number }[];
}

/** `env` gives glass and polished metal something to reflect */
export function createFurniture(env: THREE.Texture | null = null): FurnitureHandle {
  const rnd = seeded(11);
  const between = (a: number, b: number) => a + rnd() * (b - a);
  const group = new THREE.Group();

  const mats = new Map<string, THREE.MeshStandardMaterial>();
  const std = (color: string, roughness = 0.8, metalness = 0) => {
    const key = `${color}|${roughness}|${metalness}`;
    let m = mats.get(key);
    // metal needs something to reflect, or it renders near-black
    if (!m) mats.set(key, (m = new THREE.MeshStandardMaterial({ color, roughness, metalness, envMap: metalness > 0.2 ? env : null, envMapIntensity: 0.7 })));
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

  const decor = createDecor({ env, rand: rnd });

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

    // a red satin pillow, centred on the bed; a little deeper than the sheet so the two read apart
    const pillowMat = new THREE.MeshStandardMaterial({
      roughness: 0.35,
      metalness: 0.05,
      map: paintTexture(256, 256, (c, w, h) => {
        c.fillStyle = COLORS.pillow;
        c.fillRect(0, 0, w, h);
        // soft satin sheen across the middle
        const sheen = c.createLinearGradient(0, 0, w, h);
        sheen.addColorStop(0.3, "rgba(255,255,255,0)");
        sheen.addColorStop(0.5, "rgba(255,190,190,0.18)");
        sheen.addColorStop(0.7, "rgba(255,255,255,0)");
        c.fillStyle = sheen;
        c.fillRect(0, 0, w, h);
      }),
    });
    const pillow = rounded(0.66, 0.12, 0.44, 0.06, pillowMat, cx, frame.h + mattress.h + 0.05, z0 + 0.34);
    pillow.scale.y = 0.9;

    // the throw, laid out neatly: flat over the mattress from just below the pillow, hanging evenly
    // over the open side and the foot, tucked down against the wall, with a folded-back cuff at
    // the window end
    const top = frame.h + mattress.h;
    const mL = cx - mattress.w / 2;
    const mR = cx + mattress.w / 2;
    const foot = cz + mattress.l / 2;
    const start = z0 + 0.62;
    const hang = 0.26;
    const tuck = 0.06;
    /** a cloth sheet laid from z0 to z1 (plus the foot overhang if it reaches the foot), lifted by `lift` */
    const drape = (zFrom: number, zTo: number, lift: number) => {
      const across = tuck + mattress.w + hang;
      const along = zTo - zFrom;
      const geo = new THREE.PlaneGeometry(across, along, 90, Math.max(8, Math.round(along * 60)));
      geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) + across / 2 - tuck; // 0 at the mattress's wall-side edge
        let z = p.getZ(i) + zFrom + along / 2;
        let x = mL + u;
        let y = top + 0.012 + lift + 0.004 * Math.sin(u * 19 + z * 3) + 0.003 * Math.sin(z * 27 - u * 5);
        // round over the edges, then fall straight down
        const r = 0.03;
        if (u < 0) {
          x = mL - 0.008;
          y = top + lift - Math.max(0, -u - r) - r * 0.5;
        } else if (u > mattress.w) {
          const over = u - mattress.w;
          x = mR + 0.012 + Math.min(over, r) * 0.3 + Math.sin(z * 9) * 0.004;
          y = top + lift - Math.max(0, over - r) - Math.min(over, r) * 0.5;
        }
        if (z > foot) {
          const over = z - foot;
          z = foot + 0.012 + Math.min(over, r) * 0.3;
          y = Math.min(y, top + lift) - Math.max(0, over - r) - Math.min(over, r) * 0.5;
        }
        p.setXYZ(i, x, Math.max(frame.h - 0.05, y), z);
      }
      geo.computeVertexNormals();
      return geo;
    };
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
    const throwMat = new THREE.MeshStandardMaterial({ map: blanketTex, roughness: 0.9, side: THREE.DoubleSide });
    for (const [zFrom, zTo, lift] of [
      [start, foot + hang, 0],
      [start, start + 0.26, 0.018],
    ]) {
      const sheet = new THREE.Mesh(drape(zFrom, zTo, lift), throwMat);
      sheet.castShadow = sheet.receiveShadow = true;
      group.add(sheet);
    }
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

    const pf = LAYOUT.perfume.pos;
    decor.perfumeShelf(group, new THREE.Vector3(pf[0], top, pf[2]));

    // LED pillar candle: a soft-edged ivory block with a dipped top, then the everyday clutter
    const cd = LAYOUT.candle.pos;
    rounded(0.075, 0.1, 0.075, 0.012, std("#f1e7d2", 0.85), cd[0], top + 0.05, cd[2]);
    cyl(0.026, 0.03, 0.006, std("#e2d4bb", 0.9), cd[0], top + 0.098, cd[2], group, 20);
    decor.clutter(group, new THREE.Vector3(x + 0.02, top, -1.3));
  }

  // ---------- floor lamp ----------
  let lamp: FurnitureHandle["lamp"];
  {
    const { pos, height, shadeY, shadeR, shadeH, shadeOffset } = LAYOUT.floorLamp;
    const [x, , z] = pos;
    const parts: THREE.Object3D[] = [cyl(0.14, 0.15, 0.025, black, x, 0.0125, z, group, 40), cyl(0.011, 0.011, height, black, x, height / 2, z, group, 12)];
    const sx = x + shadeOffset[0];
    const sz = z + shadeOffset[1];
    parts.push(tube([new THREE.Vector3(x, height - 0.02, z), new THREE.Vector3(x - 0.02, height + 0.05, z + 0.02), new THREE.Vector3(sx, height + 0.04, sz), new THREE.Vector3(sx, shadeY + shadeH / 2, sz)], 0.008, black));
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
    const shadeMat = new THREE.MeshStandardMaterial({ map: linen, emissive: "#ffcf96", emissiveMap: linen, emissiveIntensity: 0.9, side: THREE.DoubleSide, roughness: 0.9 });
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(shadeR, shadeR, shadeH, 48, 1, true), shadeMat);
    place(shade, sx, shadeY, sz, group, false);
    parts.push(shade);
    const rimMat = std("#9a958c", 0.6);
    for (const dy of [-shadeH / 2, shadeH / 2]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(shadeR, 0.004, 6, 48), rimMat);
      rim.rotation.x = Math.PI / 2;
      place(rim, sx, shadeY + dy, sz, group, false);
    }
    // the bright diffuser seen from below
    const discMat = glow("#ffe3bd", 1.6);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(shadeR * 0.96, 40), discMat);
    disc.rotation.x = Math.PI / 2;
    place(disc, sx, shadeY - shadeH / 2 + 0.01, sz, group, false);
    const bulbMat = glow("#fff1d8", 3);
    const bulb = ball(0.03, bulbMat, sx, shadeY, sz, group);
    bulb.castShadow = false;
    parts.push(disc, bulb);
    // glow colours when off; when on they take the bulb's colour, paled toward white the way a lit shade looks
    const DISC_OFF = new THREE.Color("#8a8276").multiplyScalar(0.5);
    const BULB_OFF = new THREE.Color(0.16, 0.13, 0.1);
    const SHADE_OFF = new THREE.Color("#8d8578");
    const SHADE_ON = new THREE.Color("#ffffff");
    const white = new THREE.Color("#ffffff");
    const discOn = new THREE.Color();
    const bulbOn = new THREE.Color();
    lamp = {
      bulb: new THREE.Vector3(sx, shadeY, sz),
      parts,
      setGlow: (k, color) => {
        const c = Math.min(1, Math.max(0, k));
        shadeMat.emissive.copy(color).lerp(white, 0.25);
        shadeMat.emissiveIntensity = 0.9 * k;
        shadeMat.color.copy(SHADE_OFF).lerp(SHADE_ON, c);
        discOn.copy(color).lerp(white, 0.35).multiplyScalar(1.6 * Math.max(1, k));
        bulbOn.copy(color).lerp(white, 0.55).multiplyScalar(3);
        discMat.color.copy(DISC_OFF).lerp(discOn, c);
        bulbMat.color.copy(BULB_OFF).lerp(bulbOn, c);
      },
    };
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
    g.lookAt(chair[0], deskTop, chair[2] + 0.15);
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
  let sunset!: FurnitureHandle["sunset"];
  {
    const facing = -Math.PI / 2;
    // keyboard: an off-white 75% board, white alphas, dusty-blue modifiers and a volume knob
    const kb = LAYOUT.keyboard.pos;
    const kg = anchor(kb[0], deskTop, kb[2], facing);
    const caps = paintTexture(512, 192, (c, w, h) => {
      c.fillStyle = "#e7e5df";
      c.fillRect(0, 0, w, h);
      const size = 27;
      for (let r = 0; r < 6; r++)
        for (let k = 0; k < 15; k++) {
          if (r === 0 && k > 12) continue;
          const mod = k === 0 || k >= 13 || r === 5 || r === 0;
          c.fillStyle = mod ? "#8c9cb8" : "#f1f1ee";
          c.fillRect(12 + k * (size + 3), 10 + r * (size + 2.5), size, size);
          c.fillStyle = "rgba(0,0,0,0.12)";
          c.fillRect(12 + k * (size + 3), 10 + r * (size + 2.5) + size - 3, size, 3);
        }
      c.fillStyle = "#f1f1ee";
      c.fillRect(12 + 4 * 30, 10 + 5 * 29.5, 6 * 30 - 3, size);
    });
    const kbCase = std("#e7e5df", 0.5);
    const kbMats = [kbCase, kbCase, new THREE.MeshStandardMaterial({ map: caps, roughness: 0.6 }), kbCase, kbCase, kbCase];
    const kbMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.035, 0.13), kbMats);
    place(kbMesh, 0, 0.018, 0, kg);
    kbMesh.rotation.x = 0.05;
    cyl(0.009, 0.009, 0.012, std("#9aa3b2", 0.35, 0.6), 0.155, 0.041, -0.048, kg, 20);

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
    block(0.11, 0.002, 0.11, std("#f2f1ee", 0.9), mg[0], deskTop + 0.001, mg[2], group, false).rotation.y = 0.3; // napkin coaster
    cyl(0.04, 0.037, 0.1, mugMat, mg[0], deskTop + 0.052, mg[2], group, 28);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.007, 8, 20), mugMat);
    place(handle, mg[0], deskTop + 0.052, mg[2] + 0.045);
    handle.rotation.y = Math.PI / 2;

    // the white gooseneck lamp: a round base with a clock in its face, a bendy neck and a ring head
    const dl = LAYOUT.deskLamp.pos;
    const lampG = anchor(dl[0], deskTop, dl[2], facing);
    cyl(0.062, 0.066, 0.05, white, 0, 0.025, 0, lampG, 36);
    const face = paintTexture(128, 48, (c, w, h) => {
      c.fillStyle = "#1d2124";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#cfe8ff";
      c.font = "600 34px ui-monospace, monospace";
      c.textAlign = "center";
      c.fillText("3:46", w / 2, 37);
    });
    const faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.019), new THREE.MeshBasicMaterial({ map: face, toneMapped: false }));
    faceMesh.position.set(0, 0.026, 0.0645);
    lampG.add(faceMesh);
    tube([new THREE.Vector3(0, 0.05, -0.02), new THREE.Vector3(0, 0.25, -0.03), new THREE.Vector3(0, 0.38, 0.0), new THREE.Vector3(0, 0.42, 0.04)], 0.008, white, lampG);
    const headRing = place(new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.012, 12, 40), white), 0, 0.46, 0.06, lampG);
    headRing.rotation.x = -0.25;
    const lens = place(new THREE.Mesh(new THREE.CircleGeometry(0.058, 36), std("#e3e6ea", 0.25)), 0, 0.46, 0.061, lampG, false);
    lens.rotation.x = -0.25;

    const sp = LAYOUT.speaker.pos;
    const spk = rounded(0.2, 0.08, 0.07, 0.03, std("#1a1a1a", 0.8), sp[0], deskTop + 0.04, sp[2]);
    spk.rotation.y = facing;
    // the sunset lamp: a black ball head on a short stand, its lens aimed at the wall over the bed
    const ss = LAYOUT.sunsetLamp.pos;
    const sunTarget = new THREE.Vector3(...LAYOUT.sunsetLamp.target);
    const sunParts: THREE.Object3D[] = [cyl(0.03, 0.036, 0.012, std("#141414", 0.5), ss[0], deskTop + 0.006, ss[2], group, 24), cyl(0.008, 0.008, 0.04, std("#141414", 0.5), ss[0], deskTop + 0.03, ss[2], group, 12)];
    const head = new THREE.Group();
    head.position.set(ss[0], deskTop + 0.075, ss[2]);
    group.add(head);
    head.lookAt(sunTarget);
    sunParts.push(ball(0.036, std("#141414", 0.35), 0, 0, 0, head));
    const lensMat = new THREE.MeshStandardMaterial({ color: "#c9ccd1", roughness: 0.2, metalness: 0.6, envMap: env, envMapIntensity: 0.7, emissive: "#ff7a2e", emissiveIntensity: 0 });
    const lensDisc = place(new THREE.Mesh(new THREE.CircleGeometry(0.024, 28), lensMat), 0, 0, 0.0335, head, false);
    const bezel = place(new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.003, 8, 28), std("#b5b9bf", 0.3, 0.8)), 0, 0, 0.033, head, false);
    sunParts.push(lensDisc, bezel);
    head.updateMatrixWorld(true);
    sunset = {
      lens: new THREE.Vector3(0, 0, 0.04).applyMatrix4(head.matrixWorld),
      target: sunTarget,
      parts: sunParts,
      setGlow: (k) => {
        lensMat.emissiveIntensity = 2.2 * k;
      },
    };

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

  // ---------- window sill: plants, plushies and the binoculars ----------
  const binocularParts: THREE.Object3D[] = [];
  let binoculars: FurnitureHandle["binoculars"] = { position: new THREE.Vector3(), direction: new THREE.Vector3(0, 0, -1), parts: binocularParts };
  {
    const y = WINDOW.y0;
    const z = ROOM.back - 0.035;
    for (const item of LAYOUT.sill) {
      const x = item.x;
      const at = new THREE.Vector3(x, y, z);
      if (item.kind === "plant") decor.plant(group, at);
      else if (item.kind === "cow") decor.cow(group, at);
      else if (item.kind === "spiderHam") decor.spiderHam(group, at);
      else if (item.kind === "cat") decor.cryingCat(group, at);
      else if (item.kind === "bird") decor.bird(group, at);
      else if (item.kind === "binoculars") {
        // two black barrels joined by a hinge bridge, eyecups toward the room, looking out of the window
        const body = std("#1b1c1e", 0.55);
        const rubber = std("#0e0e0f", 0.9);
        const lensMat = std("#2a3a5a", 0.05, 0.6);
        const bg = new THREE.Group();
        bg.position.set(x, y + 0.03, z + 0.01);
        bg.rotation.y = 0.05;
        group.add(bg);
        for (const sgn of [-1, 1]) {
          const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.03, 0.12, 20), body);
          barrel.rotation.x = Math.PI / 2;
          place(barrel, sgn * 0.034, 0, 0, bg);
          const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.025, 18), rubber);
          cup.rotation.x = Math.PI / 2;
          place(cup, sgn * 0.034, 0, 0.07, bg);
          const lens = new THREE.Mesh(new THREE.CircleGeometry(0.025, 20), lensMat);
          lens.rotation.y = Math.PI;
          place(lens, sgn * 0.034, 0, -0.0605, bg, false);
          binocularParts.push(barrel, cup);
        }
        const bridge = place(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.09, 12), body), 0, 0.012, 0.01, bg);
        bridge.rotation.z = Math.PI / 2;
        const knob = place(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 14), rubber), 0, 0.02, 0.035, bg);
        knob.rotation.x = Math.PI / 2;
        binocularParts.push(bridge, knob);
        bg.updateMatrixWorld(true);
        binoculars = { position: bg.getWorldPosition(new THREE.Vector3()), direction: new THREE.Vector3(0, 0, -1).transformDirection(bg.matrixWorld), parts: binocularParts };
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

  return { group, lamp, binoculars, sunset, screens };
}
