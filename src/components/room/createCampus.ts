import * as THREE from "three";

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

export interface Campus {
  group: THREE.Group;
  sky: THREE.MeshBasicMaterial;
  landmarks: Landmark[];
  update: (t: number) => void;
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
  }

  function facade(o: FacadeOpts) {
    const s = Math.min(28, 1024 / o.w, 1024 / o.h);
    const { c, ctx } = canvas(o.w * s, o.h * s);
    const W = c.width;
    const H = c.height;
    const m = (v: number) => v * s;
    ctx.fillStyle = o.stone ?? "#3a3328";
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
    if (o.flood) {
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
    if (o.purple) {
      const g = ctx.createLinearGradient(0, H, 0, 0);
      g.addColorStop(0, `rgba(150,70,255,${0.6 * o.purple})`);
      g.addColorStop(0.55, `rgba(110,50,220,${0.35 * o.purple})`);
      g.addColorStop(1, `rgba(60,20,140,${0.12 * o.purple})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = "source-over";

    if (o.bands) {
      // Weldon: heavy horizontal concrete bands over deep lit window strips, broken by fins
      const bandH = 1.6;
      for (let y = 1.2; y < o.h - 1.5; y += 3.4) {
        ctx.fillStyle = "#0b0f14";
        ctx.fillRect(0, H - m(y + bandH), W, m(bandH));
        for (let x = 0.4; x < o.w; x += 2.2) {
          const lit = rand() < (o.lit ?? 0.5);
          ctx.fillStyle = lit ? `rgba(210,232,255,${rr(0.55, 0.95)})` : "rgba(30,40,55,0.9)";
          ctx.fillRect(m(x), H - m(y + bandH - 0.2), m(1.7), m(bandH - 0.4));
        }
      }
      ctx.fillStyle = "rgba(90,86,80,0.85)";
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
        ctx.fillStyle = lit
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
        ctx.strokeStyle = lit ? "rgba(60,40,20,0.7)" : "rgba(0,0,0,0.5)";
        ctx.lineWidth = Math.max(1, m(0.08));
        ctx.beginPath();
        ctx.moveTo(x + m(ww / 2), yTop + m(ww * 0.4));
        ctx.lineTo(x + m(ww / 2), H - m(y0));
        ctx.moveTo(x, H - m(y0 + wh * 0.45));
        ctx.lineTo(x + m(ww), H - m(y0 + wh * 0.45));
        ctx.stroke();
      }
    }

    if (o.door) {
      // pointed-arch entrance glowing warm at the base of the tower
      const dw = 2.6;
      const dh = 4.2;
      const x = W / 2 - m(dw / 2);
      const g = ctx.createLinearGradient(0, H - m(dh), 0, H);
      g.addColorStop(0, "#ffcf8a");
      g.addColorStop(1, "#ffe7c0");
      ctx.fillStyle = "#1c150e";
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

  // ---------- geometry helpers ----------

  const roofMat = basic({ color: "#14171c" });
  const darkMat = basic({ color: "#0a0c10" });
  const stoneLit = basic({ color: "#6e5c48" });
  const stonePurple = basic({ color: new THREE.Color(0.42, 0.26, 0.62) });

  /** A block with painted faces. front faces +z, toward the room. */
  function block(w: number, h: number, d: number, x: number, z: number, front: THREE.Texture, side: THREE.Texture, y0 = GROUND_Y) {
    const tint = new THREE.Color(1.25, 1.25, 1.25); // lets lit windows push past 1.0 and bloom a little
    const frontMat = basic({ map: front, color: tint });
    const sideMat = basic({ map: side, color: tint });
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
  {
    const { ctx } = skyC;
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "#03060c");
    g.addColorStop(0.55, "#0c1422");
    g.addColorStop(0.85, "#1f2231");
    g.addColorStop(1, "#3a2c2c"); // city glow on low cloud
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);
    ctx.filter = "blur(18px)";
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(${Math.floor(rr(50, 80))},${Math.floor(rr(55, 70))},${Math.floor(rr(70, 90))},${rr(0.08, 0.22)})`;
      ctx.beginPath();
      ctx.ellipse(rand() * 1024, rr(140, 460), rr(60, 200), rr(18, 50), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.filter = "none";
  }
  const sky = basic({ map: texture(skyC.c), fog: false, depthWrite: false });
  const skyMesh = new THREE.Mesh(track(new THREE.PlaneGeometry(2600, 900)), sky);
  skyMesh.position.set(40, GROUND_Y + 380, -700);
  skyMesh.renderOrder = -2;
  group.add(skyMesh);

  const skylineC = canvas(2048, 256);
  {
    const { ctx } = skylineC;
    for (let i = 0; i < 160; i++) {
      const bw = rr(14, 60);
      const bh = rr(20, i % 9 === 0 ? 200 : 110);
      const bx = rand() * 2048;
      ctx.fillStyle = "#070a10";
      ctx.fillRect(bx, 256 - bh, bw, bh);
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
  const skyline = new THREE.Mesh(track(new THREE.PlaneGeometry(1500, 190)), basic({ map: texture(skylineC.c), transparent: true, fog: false, depthWrite: false, color: "#9aa3b5" }));
  skyline.position.set(40, GROUND_Y + 95 - 30, -640);
  skyline.renderOrder = -1;
  group.add(skyline);

  // ---------- ground ----------

  const farGround = new THREE.Mesh(track(new THREE.PlaneGeometry(2400, 1400)), basic({ color: "#06090b" }));
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
  const groundC = canvas(GW, GH);
  {
    const { ctx } = groundC;
    const px = (x: number) => ((x - G.x0) / (G.x1 - G.x0)) * GW;
    const pz = (z: number) => ((z - G.z0) / (G.z1 - G.z0)) * GH;
    const pm = GW / (G.x1 - G.x0);
    ctx.fillStyle = "#0a110c";
    ctx.fillRect(0, 0, GW, GH);
    for (let i = 0; i < 90000; i++) {
      ctx.fillStyle = `rgba(${rand() > 0.5 ? "40,70,40" : "0,0,0"},${rr(0.05, 0.2)})`;
      ctx.fillRect(rand() * GW, rand() * GH, 2, 2);
    }
    // wet concrete paths
    ctx.strokeStyle = "#1d1f22";
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
  }
  const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(G.x1 - G.x0, G.z1 - G.z0)), basic({ map: texture(groundC.c) }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((G.x0 + G.x1) / 2, GROUND_Y, (G.z0 + G.z1) / 2);
  group.add(ground);

  // ---------- University College ----------

  const UC = { x: 30, z: -150 };
  const towerH = 36;
  const towerW = 8.5;
  const towerFront = facade({ w: towerW, h: towerH, cols: 2, rows: 5, winW: 1.2, winH: 3.2, bottom: 9, top: 3, arch: true, lit: 0.35, flood: "rgba(255,196,130,0.55)", floodReach: 0.55, purple: 1, door: true, stone: "#3d3427" });
  const towerSide = facade({ w: towerW, h: towerH, cols: 2, rows: 5, winW: 1.2, winH: 3.2, bottom: 9, top: 3, arch: true, lit: 0.25, flood: "rgba(255,196,130,0.4)", floodReach: 0.5, purple: 0.8, stone: "#352d22" });
  block(towerW, towerH, towerW, UC.x, UC.z + 3, towerFront, towerSide);
  const towerTop = GROUND_Y + towerH;
  battlements(towerW, towerW, UC.x, towerTop, UC.z + 3, stonePurple);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pinnacle(UC.x + sx * (towerW / 2 - 0.3), towerTop, UC.z + 3 + sz * (towerW / 2 - 0.3), 6.5, stonePurple);
  // flag on the tower
  const pole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.06, 0.06, 6, 6)), darkMat);
  pole.position.set(UC.x, towerTop + 3, UC.z + 3);
  group.add(pole);
  const flagGeo = track(new THREE.PlaneGeometry(2.6, 1.5, 12, 1));
  flagGeo.translate(1.3, 0, 0);
  const flag = new THREE.Mesh(flagGeo, basic({ color: new THREE.Color(0.5, 0.22, 0.85), side: THREE.DoubleSide }));
  flag.position.set(UC.x, towerTop + 5.2, UC.z + 3);
  flag.rotation.y = -0.3;
  group.add(flag);

  const wingW = 24;
  const wingH = 14;
  const wingFront = facade({ w: wingW, h: wingH, cols: 9, rows: 2, winW: 1.1, winH: 2.6, bottom: 2, top: 2.2, arch: true, lit: 0.45, flood: "rgba(255,190,120,0.5)", floodReach: 0.7, stone: "#3a3226" });
  const wingSide = facade({ w: 13, h: wingH, cols: 4, rows: 2, arch: true, lit: 0.3, flood: "rgba(255,190,120,0.35)", stone: "#30291f" });
  for (const side of [-1, 1]) {
    const wx = UC.x + side * (towerW / 2 + wingW / 2);
    block(wingW, wingH, 13, wx, UC.z, wingFront, wingSide);
    gable(wingW, 5.5, 13, wx, GROUND_Y + wingH, UC.z, true);
    // end pavilions with their gable ends facing the lawn
    const px = UC.x + side * (towerW / 2 + wingW + 4);
    const pav = facade({ w: 8, h: 16, cols: 2, rows: 3, winW: 1.2, winH: 2.4, bottom: 2, top: 3, arch: true, lit: 0.5, flood: "rgba(255,190,120,0.45)", stone: "#3a3226" });
    block(8, 16, 16, px, UC.z + 1, pav, wingSide);
    gable(8, 6, 16, px, GROUND_Y + 16, UC.z + 1, false, basic({ map: pav, color: new THREE.Color(0.7, 0.7, 0.7) }));
    pinnacle(px - 4, GROUND_Y + 16, UC.z + 9, 3.5, stoneLit);
    pinnacle(px + 4, GROUND_Y + 16, UC.z + 9, 3.5, stoneLit);
  }

  // ---------- Middlesex College ----------

  const MC = { x: 70, z: -185 };
  const mcFront = facade({ w: 30, h: 13, cols: 11, rows: 2, winW: 1.1, winH: 2.3, bottom: 2, top: 2, lit: 0.4, flood: "rgba(255,190,120,0.4)", stone: "#3c3a36" });
  const mcSide = facade({ w: 14, h: 13, cols: 5, rows: 2, lit: 0.3, stone: "#33312d" });
  block(30, 13, 14, MC.x, MC.z, mcFront, mcSide);
  gable(30, 4.5, 14, MC.x, GROUND_Y + 13, MC.z, true);
  const mcTowerH = 24;
  const mcTower = facade({ w: 7, h: mcTowerH, cols: 1, rows: 3, winW: 1.3, winH: 2.6, bottom: 3, top: 8, lit: 0.5, flood: "rgba(255,200,140,0.5)", floodReach: 0.6, clock: mcTowerH - 3.2, stone: "#403d38" });
  const mcTowerSide = facade({ w: 7, h: mcTowerH, cols: 1, rows: 3, winW: 1.3, winH: 2.6, bottom: 3, top: 8, lit: 0.3, flood: "rgba(255,200,140,0.35)", clock: mcTowerH - 3.2, stone: "#37342f" });
  block(7, mcTowerH, 7, MC.x - 6, MC.z + 5, mcTower, mcTowerSide);
  const patina = basic({ color: new THREE.Color(0.28, 0.5, 0.44) });
  const drum = new THREE.Mesh(track(new THREE.CylinderGeometry(2.6, 2.9, 4.5, 8)), patina);
  drum.position.set(MC.x - 6, GROUND_Y + mcTowerH + 2.25, MC.z + 5);
  const dome = new THREE.Mesh(track(new THREE.SphereGeometry(2.7, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), patina);
  dome.position.set(MC.x - 6, GROUND_Y + mcTowerH + 4.5, MC.z + 5);
  const lantern = new THREE.Mesh(track(new THREE.CylinderGeometry(0.7, 0.8, 2.2, 8)), basic({ color: new THREE.Color(1.6, 1.25, 0.8) }));
  lantern.position.set(MC.x - 6, GROUND_Y + mcTowerH + 7.9, MC.z + 5);
  const spire = new THREE.Mesh(track(new THREE.ConeGeometry(0.8, 3.2, 8)), patina);
  spire.position.set(MC.x - 6, GROUND_Y + mcTowerH + 10.6, MC.z + 5);
  group.add(drum, dome, lantern, spire);

  // ---------- Weldon Library ----------

  const WL = { x: -8, z: -200 };
  const wlFront = facade({ w: 56, h: 15, bands: true, lit: 0.6, flood: "rgba(200,220,255,0.18)", floodReach: 0.4, stone: "#2e2d2b" });
  const wlSide = facade({ w: 30, h: 15, bands: true, lit: 0.5, stone: "#292826" });
  block(56, 15, 30, WL.x, WL.z, wlFront, wlSide);
  block(40, 3, 22, WL.x, WL.z, wlSide, wlSide, GROUND_Y + 15);

  // ---------- Western sign ----------

  const signC = canvas(1024, 180);
  {
    const { ctx } = signC;
    ctx.fillStyle = "#4a4033";
    ctx.fillRect(0, 0, 1024, 180);
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = `rgba(${rand() > 0.5 ? "255,240,220" : "0,0,0"},0.08)`;
      ctx.fillRect(rand() * 1024, rand() * 180, 2, 2);
    }
    const g = ctx.createLinearGradient(0, 180, 0, 0);
    g.addColorStop(0, "rgba(160,80,255,0.55)");
    g.addColorStop(1, "rgba(160,80,255,0.05)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 180);
    ctx.font = "600 78px Georgia, 'Times New Roman', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(190,120,255,0.9)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#f4ecff";
    ctx.fillText("WESTERN", 512, 72);
    ctx.shadowBlur = 8;
    ctx.font = "500 34px Georgia, 'Times New Roman', serif";
    ctx.fillText("U N I V E R S I T Y", 512, 138);
  }
  const signTex = texture(signC.c);
  const signFace = basic({ map: signTex, color: new THREE.Color(1.3, 1.3, 1.3) });
  const signStone = basic({ color: "#2e281f" });
  const sign = new THREE.Mesh(track(new THREE.BoxGeometry(10, 1.8, 0.9)), [signStone, signStone, signStone, signStone, signFace, signStone]);
  sign.position.set(30, GROUND_Y + 0.9, -110);
  group.add(sign);

  // ---------- lamp posts ----------

  const poleGeo = track(new THREE.CylinderGeometry(0.07, 0.1, 4.2, 6));
  const globeGeo = track(new THREE.SphereGeometry(0.32, 12, 10));
  const poles = new THREE.InstancedMesh(poleGeo, darkMat, lamps.length);
  const globes = new THREE.InstancedMesh(globeGeo, basic({ color: new THREE.Color(3.2, 2.3, 1.3) }), lamps.length);
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
  const trunks = new THREE.InstancedMesh(trunkGeo, basic({ color: "#0b0907" }), trees.length);
  const BLOBS = 6;
  const crowns = new THREE.InstancedMesh(crownGeo, basic({ color: "#ffffff" }), trees.length * BLOBS);
  const c = new THREE.Color();
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
    }
  });
  group.add(trunks, crowns);

  const landmarks: Landmark[] = [
    { name: "University College", detail: "Western's Gothic landmark, its tower lit purple", position: new THREE.Vector3(UC.x, GROUND_Y + 22, UC.z + 3) },
    { name: "Middlesex College", detail: "The patina cupola and clock tower", position: new THREE.Vector3(MC.x - 6, GROUND_Y + 22, MC.z + 5) },
    { name: "Weldon Library", detail: "Western's main library, still lit for late study", position: new THREE.Vector3(WL.x, GROUND_Y + 8, WL.z) },
    { name: "The Western sign", detail: "At the foot of the lawn below UC", position: new THREE.Vector3(30, GROUND_Y + 1, -110) },
  ];

  // the flag ripples a little in the wind
  const flagPos = flagGeo.attributes.position as THREE.BufferAttribute;
  const flagBase = Float32Array.from(flagPos.array as Float32Array);
  const update = (t: number) => {
    for (let i = 0; i < flagPos.count; i++) {
      const x = flagBase[i * 3];
      flagPos.setZ(i, Math.sin(x * 2.2 - t * 5) * 0.12 * (x / 2.6));
    }
    flagPos.needsUpdate = true;
  };

  return { group, sky, landmarks, update };
}
