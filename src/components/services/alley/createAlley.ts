import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";

/*
 * A narrow city alley at night, built from primitives and canvas textures.
 * One sodium lamp high on the right wall shines down through a fire escape, so its grating
 * and rails throw hard diagonal shadows across the wet ground and the left wall. A lit window
 * with blinds on the left wall stripes the right wall. The far end glows cold through haze.
 *
 * Alley coordinates (metres): x ∈ [-2.3, 2.3], y ∈ [0, 14], z from 8 (behind camera) to -60.
 * Scrolling the page walks the camera slowly down the alley.
 */

export interface AlleyHandle {
  /** 0 at the top of the page, 1 at the bottom */
  setProgress: (p: number) => void;
  /** pointer position in [-1, 1] on both axes */
  setPointer: (x: number, y: number) => void;
  dispose: () => void;
}

const W = 2.3; // half width
const H = 14;
const NEAR_Z = 8;
const FAR_Z = -60;

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** brick colour + bump canvases: one tile is 2.4m wide and 1.2m tall */
function brickTextures(seed: number) {
  const r = rng(seed);
  const cw = 1024;
  const ch = 512;
  const color = document.createElement("canvas");
  const bump = document.createElement("canvas");
  color.width = bump.width = cw;
  color.height = bump.height = ch;
  const c = color.getContext("2d")!;
  const b = bump.getContext("2d")!;
  c.fillStyle = "#161311";
  c.fillRect(0, 0, cw, ch);
  b.fillStyle = "#000";
  b.fillRect(0, 0, cw, ch);
  const rows = 14;
  const cols = 8;
  const rh = ch / rows;
  const bw = cw / cols;
  const m = 3.5;
  for (let y = 0; y < rows; y++) {
    const off = y % 2 ? bw / 2 : 0;
    for (let x = -1; x <= cols; x++) {
      const px = x * bw + off;
      const hue = 6 + r() * 16;
      const sat = 18 + r() * 30;
      const lit = 13 + r() * 15 + (r() < 0.1 ? -7 : 0) + (r() < 0.05 ? 8 : 0);
      c.fillStyle = `hsl(${hue} ${sat}% ${lit}%)`;
      c.fillRect(px + m, y * rh + m, bw - m * 2, rh - m * 2);
      // each brick a little uneven: a darker edge and a worn face
      const gg = c.createLinearGradient(px, y * rh, px + bw * (0.4 + r()), y * rh + rh);
      gg.addColorStop(0, `rgba(0,0,0,${r() * 0.35})`);
      gg.addColorStop(1, `rgba(255,230,200,${r() * 0.06})`);
      c.fillStyle = gg;
      c.fillRect(px + m, y * rh + m, bw - m * 2, rh - m * 2);
      const g = 150 + r() * 80;
      b.fillStyle = `rgb(${g},${g},${g})`;
      b.fillRect(px + m, y * rh + m, bw - m * 2, rh - m * 2);
    }
  }
  // pitting and speckle on both maps
  for (let i = 0; i < 26000; i++) {
    const x = r() * cw;
    const y = r() * ch;
    const s = r() * 1.6;
    const d = r() < 0.5;
    c.fillStyle = d ? `rgba(0,0,0,${0.12 + r() * 0.25})` : `rgba(255,220,190,${r() * 0.06})`;
    c.fillRect(x, y, s, s);
    b.fillStyle = d ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.1)";
    b.fillRect(x, y, s, s);
  }
  const mk = (cv: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: mk(color, true), bump: mk(bump, false) };
}

/** grime that darkens the walls toward the ground and runs down in streaks */
function grimeTexture(seed: number) {
  const r = rng(seed);
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 512;
  const c = cv.getContext("2d")!;
  c.fillStyle = "#fff";
  c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    const x = r() * 512;
    const w = 2 + r() * 14;
    const top = r() * 300;
    const g = c.createLinearGradient(0, top, 0, 512);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.4, `rgba(0,0,0,${0.08 + r() * 0.2})`);
    g.addColorStop(1, `rgba(0,0,0,${0.1 + r() * 0.15})`);
    c.fillStyle = g;
    c.fillRect(x, top, w, 512 - top);
  }
  const g = c.createLinearGradient(0, 512, 0, 380);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g;
  c.fillRect(0, 380, 512, 132);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** asphalt: colour, roughness (puddles are smooth) and an alpha mask that opens the puddles to the reflector beneath */
function groundTextures(seed: number) {
  const r = rng(seed);
  const n = 1024;
  const mkCanvas = () => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = n;
    return cv;
  };
  const colorCv = mkCanvas();
  const roughCv = mkCanvas();
  const alphaCv = mkCanvas();
  const c = colorCv.getContext("2d")!;
  const ro = roughCv.getContext("2d")!;
  const a = alphaCv.getContext("2d")!;
  c.fillStyle = "#0b0b0b";
  c.fillRect(0, 0, n, n);
  for (let i = 0; i < 60000; i++) {
    const v = 6 + r() * 22;
    c.fillStyle = `rgb(${v},${v},${v - 2})`;
    const s = 0.8 + r() * 2.4;
    c.fillRect(r() * n, r() * n, s, s);
  }
  // cracks
  c.strokeStyle = "rgba(0,0,0,0.6)";
  c.lineWidth = 1.5;
  for (let i = 0; i < 26; i++) {
    let x = r() * n;
    let y = r() * n;
    c.beginPath();
    c.moveTo(x, y);
    for (let k = 0; k < 9; k++) {
      x += (r() - 0.5) * 70;
      y += (r() - 0.5) * 70;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  ro.fillStyle = "#e6e6e6";
  ro.fillRect(0, 0, n, n);
  a.fillStyle = "#c4c4c4";
  a.fillRect(0, 0, n, n);
  // puddles: soft blobs, smooth in roughness and see-through in alpha
  for (let i = 0; i < 22; i++) {
    const x = r() * n;
    const y = r() * n;
    const rad = 60 + r() * 160;
    for (let k = 0; k < 5; k++) {
      const px = x + (r() - 0.5) * rad;
      const py = y + (r() - 0.5) * rad * 0.6;
      const pr = rad * (0.4 + r() * 0.5);
      const gr = ro.createRadialGradient(px, py, 0, px, py, pr);
      gr.addColorStop(0, "rgba(90,90,90,0.8)");
      gr.addColorStop(0.5, "rgba(90,90,90,0.4)");
      gr.addColorStop(1, "rgba(90,90,90,0)");
      ro.fillStyle = gr;
      ro.globalAlpha = 0.18;
      ro.beginPath();
      ro.ellipse(px, py, pr * 0.6, pr * 1.6, r() * 0.6 - 0.3, 0, Math.PI * 2);
      ro.fill();
      const ga = a.createRadialGradient(px, py, 0, px, py, pr);
      ga.addColorStop(0, "rgba(0,0,0,0.22)");
      ga.addColorStop(0.5, "rgba(0,0,0,0.1)");
      ga.addColorStop(1, "rgba(0,0,0,0)");
      a.fillStyle = ga;
      a.beginPath();
      a.ellipse(px, py, pr * 0.6, pr * 1.6, r() * 0.6 - 0.3, 0, Math.PI * 2);
      a.fill();
    }
  }
  const mk = (cv: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 6);
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: mk(colorCv, true), rough: mk(roughCv, false), alpha: mk(alphaCv, false) };
}

/** a soft round sprite for dust and glows */
function dotTexture() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const c = cv.getContext("2d")!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

/** a cone of light through haze: bright at the lamp, fading down its length and soft at its edges */
function beamMaterial(color: THREE.Color, strength: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: color }, uStrength: { value: strength } },
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        vAlong = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      varying float vAlong;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        float edge = pow(abs(dot(normalize(vN), normalize(vView))), 1.6);
        float fall = pow(vAlong, 1.8);
        gl_FragColor = vec4(uColor * edge * fall * uStrength, 1.0);
      }`,
  });
}

export function createAlley(canvas: HTMLCanvasElement, opts: { reduceMotion: boolean; lowPower: boolean }): AlleyHandle {
  const { reduceMotion, lowPower } = opts;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1 : 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const fogColor = new THREE.Color("#06080b");
  scene.background = fogColor;
  scene.fog = new THREE.FogExp2(fogColor, 0.034);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(o: T) => {
    disposables.push(o);
    return o;
  };

  // ---------- walls ----------
  const bricks = brickTextures(7);
  track(bricks.map);
  track(bricks.bump);
  const grime = track(grimeTexture(3));
  const wallLen = NEAR_Z - FAR_Z;
  const wallMat = (flip: boolean) => {
    const map = bricks.map.clone();
    const bump = bricks.bump.clone();
    map.repeat.set(wallLen / 3.2, H / 1.6);
    bump.repeat.copy(map.repeat);
    if (flip) map.offset.set(0.37, 0.5);
    bump.offset.copy(map.offset);
    map.needsUpdate = bump.needsUpdate = true;
    track(map);
    track(bump);
    const mat = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.6, roughness: 0.92, metalness: 0 });
    // grime as a second, untiled layer through the light map slot would cost a uv set; multiply it in instead
    const g = grime.clone();
    g.repeat.set(wallLen / 7, 1);
    g.needsUpdate = true;
    track(g);
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.grimeMap = { value: g };
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <map_pars_fragment>", "#include <map_pars_fragment>\nuniform sampler2D grimeMap;\nvarying vec2 vGrimeUv;")
        .replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb *= texture2D(grimeMap, vGrimeUv).rgb;");
      sh.vertexShader = sh.vertexShader
        .replace("#include <uv_pars_vertex>", "#include <uv_pars_vertex>\nvarying vec2 vGrimeUv;")
        .replace("#include <uv_vertex>", `#include <uv_vertex>\nvGrimeUv = vec2(uv.x * ${(wallLen / 7).toFixed(3)}, uv.y);`);
    };
    return track(mat);
  };
  const wallGeo = track(new THREE.PlaneGeometry(wallLen, H, 1, 1));
  const leftWall = new THREE.Mesh(wallGeo, wallMat(false));
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-W, H / 2, (NEAR_Z + FAR_Z) / 2);
  leftWall.receiveShadow = true;
  const rightWall = new THREE.Mesh(wallGeo, wallMat(true));
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(W, H / 2, (NEAR_Z + FAR_Z) / 2);
  rightWall.receiveShadow = true;
  scene.add(leftWall, rightWall);

  // ---------- wet ground: a reflector under asphalt whose puddles are cut through ----------
  const groundW = W * 2;
  const reflector = new Reflector(new THREE.PlaneGeometry(groundW, wallLen), {
    textureWidth: Math.round(window.innerWidth * (lowPower ? 0.35 : 0.6)),
    textureHeight: Math.round(window.innerHeight * (lowPower ? 0.35 : 0.6)),
    color: 0x8a8a8a,
  });
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.set(0, -0.002, (NEAR_Z + FAR_Z) / 2);
  scene.add(reflector);
  track(reflector.getRenderTarget());
  track(reflector.material as THREE.Material);
  track(reflector.geometry);

  const gt = groundTextures(11);
  [gt.map, gt.rough, gt.alpha].forEach((t) => {
    t.repeat.set(1, wallLen / groundW);
    track(t);
  });
  const asphalt = new THREE.Mesh(
    track(new THREE.PlaneGeometry(groundW, wallLen)),
    track(new THREE.MeshStandardMaterial({ map: gt.map, color: "#8a8580", roughnessMap: gt.rough, roughness: 1, metalness: 0, alphaMap: gt.alpha, transparent: true, depthWrite: true })),
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(0, 0, (NEAR_Z + FAR_Z) / 2);
  asphalt.receiveShadow = true;
  scene.add(asphalt);

  // ---------- fire escape on the right wall ----------
  const iron = track(new THREE.MeshStandardMaterial({ color: "#151719", roughness: 0.55, metalness: 0.65 }));
  const fe = new THREE.Group();
  const bar = (len: number, axis: "x" | "y" | "z", t = 0.035) => {
    const g = axis === "x" ? new THREE.BoxGeometry(len, t, t) : axis === "y" ? new THREE.BoxGeometry(t, len, t) : new THREE.BoxGeometry(t, t, len);
    track(g);
    const m = new THREE.Mesh(g, iron);
    m.castShadow = true;
    return m;
  };
  const depth = 1.25; // out from the wall
  const z0 = -5.5;
  const z1 = -11;
  const platformYs = [3.0, 5.9, 8.8];
  for (const py of platformYs) {
    // grating: slats across the platform, close together, so the shadow reads as a grid
    for (let z = z1; z <= z0; z += 0.11) {
      const s = bar(depth, "x", 0.025);
      s.position.set(W - depth / 2, py, z);
      fe.add(s);
    }
    for (const x of [W - depth + 0.02, W - depth / 2, W - 0.05]) {
      const s = bar(z0 - z1, "z", 0.05);
      s.position.set(x, py - 0.03, (z0 + z1) / 2);
      fe.add(s);
    }
    // railing: top rail, mid rail, balusters
    for (const ry of [0.95, 0.5]) {
      const rail = bar(z0 - z1, "z", 0.04);
      rail.position.set(W - depth + 0.02, py + ry, (z0 + z1) / 2);
      fe.add(rail);
      for (const zz of [z0, z1]) {
        const end = bar(depth, "x", 0.04);
        end.position.set(W - depth / 2, py + ry, zz);
        fe.add(end);
      }
    }
    for (let z = z1; z <= z0 + 0.001; z += 0.16) {
      const post = bar(0.95, "y", 0.022);
      post.position.set(W - depth + 0.02, py + 0.475, z);
      fe.add(post);
    }
  }
  // stairs between platforms
  for (let i = 0; i < platformYs.length - 1; i++) {
    const ya = platformYs[i];
    const yb = platformYs[i + 1];
    const stair = new THREE.Group();
    const run = 3.4;
    const rise = yb - ya;
    const len = Math.hypot(run, rise);
    const ang = Math.atan2(rise, run);
    for (const x of [W - 0.15, W - 0.75]) {
      const stringer = bar(len, "z", 0.06);
      stringer.rotation.x = ang;
      stringer.position.set(x, 0, 0);
      stair.add(stringer);
      const hand = bar(len, "z", 0.035);
      hand.rotation.x = ang;
      hand.position.set(x, 0.9, 0);
      stair.add(hand);
    }
    const steps = 14;
    for (let s = 0; s < steps; s++) {
      const t = s / (steps - 1) - 0.5;
      const step = bar(0.62, "x", 0.04);
      step.scale.set(1, 1, 4);
      step.position.set(W - 0.45, t * rise, -t * run);
      stair.add(step);
    }
    stair.position.set(0, (ya + yb) / 2, (z0 + z1) / 2 + (i % 2 ? 0.6 : -0.6));
    if (i % 2) stair.scale.z = -1;
    fe.add(stair);
  }
  // brackets into the wall
  for (const py of platformYs)
    for (const zz of [z0 - 0.2, z1 + 0.2]) {
      const br = bar(Math.hypot(depth, 0.9), "x", 0.05);
      br.rotation.z = -Math.atan2(0.9, depth);
      br.position.set(W - depth / 2, py - 0.45, zz);
      fe.add(br);
    }
  scene.add(fe);

  // ---------- pipes, a door, a dumpster: the alley's furniture ----------
  const pipeMat = track(new THREE.MeshStandardMaterial({ color: "#2b2d2e", roughness: 0.5, metalness: 0.6 }));
  const pipe = (x: number, z: number, r: number) => {
    const p = new THREE.Mesh(track(new THREE.CylinderGeometry(r, r, H, 12)), pipeMat);
    p.position.set(x, H / 2, z);
    p.castShadow = true;
    p.receiveShadow = true;
    scene.add(p);
  };
  pipe(-W + 0.09, -2.5, 0.07);
  pipe(-W + 0.08, -19, 0.05);
  pipe(W - 0.1, -14, 0.08);
  pipe(W - 0.07, -26, 0.05);

  const dumpster = new THREE.Group();
  const dMat = track(new THREE.MeshStandardMaterial({ color: "#1c2a24", roughness: 0.6, metalness: 0.4 }));
  const body = new THREE.Mesh(track(new THREE.BoxGeometry(1.0, 1.15, 1.9)), dMat);
  body.position.y = 0.6;
  const lid = new THREE.Mesh(track(new THREE.BoxGeometry(1.1, 0.06, 1.95)), dMat);
  lid.position.set(0.04, 1.2, 0);
  lid.rotation.z = 0.08;
  dumpster.add(body, lid);
  dumpster.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  dumpster.position.set(-W + 0.6, 0, -15);
  scene.add(dumpster);

  // a steel door with a small caged lamp over it, far down on the right
  const door = new THREE.Mesh(track(new THREE.PlaneGeometry(1.0, 2.1)), track(new THREE.MeshStandardMaterial({ color: "#1d1f22", roughness: 0.5, metalness: 0.5 })));
  door.rotation.y = -Math.PI / 2;
  door.position.set(W - 0.01, 1.05, -23);
  door.receiveShadow = true;
  scene.add(door);
  const doorBulb = new THREE.Mesh(track(new THREE.SphereGeometry(0.05, 12, 8)), track(new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd9a0").multiplyScalar(6) })));
  doorBulb.position.set(W - 0.15, 2.45, -23);
  scene.add(doorBulb);
  const doorLight = new THREE.PointLight("#ffb46b", 5, 6, 2);
  doorLight.position.copy(doorBulb.position);
  scene.add(doorLight);

  // ---------- the lit window with blinds, on the left wall ----------
  const winZ = -3.2;
  const winY = 3.0;
  const winW = 1.6;
  const winH = 1.9;
  const winCv = document.createElement("canvas");
  winCv.width = 128;
  winCv.height = 160;
  {
    const c = winCv.getContext("2d")!;
    const g = c.createLinearGradient(0, 0, 0, 160);
    g.addColorStop(0, "#ffd7a1");
    g.addColorStop(1, "#ff9d52");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 160);
    c.fillStyle = "rgba(25,14,6,0.88)";
    for (let y = 4; y < 160; y += 9) c.fillRect(0, y, 128, 5);
    c.fillStyle = "#14100d";
    c.fillRect(0, 0, 128, 4);
    c.fillRect(0, 156, 128, 4);
    c.fillRect(0, 0, 4, 160);
    c.fillRect(124, 0, 4, 160);
    c.fillRect(62, 0, 4, 160);
  }
  const winTex = track(new THREE.CanvasTexture(winCv));
  winTex.colorSpace = THREE.SRGBColorSpace;
  const win = new THREE.Mesh(track(new THREE.PlaneGeometry(winW, winH)), track(new THREE.MeshBasicMaterial({ map: winTex, color: new THREE.Color(2.2, 2.2, 2.2) })));
  win.rotation.y = Math.PI / 2;
  win.position.set(-W + 0.01, winY, winZ);
  scene.add(win);
  // the blinds as real slats just inside the opening, lit from a lamp in the room behind
  const slats = new THREE.Group();
  const slatMat = track(new THREE.MeshBasicMaterial({ color: "#000", colorWrite: false }));
  for (let y = -winH / 2; y < winH / 2; y += 0.105) {
    const s = new THREE.Mesh(track(new THREE.BoxGeometry(0.02, 0.055, winW)), slatMat);
    s.position.set(-W - 0.12, winY + y, winZ);
    s.castShadow = true;
    slats.add(s);
  }
  // window frame and the wall around it, invisible but casting, so the light leaves only through the window
  const frameGeo = track(new THREE.PlaneGeometry(1, 1));
  const frameMat = track(new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide }));
  const frameParts: [number, number, number, number][] = [
    // y, z, height, width (in the wall plane)
    [winY + winH / 2 + 3, winZ, 6, 14],
    [winY - winH / 2 - 3, winZ, 6, 14],
    [winY, winZ + winW / 2 + 3.5, winH, 7],
    [winY, winZ - winW / 2 - 3.5, winH, 7],
    [winY, winZ, winH, 0.05],
  ];
  for (const [y, z, h, w] of frameParts) {
    const f = new THREE.Mesh(frameGeo, frameMat);
    f.rotation.y = Math.PI / 2;
    f.scale.set(w, h, 1);
    f.position.set(-W - 0.02, y, z);
    f.castShadow = true;
    slats.add(f);
  }
  scene.add(slats);
  const winLight = new THREE.SpotLight("#ffae63", 260, 22, 0.62, 0.35, 1.6);
  winLight.position.set(-W - 3.4, winY + 1.0, winZ - 1.6);
  winLight.target.position.set(W, winY - 1.2, winZ + 0.9);
  winLight.castShadow = true;
  winLight.shadow.mapSize.set(lowPower ? 512 : 1024, lowPower ? 512 : 1024);
  winLight.shadow.bias = -0.001;
  winLight.shadow.normalBias = 0.05;
  winLight.shadow.camera.near = 1;
  winLight.shadow.camera.far = 22;
  scene.add(winLight, winLight.target);

  // ---------- the sodium lamp: the key light of the whole scene ----------
  const lampPos = new THREE.Vector3(W - 0.85, 8.3, -15.5);
  const lampTarget = new THREE.Vector3(-1.3, 0, -8.5);
  const sodium = new THREE.Color("#ffa04a");
  const key = new THREE.SpotLight(sodium, 1100, 40, 0.6, 0.35, 1.7);
  key.position.copy(lampPos);
  key.target.position.copy(lampTarget);
  key.castShadow = true;
  const sm = lowPower ? 1024 : 2048;
  key.shadow.mapSize.set(sm, sm);
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.06;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 30;
  scene.add(key, key.target);

  // lamp head: an arm from the wall, a shade, a hot bulb
  const arm = new THREE.Mesh(track(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8)), iron);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(W - 0.3, lampPos.y + 0.15, lampPos.z);
  const shade = new THREE.Mesh(track(new THREE.ConeGeometry(0.28, 0.2, 20, 1, true)), track(new THREE.MeshStandardMaterial({ color: "#1b1c1d", metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide })));
  shade.position.set(lampPos.x, lampPos.y + 0.1, lampPos.z);
  const bulb = new THREE.Mesh(track(new THREE.SphereGeometry(0.11, 16, 12)), track(new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffc27a").multiplyScalar(9) })));
  bulb.position.copy(lampPos);
  scene.add(arm, shade, bulb);

  // the visible beam through the haze, aimed from the lamp to its target
  const beamDir = new THREE.Vector3().subVectors(lampTarget, lampPos);
  const beamLen = beamDir.length() * 1.02;
  const beamGeo = track(new THREE.ConeGeometry(Math.tan(0.6) * beamLen, beamLen, 48, 1, true));
  beamGeo.translate(0, -beamLen / 2, 0);
  const beamMat = track(beamMaterial(new THREE.Color("#ff9a45"), 0.16));
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.copy(lampPos);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), beamDir.clone().normalize());
  scene.add(beam);

  // ---------- the cold far end: a bright street beyond, glowing through the haze ----------
  const endCv = document.createElement("canvas");
  endCv.width = 8;
  endCv.height = 256;
  {
    const c = endCv.getContext("2d")!;
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#05080b");
    g.addColorStop(0.55, "#2a4a5c");
    g.addColorStop(1, "#9cc6d8");
    c.fillStyle = g;
    c.fillRect(0, 0, 8, 256);
  }
  const endTex = track(new THREE.CanvasTexture(endCv));
  endTex.colorSpace = THREE.SRGBColorSpace;
  const endGlow = new THREE.Mesh(track(new THREE.PlaneGeometry(W * 2, H)), track(new THREE.MeshBasicMaterial({ map: endTex, color: new THREE.Color(0.75, 0.75, 0.75), fog: false })));
  endGlow.position.set(0, H / 2, FAR_Z + 0.5);
  scene.add(endGlow);
  const endLight = new THREE.SpotLight("#7fb0cf", 260, 60, 0.12, 0.9, 1.4);
  endLight.position.set(0, 7, FAR_Z + 2);
  endLight.target.position.set(0, 0, -22);
  scene.add(endLight, endLight.target);

  scene.add(new THREE.HemisphereLight("#33302c", "#0b0907", 0.18));

  // ---------- dust drifting in the beam ----------
  const dustCount = lowPower ? 260 : 600;
  const dustGeo = track(new THREE.BufferGeometry());
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = new Float32Array(dustCount);
  const dr = rng(5);
  const beamUnit = beamDir.clone().normalize();
  const side = new THREE.Vector3(0, 0, 1).cross(beamUnit).normalize();
  const up = new THREE.Vector3().crossVectors(beamUnit, side).normalize();
  const tmp = new THREE.Vector3();
  for (let i = 0; i < dustCount; i++) {
    const t = 0.15 + dr() * 0.85;
    const rad = Math.tan(0.5) * beamLen * t * Math.sqrt(dr());
    const a = dr() * Math.PI * 2;
    tmp.copy(lampPos).addScaledVector(beamDir, t).addScaledVector(side, Math.cos(a) * rad).addScaledVector(up, Math.sin(a) * rad);
    dustPos.set([tmp.x, tmp.y, tmp.z], i * 3);
    dustSeed[i] = dr() * 100;
  }
  const dustBase = dustPos.slice();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dotTex = track(dotTexture());
  const dust = new THREE.Points(
    dustGeo,
    track(new THREE.PointsMaterial({ map: dotTex, color: "#ffc58a", size: 0.035, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending })),
  );
  scene.add(dust);

  // ---------- light rain: thin streaks, only really seen where the light catches them ----------
  const rainCount = reduceMotion ? 0 : lowPower ? 500 : 1400;
  const rainGeo = track(new THREE.BufferGeometry());
  const rainPos = new Float32Array(rainCount * 6);
  const rainY = new Float32Array(rainCount);
  const rr = rng(9);
  const RAIN_TOP = 11;
  const RAIN_LEN = 0.32;
  const rainX = new Float32Array(rainCount);
  const rainZ = new Float32Array(rainCount);
  for (let i = 0; i < rainCount; i++) {
    rainX[i] = (rr() * 2 - 1) * (W - 0.05);
    rainZ[i] = 6 - rr() * 30;
    rainY[i] = rr() * RAIN_TOP;
  }
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(
    rainGeo,
    track(new THREE.LineBasicMaterial({ color: "#9aa6ad", transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending })),
  );
  rain.frustumCulled = false;
  scene.add(rain);
  const stepRain = (dt: number) => {
    for (let i = 0; i < rainCount; i++) {
      let y = rainY[i] - dt * 9;
      if (y < 0) y += RAIN_TOP;
      rainY[i] = y;
      const o = i * 6;
      rainPos[o] = rainX[i];
      rainPos[o + 1] = y;
      rainPos[o + 2] = rainZ[i];
      rainPos[o + 3] = rainX[i] + 0.012;
      rainPos[o + 4] = y + RAIN_LEN;
      rainPos[o + 5] = rainZ[i];
    }
    rainGeo.attributes.position.needsUpdate = true;
  };

  // ---------- post: a soft bloom on the hot lights ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.6, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- camera ----------
  let progress = 0;
  let px = 0;
  let py = 0;
  const cam = { x: 0, y: 0, p: 0 };
  const startPos = new THREE.Vector3(-0.35, 1.65, 7.2);
  const endPos = new THREE.Vector3(0.15, 1.75, -4.5);
  const startLook = new THREE.Vector3(0.55, 3.4, -20);
  const endLook = new THREE.Vector3(-0.2, 2.6, -30);
  const look = new THREE.Vector3();

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    camera.aspect = w / h;
    // narrow screens see more of the alley's height
    camera.fov = w / h < 0.8 ? 58 : 42;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const clock = new THREE.Clock();
  let raf = 0;
  let running = false;
  const frame = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 3.2);
    cam.p += (progress - cam.p) * k;
    cam.x += (px - cam.x) * (reduceMotion ? 0 : 1 - Math.exp(-dt * 2));
    cam.y += (py - cam.y) * (reduceMotion ? 0 : 1 - Math.exp(-dt * 2));
    const e = cam.p * cam.p * (3 - 2 * cam.p);
    camera.position.lerpVectors(startPos, endPos, e);
    camera.position.x += cam.x * 0.22;
    camera.position.y += -cam.y * 0.12;
    look.lerpVectors(startLook, endLook, e);
    look.x += cam.x * 0.6;
    camera.lookAt(look);

    if (!reduceMotion) {
      // the sodium lamp hums: a slow breath with a rare stutter
      const stutter = Math.sin(t * 0.37) > 0.995 ? 0.55 : 1;
      key.intensity = 1100 * (0.97 + Math.sin(t * 2.1) * 0.015 + Math.sin(t * 13.7) * 0.008) * stutter;
      beamMat.uniforms.uStrength.value = 0.16 * (key.intensity / 1100);
      for (let i = 0; i < dustCount; i++) {
        const s = dustSeed[i];
        dustPos[i * 3] = dustBase[i * 3] + Math.sin(t * 0.21 + s) * 0.25;
        dustPos[i * 3 + 1] = dustBase[i * 3 + 1] + Math.sin(t * 0.13 + s * 1.7) * 0.35;
        dustPos[i * 3 + 2] = dustBase[i * 3 + 2] + Math.cos(t * 0.17 + s * 0.6) * 0.25;
      }
      dustGeo.attributes.position.needsUpdate = true;
      stepRain(dt);
    }
    composer.render();
    if (running) raf = requestAnimationFrame(frame);
  };
  const start = () => {
    if (running) return;
    running = true;
    clock.getDelta();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };
  // under reduced motion the alley holds still: draw once, and again only when something changes
  const renderOnce = () => requestAnimationFrame(frame);
  if (reduceMotion) renderOnce();
  else start();

  const onVis = () => {
    if (reduceMotion) return;
    if (document.hidden) stop();
    else start();
  };
  document.addEventListener("visibilitychange", onVis);

  return {
    setProgress: (p) => {
      progress = Math.max(0, Math.min(1, p));
      if (reduceMotion) {
        cam.p = progress;
        renderOnce();
      }
    },
    setPointer: (x, y) => {
      px = x;
      py = y;
    },
    dispose: () => {
      stop();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      composer.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}
