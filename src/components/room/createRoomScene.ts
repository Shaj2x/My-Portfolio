import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { createFigure } from "./createFigure";

/*
 * A late-night study room, built entirely from primitives and canvas textures:
 * a figure at a desk lit by a laptop, a bookshelf, a rainy city window,
 * a bed, and a warm hallway light spilling through a half-open door.
 *
 * Room coordinates (metres): x ∈ [-4.3, 4.2], y ∈ [0, 3.2], z ∈ [-3, 4.2].
 * The back wall is at z = -3; the camera starts in the doorway at z ≈ 5.
 */

export type RoomView = "doorway" | "explore";

export interface RoomSceneHandle {
  setView: (view: RoomView) => void;
  dispose: () => void;
}

const ROOM = { left: -4.3, right: 4.2, back: -3, front: 4.2, height: 3.2 };

const VIEWS: Record<RoomView, { pos: THREE.Vector3; target: THREE.Vector3; fov: number }> = {
  doorway: { pos: new THREE.Vector3(0.3, 1.5, 5.4), target: new THREE.Vector3(-0.1, 1.25, -3), fov: 36 },
  explore: { pos: new THREE.Vector3(0.9, 1.6, 1.3), target: new THREE.Vector3(-1.5, 1.05, -2.3), fov: 50 },
};

// ---------- small helpers ----------

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(7);
const rr = (a: number, b: number) => a + rand() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: { repeat?: [number, number]; srgb?: boolean } = {},
) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (opts.repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(...opts.repeat);
  }
  return tex;
}

function noiseFill(ctx: CanvasRenderingContext2D, w: number, h: number, base: string, amount: number, count: number) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < count; i++) {
    const v = Math.floor(rr(-amount, amount));
    ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v / 255})` : `rgba(0,0,0,${-v / 255})`;
    ctx.fillRect(rand() * w, rand() * h, rr(1, 3), rr(1, 3));
  }
}

// ---------- scene ----------

export function createRoomScene(container: HTMLElement): RoomSceneHandle {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(d: T) => {
    disposables.push(d);
    return d;
  };

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  // soft variance shadows: costly to filter, but maps are baked once (see autoUpdate below)
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "none";

  RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#030407");

  const camera = new THREE.PerspectiveCamera(VIEWS.doorway.fov, container.clientWidth / container.clientHeight, 0.05, 60);
  camera.position.copy(VIEWS.doorway.pos);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enabled = false;
  controls.enablePan = false;
  controls.minDistance = 1.2;
  controls.maxDistance = 4.8;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = Math.PI / 2 + 0.05;
  controls.target.copy(VIEWS.doorway.target);
  camera.lookAt(controls.target);

  // Shared geometry / materials
  const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const mat = (params: THREE.MeshStandardMaterialParameters) => track(new THREE.MeshStandardMaterial(params));

  function box(
    w: number, h: number, d: number,
    material: THREE.Material,
    x: number, y: number, z: number,
    parent: THREE.Object3D = scene,
    shadows = true,
  ) {
    const m = new THREE.Mesh(boxGeo, material);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.castShadow = shadows;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // ---------- textures ----------

  const plasterTex = track(canvasTexture(512, 512, (c, w, h) => noiseFill(c, w, h, "#9aa0ad", 22, 18000), { repeat: [4, 2] }));
  const woodFloorTex = track(
    canvasTexture(1024, 1024, (c, w, h) => {
      const plankH = h / 8;
      for (let i = 0; i < 8; i++) {
        const shade = rr(40, 62);
        c.fillStyle = `rgb(${shade + 22},${shade + 8},${shade - 6})`;
        c.fillRect(0, i * plankH, w, plankH);
        for (let g = 0; g < 40; g++) {
          c.strokeStyle = `rgba(0,0,0,${rr(0.05, 0.18)})`;
          c.lineWidth = rr(0.5, 2);
          const y = i * plankH + rand() * plankH;
          c.beginPath();
          c.moveTo(0, y);
          c.bezierCurveTo(w * 0.3, y + rr(-6, 6), w * 0.6, y + rr(-6, 6), w, y + rr(-4, 4));
          c.stroke();
        }
        c.fillStyle = "rgba(0,0,0,0.55)";
        c.fillRect(0, i * plankH, w, 3);
        const seam = rand() * w;
        c.fillRect(seam, i * plankH, 3, plankH);
      }
    }, { repeat: [3, 3] }),
  );
  const deskWoodTex = track(
    canvasTexture(512, 256, (c, w, h) => {
      c.fillStyle = "#6b4527";
      c.fillRect(0, 0, w, h);
      for (let g = 0; g < 120; g++) {
        c.strokeStyle = `rgba(${rand() > 0.5 ? "30,15,5" : "140,95,55"},${rr(0.08, 0.25)})`;
        c.lineWidth = rr(0.5, 2.5);
        const y = rand() * h;
        c.beginPath();
        c.moveTo(0, y);
        c.bezierCurveTo(w * 0.3, y + rr(-10, 10), w * 0.7, y + rr(-10, 10), w, y + rr(-6, 6));
        c.stroke();
      }
    }),
  );
  const corkTex = track(
    canvasTexture(512, 384, (c, w, h) => {
      noiseFill(c, w, h, "#7a5530", 60, 30000);
    }),
  );
  const blanketTex = track(
    canvasTexture(512, 512, (c, w, h) => {
      noiseFill(c, w, h, "#2a3b5c", 18, 20000);
      c.strokeStyle = "rgba(0,0,0,0.12)";
      for (let i = 0; i < w; i += 6) {
        c.beginPath();
        c.moveTo(i, 0);
        c.lineTo(i, h);
        c.stroke();
      }
    }, { repeat: [3, 3] }),
  );
  const rugTex = track(
    canvasTexture(512, 512, (c, w, h) => {
      c.fillStyle = "#23262f";
      c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) {
        c.fillStyle = y % 64 === 0 ? "#3a3f4c" : "#2c3039";
        c.fillRect(0, y, w, 8);
      }
      noiseFill(c, 0, 0, "#000", 0, 0);
      for (let i = 0; i < 8000; i++) {
        c.fillStyle = `rgba(255,255,255,${rr(0, 0.05)})`;
        c.fillRect(rand() * w, rand() * h, 2, 1);
      }
    }),
  );

  const posterTex = track(
    canvasTexture(420, 560, (c, w, h) => {
      const sky = c.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#1d3a44");
      sky.addColorStop(0.55, "#2c5159");
      sky.addColorStop(1, "#1a2c33");
      c.fillStyle = sky;
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#e39a2e";
      c.beginPath();
      c.arc(w * 0.56, h * 0.3, w * 0.2, 0, Math.PI * 2);
      c.fill();
      const ridge = (base: number, amp: number, color: string, seed: number) => {
        c.fillStyle = color;
        c.beginPath();
        c.moveTo(0, h);
        for (let x = 0; x <= w; x += 6) {
          const y = base - Math.abs(Math.sin(x * 0.012 + seed)) * amp - Math.sin(x * 0.041 + seed * 2) * amp * 0.25;
          c.lineTo(x, y);
        }
        c.lineTo(w, h);
        c.fill();
      };
      ridge(h * 0.52, 110, "#27454d", 1.3);
      ridge(h * 0.6, 80, "#1e3940", 2.1);
      ridge(h * 0.7, 60, "#162b31", 0.4);
      c.fillStyle = "#284a52";
      c.fillRect(0, h * 0.74, w, h * 0.1);
      c.fillStyle = "rgba(227,154,46,0.25)";
      c.fillRect(w * 0.48, h * 0.75, w * 0.16, 4);
      c.fillStyle = "#101d22";
      c.fillRect(0, h * 0.84, w, h * 0.16);
    }),
  );

  const makePolaroid = (night: boolean) =>
    track(
      canvasTexture(160, 190, (c, w, h) => {
        c.fillStyle = "#ddd8cc";
        c.fillRect(0, 0, w, h);
        const g = c.createLinearGradient(0, 12, 0, 150);
        g.addColorStop(0, night ? "#0d1620" : "#3d5566");
        g.addColorStop(1, night ? "#2a2218" : "#1c2830");
        c.fillStyle = g;
        c.fillRect(12, 12, w - 24, 138);
        c.fillStyle = night ? "#e09a40" : "#8aa0ad";
        c.beginPath();
        c.arc(w * 0.5, 80, night ? 8 : 18, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#101418";
        c.beginPath();
        c.moveTo(12, 150);
        c.lineTo(50, 95);
        c.lineTo(80, 120);
        c.lineTo(120, 85);
        c.lineTo(w - 12, 150);
        c.fill();
      }),
    );

  const codeScreenTex = track(
    canvasTexture(512, 340, (c, w, h) => {
      c.fillStyle = "#fff3dc";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#f1dcb6";
      c.fillRect(0, 0, w, 26);
      c.fillRect(0, 26, 90, h);
      const colors = ["#c9894a", "#b07a4a", "#d8a46a", "#9a6a3e", "#e2b37e"];
      for (let y = 44; y < h - 10; y += 14) {
        let x = 104 + Math.floor(rr(0, 5)) * 16;
        const words = Math.floor(rr(1, 6));
        for (let i = 0; i < words; i++) {
          const len = rr(18, 70);
          c.fillStyle = pick(colors);
          c.fillRect(x, y, len, 6);
          x += len + 8;
        }
      }
      for (let y = 44; y < h - 10; y += 22) {
        c.fillStyle = "#d8b98a";
        c.fillRect(14, y, rr(30, 64), 6);
      }
    }),
  );

  // City skyline with lit windows and bokeh, slightly blurred for depth of field
  const cityTex = track(
    canvasTexture(2048, 1024, (c, w, h) => {
      const sky = c.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#050b16");
      sky.addColorStop(0.5, "#0c1a2d");
      sky.addColorStop(1, "#16263a");
      c.fillStyle = sky;
      c.fillRect(0, 0, w, h);
      // Draw sharp into a scratch layer, then composite it once with a blur —
      // filtering every individual draw call is extremely slow.
      const layer = document.createElement("canvas");
      layer.width = w;
      layer.height = h;
      const l = layer.getContext("2d")!;
      const drawLayer = (count: number, minH: number, maxH: number, tone: number, winAlpha: number) => {
        for (let i = 0; i < count; i++) {
          const bw = rr(50, 160);
          const bh = rr(minH, maxH);
          const bx = rr(-50, w);
          const by = h - bh;
          l.fillStyle = `rgb(${tone},${tone + 6},${tone + 16})`;
          l.fillRect(bx, by, bw, bh);
          for (let wy = by + 10; wy < h - 6; wy += 14) {
            for (let wx = bx + 6; wx < bx + bw - 8; wx += 12) {
              if (rand() < 0.3) {
                const warm = rand() < 0.75;
                l.fillStyle = warm
                  ? `rgba(255,${Math.floor(rr(150, 200))},${Math.floor(rr(70, 120))},${winAlpha * rr(0.4, 1)})`
                  : `rgba(110,210,255,${winAlpha * rr(0.4, 1)})`;
                l.fillRect(wx, wy, 6, 7);
              }
            }
          }
        }
      };
      drawLayer(40, 250, 700, 14, 0.55);
      drawLayer(55, 150, 500, 10, 0.8);
      drawLayer(30, 80, 260, 7, 1);
      c.filter = "blur(2px)";
      c.drawImage(layer, 0, 0);

      l.clearRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) {
        const warm = rand() < 0.7;
        const r = rr(6, 20);
        l.fillStyle = warm ? `rgba(255,170,90,${rr(0.25, 0.7)})` : `rgba(90,200,255,${rr(0.25, 0.6)})`;
        l.beginPath();
        l.arc(rand() * w, rr(h * 0.55, h), r, 0, Math.PI * 2);
        l.fill();
      }
      c.filter = "blur(6px)";
      c.drawImage(layer, 0, 0);
      c.filter = "none";
    }),
  );

  // Droplets stuck to the glass
  const dropsTex = track(
    canvasTexture(512, 512, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      for (let i = 0; i < 380; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const r = rr(0.8, 3.2);
        c.fillStyle = `rgba(170,200,230,${rr(0.15, 0.45)})`;
        c.beginPath();
        c.ellipse(x, y, r, r * 1.2, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "rgba(255,255,255,0.5)";
        c.fillRect(x - r * 0.3, y - r * 0.5, 1, 1);
      }
    }),
  );
  // Running streaks, scrolled downward every frame
  const streakTex = track(
    canvasTexture(256, 512, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const len = rr(20, 90);
        const g = c.createLinearGradient(0, y, 0, y + len);
        g.addColorStop(0, "rgba(180,210,240,0)");
        g.addColorStop(1, "rgba(200,225,250,0.45)");
        c.strokeStyle = g;
        c.lineWidth = rr(0.8, 1.8);
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + rr(-2, 2), y + len);
        c.stroke();
      }
    }, { repeat: [2, 1] }),
  );

  // ---------- materials ----------

  const wallMat = mat({ color: "#443f46", map: plasterTex, roughness: 0.95 });
  const floorMat = mat({ color: "#948a80", map: woodFloorTex, roughness: 0.55 });
  const ceilingMat = mat({ color: "#1c1f26", roughness: 1 });
  const deskMat = mat({ color: "#ffffff", map: deskWoodTex, roughness: 0.55 });
  const darkWoodMat = mat({ color: "#3b2817", roughness: 0.7 });
  const metalMat = mat({ color: "#1d1f24", roughness: 0.4, metalness: 0.7 });
  const chairMat = mat({ color: "#1c1e24", roughness: 0.75 });
  const frameMat = mat({ color: "#16181d", roughness: 0.5 });
  const paperMat = mat({ color: "#d9cfb6", roughness: 0.95 });
  const leafMat = mat({ color: "#2f4a2c", roughness: 0.75, side: THREE.DoubleSide });
  const potMat = mat({ color: "#4a3a30", roughness: 0.9 });

  // ---------- architecture ----------

  const W = ROOM.right - ROOM.left;
  const D = ROOM.front - ROOM.back;
  const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(W, D)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((ROOM.left + ROOM.right) / 2, 0, (ROOM.back + ROOM.front) / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  const ceiling = new THREE.Mesh(track(new THREE.PlaneGeometry(W, D)), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(floor.position.x, ROOM.height, floor.position.z);
  scene.add(ceiling);

  // Back wall with a window opening
  const win = { x0: 1.15, x1: 2.95, y0: 1.0, y1: 2.65 };
  const wallT = 0.12;
  const bz = ROOM.back - wallT / 2;
  box(win.x0 - ROOM.left, ROOM.height, wallT, wallMat, (ROOM.left + win.x0) / 2, ROOM.height / 2, bz, scene, false);
  box(ROOM.right - win.x1, ROOM.height, wallT, wallMat, (win.x1 + ROOM.right) / 2, ROOM.height / 2, bz, scene, false);
  box(win.x1 - win.x0, win.y0, wallT, wallMat, (win.x0 + win.x1) / 2, win.y0 / 2, bz, scene, false);
  box(win.x1 - win.x0, ROOM.height - win.y1, wallT, wallMat, (win.x0 + win.x1) / 2, (win.y1 + ROOM.height) / 2, bz, scene, false);

  // Side walls
  box(wallT, ROOM.height, D, wallMat, ROOM.left - wallT / 2, ROOM.height / 2, (ROOM.back + ROOM.front) / 2, scene, false);
  box(wallT, ROOM.height, D, wallMat, ROOM.right + wallT / 2, ROOM.height / 2, (ROOM.back + ROOM.front) / 2, scene, false);

  // Skirting boards
  const skirtMat = mat({ color: "#1b1d22", roughness: 0.6 });
  box(W, 0.1, 0.02, skirtMat, (ROOM.left + ROOM.right) / 2, 0.05, ROOM.back + 0.01, scene, false);
  box(0.02, 0.1, D, skirtMat, ROOM.left + 0.01, 0.05, (ROOM.back + ROOM.front) / 2, scene, false);
  box(0.02, 0.1, D, skirtMat, ROOM.right - 0.01, 0.05, (ROOM.back + ROOM.front) / 2, scene, false);

  // Front wall with doorway — the doorway view looks in from the hallway
  const doorway = new THREE.Group();
  scene.add(doorway);
  const door = { x0: -0.25, x1: 0.8, h: 2.15 };
  box(door.x0 - ROOM.left, ROOM.height, wallT, wallMat, (ROOM.left + door.x0) / 2, ROOM.height / 2, ROOM.front + wallT / 2, doorway, false);
  box(ROOM.right - door.x1, ROOM.height, wallT, wallMat, (door.x1 + ROOM.right) / 2, ROOM.height / 2, ROOM.front + wallT / 2, doorway, false);
  box(door.x1 - door.x0, ROOM.height - door.h, wallT, wallMat, (door.x0 + door.x1) / 2, (door.h + ROOM.height) / 2, ROOM.front + wallT / 2, doorway, false);
  const jambMat = mat({ color: "#2a211a", roughness: 0.6 });
  box(0.06, door.h, 0.16, jambMat, door.x0 - 0.03, door.h / 2, ROOM.front + wallT / 2, doorway);
  box(0.06, door.h, 0.16, jambMat, door.x1 + 0.03, door.h / 2, ROOM.front + wallT / 2, doorway);

  // Door leaf, swung open into the room, its edge catching the hallway light
  const doorPivot = new THREE.Group();
  doorPivot.position.set(door.x1, 0, ROOM.front);
  doorPivot.rotation.y = -1.95;
  doorway.add(doorPivot);
  const doorMat = mat({ color: "#3a2a1c", roughness: 0.55 });
  box(door.x1 - door.x0 - 0.02, door.h - 0.02, 0.04, doorMat, -(door.x1 - door.x0) / 2, door.h / 2, -0.02, doorPivot);
  const glowEdge = new THREE.Mesh(boxGeo, track(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 0.95, 0.42) })));
  // tucked just past the leaf's free edge, thinner than the leaf so no faces are coplanar
  glowEdge.scale.set(0.01, door.h - 0.04, 0.032);
  glowEdge.position.set(-(door.x1 - door.x0) + 0.006, door.h / 2, -0.02);
  doorPivot.add(glowEdge);
  const knob = new THREE.Mesh(track(new THREE.SphereGeometry(0.03, 16, 12)), mat({ color: "#6a5a45", metalness: 0.8, roughness: 0.35 }));
  knob.position.set(-(door.x1 - door.x0) + 0.08, 1.0, -0.07);
  doorPivot.add(knob);

  // ---------- window ----------

  const winW = win.x1 - win.x0;
  const winH = win.y1 - win.y0;
  const winCx = (win.x0 + win.x1) / 2;
  const winCy = (win.y0 + win.y1) / 2;
  const f = 0.05;
  box(winW + f * 2, f, 0.14, frameMat, winCx, win.y0 - f / 2, ROOM.back, scene, false);
  box(winW + f * 2, f, 0.14, frameMat, winCx, win.y1 + f / 2, ROOM.back, scene, false);
  box(f, winH, 0.14, frameMat, win.x0 - f / 2, winCy, ROOM.back, scene, false);
  box(f, winH, 0.14, frameMat, win.x1 + f / 2, winCy, ROOM.back, scene, false);
  box(0.035, winH, 0.1, frameMat, winCx, winCy, ROOM.back, scene, false);
  box(winW + 0.2, 0.04, 0.22, frameMat, winCx, win.y0 - 0.06, ROOM.back + 0.07, scene, false); // sill

  const cityMat = track(new THREE.MeshBasicMaterial({ map: cityTex, color: "#d8e0ee" }));
  const city = new THREE.Mesh(track(new THREE.PlaneGeometry(14, 7)), cityMat);
  city.position.set(winCx, 1.2, ROOM.back - 5.5);
  scene.add(city);

  const dropsMat = track(new THREE.MeshBasicMaterial({ map: dropsTex, transparent: true, depthWrite: false, opacity: 0.45 }));
  const streakMat = track(new THREE.MeshBasicMaterial({ map: streakTex, transparent: true, depthWrite: false, opacity: 0.55 }));
  const glassGeo = track(new THREE.PlaneGeometry(winW, winH));
  const glassDrops = new THREE.Mesh(glassGeo, dropsMat);
  glassDrops.position.set(winCx, winCy, ROOM.back - 0.01);
  const glassStreaks = new THREE.Mesh(glassGeo, streakMat);
  glassStreaks.position.set(winCx, winCy, ROOM.back - 0.012);
  scene.add(glassDrops, glassStreaks);

  // Falling rain outside
  const RAIN = 420;
  const rainPos = new Float32Array(RAIN * 6);
  const rainSpeed = new Float32Array(RAIN);
  const rainBox = { x0: win.x0 - 1.5, x1: win.x1 + 1.5, y0: -1, y1: 4, z0: ROOM.back - 3, z1: ROOM.back - 0.15 };
  const resetDrop = (i: number, y?: number) => {
    const x = rr(rainBox.x0, rainBox.x1);
    const yy = y ?? rr(rainBox.y0, rainBox.y1);
    const z = rr(rainBox.z0, rainBox.z1);
    const len = rr(0.08, 0.18);
    rainPos.set([x, yy, z, x - 0.01, yy - len, z], i * 6);
    rainSpeed[i] = rr(5, 8);
  };
  for (let i = 0; i < RAIN; i++) resetDrop(i);
  const rainGeo = track(new THREE.BufferGeometry());
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(
    rainGeo,
    track(new THREE.LineBasicMaterial({ color: "#8fb2d6", transparent: true, opacity: 0.16 })),
  );
  scene.add(rain);

  // Curtains — a wavy plane on each side of the window
  const curtainMat = mat({ color: "#1c2a3c", roughness: 0.95, side: THREE.DoubleSide });
  const makeCurtain = (x: number, width: number) => {
    const g = track(new THREE.PlaneGeometry(width, 2.7, 40, 1));
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 22) * 0.04);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, curtainMat);
    m.position.set(x, 1.55, ROOM.back + 0.14);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  };
  makeCurtain(win.x0 - 0.2, 0.55);
  makeCurtain(win.x1 + 0.22, 0.55);
  const rod = new THREE.Mesh(track(new THREE.CylinderGeometry(0.012, 0.012, winW + 1.1, 8)), metalMat);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(winCx, 2.92, ROOM.back + 0.14);
  scene.add(rod);

  // ---------- desk area ----------

  const desk = { x0: -4.05, x1: -0.3, z0: -2.72, z1: -1.95, top: 0.76 };
  const deskCx = (desk.x0 + desk.x1) / 2;
  const deskCz = (desk.z0 + desk.z1) / 2;
  box(desk.x1 - desk.x0, 0.04, desk.z1 - desk.z0, deskMat, deskCx, desk.top - 0.02, deskCz);
  for (const lx of [desk.x0 + 0.05, desk.x1 - 0.05])
    for (const lz of [desk.z0 + 0.05, desk.z1 - 0.05]) box(0.04, desk.top - 0.04, 0.04, metalMat, lx, (desk.top - 0.04) / 2, lz);
  box(desk.x1 - desk.x0 - 0.1, 0.06, 0.02, metalMat, deskCx, desk.top - 0.08, desk.z1 - 0.05);

  // Laptop
  const laptop = new THREE.Group();
  laptop.position.set(-1.55, desk.top, -2.3);
  laptop.rotation.y = -0.55;
  scene.add(laptop);
  const laptopMat = mat({ color: "#8a8d94", roughness: 0.35, metalness: 0.6 });
  box(0.36, 0.018, 0.25, laptopMat, 0, 0.009, 0, laptop);
  const lid = new THREE.Group();
  lid.position.set(0, 0.018, -0.125);
  lid.rotation.x = -0.28;
  laptop.add(lid);
  box(0.36, 0.24, 0.01, laptopMat, 0, 0.12, 0, lid);
  const screenMat = track(new THREE.MeshBasicMaterial({ map: codeScreenTex, color: new THREE.Color(1.5, 1.35, 1.15) }));
  const screen = new THREE.Mesh(track(new THREE.PlaneGeometry(0.33, 0.21)), screenMat);
  screen.position.set(0, 0.125, 0.0056);
  lid.add(screen);

  // Mug
  const mugMat = mat({ color: "#b9aa92", roughness: 0.55 });
  const mug = new THREE.Group();
  mug.position.set(-1.0, desk.top, -2.15);
  scene.add(mug);
  const mugBody = new THREE.Mesh(track(new THREE.CylinderGeometry(0.045, 0.042, 0.11, 24, 1, true)), mugMat);
  mugBody.position.y = 0.055;
  mugBody.castShadow = true;
  (mugBody.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  const mugBase = new THREE.Mesh(track(new THREE.CircleGeometry(0.042, 24)), mugMat);
  mugBase.rotation.x = -Math.PI / 2;
  mugBase.position.y = 0.004;
  const coffee = new THREE.Mesh(track(new THREE.CircleGeometry(0.043, 24)), mat({ color: "#1d120a", roughness: 0.2 }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.09;
  const handle = new THREE.Mesh(track(new THREE.TorusGeometry(0.028, 0.008, 8, 20)), mugMat);
  handle.position.set(0.052, 0.058, 0);
  handle.castShadow = true;
  mug.add(mugBody, mugBase, coffee, handle);

  // Phone, face up, glowing cyan
  const phone = new THREE.Group();
  phone.position.set(-0.62, desk.top, -2.08);
  phone.rotation.y = 0.35;
  scene.add(phone);
  box(0.075, 0.008, 0.155, mat({ color: "#0c0d10", roughness: 0.3 }), 0, 0.004, 0, phone);
  const phoneScreenMat = track(new THREE.MeshBasicMaterial({ color: "#4fd6e6" }));
  const phoneScreen = new THREE.Mesh(track(new THREE.PlaneGeometry(0.066, 0.142)), phoneScreenMat);
  phoneScreen.rotation.x = -Math.PI / 2;
  phoneScreen.position.y = 0.0085;
  phone.add(phoneScreen);

  // Pencil cup
  const cup = new THREE.Mesh(track(new THREE.CylinderGeometry(0.045, 0.04, 0.12, 16, 1, true)), mat({ color: "#3d3a38", roughness: 0.7, side: THREE.DoubleSide }));
  cup.position.set(-3.75, desk.top + 0.06, -2.45);
  cup.castShadow = true;
  scene.add(cup);
  const pencilGeo = track(new THREE.CylinderGeometry(0.004, 0.004, 0.19, 6));
  const pencilMats = ["#2a2a2a", "#6b4b2a", "#1d2b3a", "#503020"].map((c) => mat({ color: c, roughness: 0.6 }));
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(pencilGeo, pencilMats[i % pencilMats.length]);
    p.position.set(-3.75 + rr(-0.02, 0.02), desk.top + 0.12, -2.45 + rr(-0.02, 0.02));
    p.rotation.set(rr(-0.25, 0.25), 0, rr(-0.25, 0.25));
    p.castShadow = true;
    scene.add(p);
  }

  // Book stack on the desk
  const bookColors = ["#2d4a5a", "#6b2e22", "#3a4a3a", "#7a6a4a", "#2a3348", "#5a3a4a", "#8a7a5a", "#1f3a3a", "#6a5a3a", "#3a2a22"];
  let stackY = desk.top;
  for (let i = 0; i < 3; i++) {
    const h = rr(0.025, 0.045);
    const b = box(0.24 - i * 0.02, h, 0.17, mat({ color: pick(bookColors), roughness: 0.8 }), -3.45, stackY + h / 2, -2.2);
    b.rotation.y = rr(-0.2, 0.2);
    stackY += h;
  }

  // ---------- plants ----------

  const leafGeo = track(new THREE.CircleGeometry(0.035, 8));
  leafGeo.scale(1, 1.8, 1);
  function makePlant(x: number, y: number, z: number, opts: { potR: number; vines: number; vineLen: number; bushy: number }) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const pot = new THREE.Mesh(track(new THREE.CylinderGeometry(opts.potR, opts.potR * 0.78, opts.potR * 1.6, 16)), potMat);
    pot.position.y = opts.potR * 0.8;
    pot.castShadow = true;
    g.add(pot);
    const leaves: THREE.Matrix4[] = [];
    const tmp = new THREE.Object3D();
    const addLeaf = (px: number, py: number, pz: number) => {
      tmp.position.set(px, py, pz);
      tmp.rotation.set(rr(-1.2, 1.2), rr(0, Math.PI * 2), rr(-1.2, 1.2));
      const s = rr(0.7, 1.3);
      tmp.scale.set(s, s, s);
      tmp.updateMatrix();
      leaves.push(tmp.matrix.clone());
    };
    const top = opts.potR * 1.6;
    for (let i = 0; i < opts.bushy; i++) {
      const a = rand() * Math.PI * 2;
      const r = rr(0, opts.potR * 1.6);
      addLeaf(Math.cos(a) * r, top + rr(0, opts.potR * 2.2), Math.sin(a) * r);
    }
    for (let v = 0; v < opts.vines; v++) {
      const a = rand() * Math.PI * 2;
      const len = opts.vineLen * rr(0.5, 1);
      for (let t = 0; t < 1; t += 0.06) {
        const out = opts.potR * (1 + t * 0.6);
        addLeaf(Math.cos(a) * out + rr(-0.02, 0.02), top - t * len, Math.sin(a) * out + rr(-0.02, 0.02));
      }
    }
    const inst = new THREE.InstancedMesh(leafGeo, leafMat, leaves.length);
    leaves.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.castShadow = true;
    g.add(inst);
    scene.add(g);
    return g;
  }

  makePlant(-3.95, desk.top, -2.55, { potR: 0.07, vines: 0, vineLen: 0, bushy: 60 });

  // ---------- bookshelf ----------

  const shelf = { x0: -1.25, x1: -0.05, z0: -2.99, z1: -2.63, h: 2.05 };
  const shelfCx = (shelf.x0 + shelf.x1) / 2;
  const shelfCz = (shelf.z0 + shelf.z1) / 2;
  const sd = shelf.z1 - shelf.z0;
  box(0.035, shelf.h, sd, darkWoodMat, shelf.x0, shelf.h / 2, shelfCz);
  box(0.035, shelf.h, sd, darkWoodMat, shelf.x1, shelf.h / 2, shelfCz);
  box(shelf.x1 - shelf.x0, shelf.h, 0.015, darkWoodMat, shelfCx, shelf.h / 2, shelf.z0 + 0.008);
  const levels = [0.04, 0.5, 0.98, 1.46, shelf.h];
  for (const ly of levels) box(shelf.x1 - shelf.x0, 0.03, sd, darkWoodMat, shelfCx, ly, shelfCz);

  const bookMats = bookColors.map((c) => mat({ color: c, roughness: 0.8 }));
  for (let l = 0; l < levels.length - 1; l++) {
    const base = levels[l] + 0.015;
    const maxH = levels[l + 1] - base - 0.04;
    let x = shelf.x0 + 0.03;
    const end = shelf.x1 - 0.03;
    const gapAt = rr(0.5, 0.9);
    while (x < end - 0.03) {
      const progress = (x - shelf.x0) / (shelf.x1 - shelf.x0);
      if (progress > gapAt && progress < gapAt + 0.08) {
        // a small horizontal stack in the gap
        let sy = base;
        for (let s = 0; s < 3; s++) {
          const hh = rr(0.025, 0.04);
          box(0.2, hh, 0.24, pick(bookMats), x + 0.1, sy + hh / 2, shelfCz + 0.02);
          sy += hh;
        }
        x += 0.22;
        continue;
      }
      const bw = rr(0.025, 0.06);
      const bh = Math.min(maxH, rr(0.26, 0.4));
      const b = box(bw, bh, rr(0.2, 0.27), pick(bookMats), x + bw / 2, base + bh / 2, shelfCz + 0.02);
      if (rand() < 0.06) b.rotation.z = rr(-0.18, -0.08);
      x += bw + 0.003;
    }
  }
  // Top of shelf: hanging plant, a small globe, stacked books
  makePlant(-1.05, shelf.h + 0.015, shelfCz, { potR: 0.09, vines: 7, vineLen: 1.3, bushy: 70 });
  const globe = new THREE.Mesh(track(new THREE.SphereGeometry(0.07, 24, 16)), mat({ color: "#3b4a50", roughness: 0.5, metalness: 0.2 }));
  globe.position.set(-0.3, shelf.h + 0.1, shelfCz);
  globe.castShadow = true;
  scene.add(globe);
  let ty = shelf.h + 0.015;
  for (let i = 0; i < 3; i++) {
    const hh = rr(0.03, 0.05);
    box(0.26, hh, 0.19, pick(bookMats), -0.65, ty + hh / 2, shelfCz);
    ty += hh;
  }
  box(0.2, 0.02, 0.06, darkWoodMat, -0.65, ty + 0.01, shelfCz); // incense holder-ish

  // Poster above the shelf
  const poster = new THREE.Group();
  poster.position.set(-0.62, 2.72, ROOM.back + 0.02);
  scene.add(poster);
  box(0.6, 0.8, 0.03, frameMat, 0, 0, 0, poster, false);
  const posterArt = new THREE.Mesh(track(new THREE.PlaneGeometry(0.52, 0.7)), mat({ map: posterTex, emissive: "#ffffff", emissiveMap: posterTex, emissiveIntensity: 0.12, roughness: 0.6 }));
  posterArt.position.z = 0.016;
  poster.add(posterArt);

  // ---------- corkboard ----------

  const cork = new THREE.Group();
  cork.position.set(-3.1, 1.75, ROOM.back + 0.03);
  scene.add(cork);
  box(1.5, 1.05, 0.04, darkWoodMat, 0, 0, 0, cork, false);
  const corkFace = new THREE.Mesh(track(new THREE.PlaneGeometry(1.42, 0.97)), mat({ map: corkTex, roughness: 1 }));
  corkFace.position.z = 0.021;
  cork.add(corkFace);
  const pinMat = mat({ color: "#aa3a2a", roughness: 0.4 });
  const pinGeo = track(new THREE.SphereGeometry(0.008, 8, 6));
  const addPinned = (w: number, h: number, x: number, y: number, material: THREE.Material) => {
    const n = new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), material);
    n.position.set(x, y, 0.024);
    n.rotation.z = rr(-0.08, 0.08);
    cork.add(n);
    const pin = new THREE.Mesh(pinGeo, pinMat);
    pin.position.set(x, y + h / 2 - 0.02, 0.03);
    cork.add(pin);
  };
  addPinned(0.2, 0.26, -0.45, 0.25, paperMat);
  addPinned(0.18, 0.22, -0.12, 0.05, paperMat);
  addPinned(0.19, 0.25, 0.35, 0.22, paperMat);
  addPinned(0.17, 0.16, 0.38, -0.12, paperMat);
  addPinned(0.2, 0.24, -0.5, -0.22, mat({ map: makePolaroid(false), roughness: 0.6 }));
  addPinned(0.2, 0.24, -0.15, -0.3, mat({ map: makePolaroid(true), roughness: 0.6 }));

  // ---------- chair & figure ----------

  const seat = new THREE.Group();
  seat.position.set(-2.25, 0, -1.45);
  seat.rotation.y = -0.12;
  scene.add(seat);
  const cushion = new THREE.Mesh(track(new RoundedBoxGeometry(0.5, 0.075, 0.48, 4, 0.03)), chairMat);
  cushion.position.y = 0.5;
  const backGeo = track(new RoundedBoxGeometry(0.48, 0.6, 0.06, 4, 0.028));
  {
    // curve the backrest around the sitter
    const p = backGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + p.getX(i) ** 2 * 0.5);
    backGeo.computeVertexNormals();
  }
  const back = new THREE.Mesh(backGeo, chairMat);
  back.position.set(0, 0.93, 0.27);
  back.rotation.x = 0.1;
  for (const m of [cushion, back]) {
    m.castShadow = m.receiveShadow = true;
    seat.add(m);
  }
  box(0.035, 0.26, 0.035, metalMat, -0.2, 0.66, 0.26, seat);
  box(0.035, 0.26, 0.035, metalMat, 0.2, 0.66, 0.26, seat);
  const post = new THREE.Mesh(track(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 10)), metalMat);
  post.position.y = 0.26;
  seat.add(post);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = box(0.3, 0.03, 0.04, metalMat, Math.cos(a) * 0.15, 0.06, Math.sin(a) * 0.15, seat);
    leg.rotation.y = -a;
  }

  // A seated figure seen from behind — the anchor of the scene
  const person = createFigure(track, rand);
  const figure = person.group;
  figure.position.set(-2.22, 0.535, -1.55);
  figure.rotation.y = -0.12;
  scene.add(figure);

  // ---------- bed ----------

  const bed = { x0: 2.1, x1: 3.95, z0: -2.95, z1: 0.9, top: 0.58 };
  const bedCx = (bed.x0 + bed.x1) / 2;
  const bedW = bed.x1 - bed.x0;
  const bedL = bed.z1 - bed.z0;
  const bedCz = (bed.z0 + bed.z1) / 2;
  box(bedW + 0.06, 0.28, bedL + 0.06, darkWoodMat, bedCx, 0.18, bedCz);
  box(bedW, 0.22, bedL, mat({ color: "#6c6e78", roughness: 0.9 }), bedCx, 0.43, bedCz);
  box(bedW + 0.08, 0.95, 0.06, darkWoodMat, bedCx, 0.48, bed.z0 - 0.02);

  const blanketGeo = track(new THREE.PlaneGeometry(bedW + 0.7, bedL * 0.78 + 0.35, 70, 90));
  blanketGeo.rotateX(-Math.PI / 2);
  {
    const p = blanketGeo.attributes.position as THREE.BufferAttribute;
    const halfW = bedW / 2;
    const coverL = bedL * 0.78;
    const footZ = coverL / 2 - 0.35 / 2;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i);
      let z = p.getZ(i);
      let y = 0;
      const dx = Math.max(0, Math.abs(x) - halfW);
      const dz = Math.max(0, z - footZ);
      const wr = Math.sin(x * 9 + z * 3) * 0.012 + Math.sin(z * 13 + x * 2) * 0.01 + Math.sin(x * 23 - z * 17) * 0.004;
      if (dx > 0) {
        x = Math.sign(x) * (halfW + 0.02 + dx * 0.06);
        y -= dx * 1.3;
      }
      if (dz > 0) {
        z = footZ + 0.02 + dz * 0.06;
        y -= dz * 1.3;
      }
      p.setXYZ(i, x, y + wr, z);
    }
    blanketGeo.computeVertexNormals();
  }
  const blanket = new THREE.Mesh(blanketGeo, mat({ map: blanketTex, color: "#a8b6d4", roughness: 1, side: THREE.DoubleSide }));
  blanket.position.set(bedCx, bed.top + 0.02, bedCz + bedL * 0.11);
  blanket.castShadow = true;
  blanket.receiveShadow = true;
  scene.add(blanket);
  const pillowMat = mat({ color: "#394a66", roughness: 0.95 });
  for (const px of [bedCx - 0.45, bedCx + 0.45]) {
    const pillow = new THREE.Mesh(track(new THREE.SphereGeometry(0.5, 24, 12)), pillowMat);
    pillow.scale.set(0.7, 0.2, 0.38);
    pillow.position.set(px, bed.top + 0.06, bed.z0 + 0.3);
    pillow.castShadow = true;
    pillow.receiveShadow = true;
    scene.add(pillow);
  }

  // Rug
  const rug = new THREE.Mesh(track(new THREE.PlaneGeometry(2.0, 2.8)), mat({ map: rugTex, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.rotation.z = 0.02;
  rug.position.set(0.9, 0.004, 1.3);
  rug.receiveShadow = true;
  scene.add(rug);

  // A trailing plant high on the left wall, near the doorway
  // (no shadows: the hallway spotlight would throw huge leaf shadows across the wall)
  makePlant(ROOM.left + 0.25, 2.25, 0.6, { potR: 0.1, vines: 8, vineLen: 1.1, bushy: 60 }).traverse((o) => (o.castShadow = false));
  box(0.3, 0.025, 0.3, darkWoodMat, ROOM.left + 0.16, 2.24, 0.6); // wall shelf

  // ---------- warm practical lights ----------

  // Fairy lights: a sagging string of bulbs whose glow blooms in post
  const bulbGeo = track(new THREE.SphereGeometry(0.022, 12, 10));
  const bulbMat = track(new THREE.MeshBasicMaterial({ color: "#ffffff" }));
  const wireMat = track(new THREE.LineBasicMaterial({ color: "#1a1410" }));
  const fairyBulbs: { mesh: THREE.InstancedMesh; phase: Float32Array }[] = [];
  const fairyLights: THREE.PointLight[] = [];
  const BULB_COLOR = new THREE.Color(2.2, 0.95, 0.28); // HDR so it blooms
  function stringLights(points: THREE.Vector3[], sag: number, count: number, lights: number) {
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const mid = a.clone().lerp(b, 0.5);
      mid.y -= sag;
      path.add(new THREE.QuadraticBezierCurve3(a, mid, b));
    }
    const wire = new THREE.Line(track(new THREE.BufferGeometry().setFromPoints(path.getSpacedPoints(120))), wireMat);
    scene.add(wire);
    const inst = new THREE.InstancedMesh(bulbGeo, bulbMat, count);
    const phase = new Float32Array(count);
    const o = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      o.position.copy(path.getPointAt((i + 0.5) / count));
      o.position.y -= 0.02;
      o.updateMatrix();
      inst.setMatrixAt(i, o.matrix);
      inst.setColorAt(i, BULB_COLOR);
      phase[i] = rand() * Math.PI * 2;
    }
    scene.add(inst);
    fairyBulbs.push({ mesh: inst, phase });
    for (let i = 0; i < lights; i++) {
      const l = new THREE.PointLight("#ffac55", 0.8, 2.8, 2);
      l.position.copy(path.getPointAt((i + 0.5) / lights));
      l.position.z += 0.12;
      scene.add(l);
      fairyLights.push(l);
    }
  }
  // above the corkboard and desk, pinned to the back wall
  stringLights(
    [new THREE.Vector3(ROOM.left + 0.05, 2.75, ROOM.back + 0.06), new THREE.Vector3(-2.7, 2.8, ROOM.back + 0.06), new THREE.Vector3(-1.35, 2.72, ROOM.back + 0.06)],
    0.22, 34, 2,
  );
  // along the left wall toward the doorway
  stringLights(
    [new THREE.Vector3(ROOM.left + 0.06, 2.75, ROOM.back + 0.1), new THREE.Vector3(ROOM.left + 0.06, 2.85, 0.1), new THREE.Vector3(ROOM.left + 0.06, 2.8, 2.6)],
    0.25, 40, 2,
  );

  // Bedside table and lamp
  const stand = new THREE.Group();
  stand.position.set(1.72, 0, -2.55);
  scene.add(stand);
  box(0.5, 0.52, 0.42, darkWoodMat, 0, 0.26, 0, stand);
  box(0.46, 0.01, 0.005, mat({ color: "#0e0a07" }), 0, 0.36, 0.212, stand, false); // drawer seam
  const lampBase = new THREE.Mesh(track(new THREE.CylinderGeometry(0.06, 0.075, 0.03, 24)), mat({ color: "#2c2520", roughness: 0.4, metalness: 0.5 }));
  lampBase.position.y = 0.535;
  const lampStem = new THREE.Mesh(track(new THREE.CylinderGeometry(0.008, 0.008, 0.24, 8)), metalMat);
  lampStem.position.y = 0.66;
  const shadeMat = mat({ color: "#e8cfa6", emissive: "#ffb366", emissiveIntensity: 1.6, roughness: 0.9, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(track(new THREE.CylinderGeometry(0.1, 0.16, 0.2, 32, 1, true)), shadeMat);
  shade.position.y = 0.82;
  const bulbGlow = new THREE.Mesh(track(new THREE.SphereGeometry(0.035, 16, 12)), track(new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2, 1.1) })));
  bulbGlow.position.y = 0.8;
  stand.add(lampBase, lampStem, shade, bulbGlow);
  const bedLamp = new THREE.PointLight("#ffac5c", 2.6, 5, 1.7);
  bedLamp.position.set(0, 0.8, 0.02);
  stand.add(bedLamp);
  // a book and glasses-case on the nightstand
  box(0.16, 0.03, 0.22, pick(bookMats), -0.13, 0.535, 0.06, stand).rotation.y = 0.3;

  // Candle on the desk, beside the books
  const candle = new THREE.Group();
  candle.position.set(-3.05, desk.top, -2.45);
  scene.add(candle);
  const wax = new THREE.Mesh(track(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 20)), mat({ color: "#e9dcc4", roughness: 0.6, emissive: "#ff9a40", emissiveIntensity: 0.15 }));
  wax.position.y = 0.045;
  wax.castShadow = true;
  const flameMat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.9, 0.7), transparent: true, opacity: 0.95 }));
  const flame = new THREE.Mesh(track(new THREE.SphereGeometry(0.011, 12, 10)), flameMat);
  flame.scale.set(1, 2.3, 1);
  flame.position.y = 0.118;
  candle.add(wax, flame);
  const candleLight = new THREE.PointLight("#ff9440", 0.9, 2.8, 2);
  candleLight.position.y = 0.16;
  candle.add(candleLight);

  // ---------- lighting ----------

  scene.add(new THREE.HemisphereLight("#2a3047", "#1c1109", 0.55));

  // The laptop is the key light
  const laptopLight = new THREE.PointLight("#ffa04a", 4.5, 8, 1.5);
  laptopLight.position.set(0, 0.16, 0.14);
  laptopLight.castShadow = true;
  laptopLight.shadow.mapSize.set(1024, 1024);
  laptopLight.shadow.bias = -0.0005;
  laptopLight.shadow.radius = 10;
  laptopLight.shadow.blurSamples = 16;
  laptop.add(laptopLight);

  // Soft fill from the screen onto the wall and the figure's face side
  const screenGlow = new THREE.RectAreaLight("#ffb068", 6, 0.35, 0.24);
  screenGlow.position.set(0, 0.14, 0.02);
  screenGlow.lookAt(new THREE.Vector3(0, 0.14, 1));
  lid.add(screenGlow);

  // Cool light from the city through the window — the one cold note
  const windowLight = new THREE.RectAreaLight("#4a78b8", 1.8, winW, winH);
  windowLight.position.set(winCx, winCy, ROOM.back - 0.02);
  windowLight.lookAt(winCx, winCy - 0.4, 0);
  scene.add(windowLight);

  const moon = new THREE.DirectionalLight("#4c6a9a", 0.3);
  moon.position.set(winCx, 3.5, ROOM.back - 4);
  moon.target.position.set(1.5, 0, 0);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.left = -4;
  moon.shadow.camera.right = 4;
  moon.shadow.camera.top = 4;
  moon.shadow.camera.bottom = -4;
  moon.shadow.bias = -0.0005;
  moon.shadow.radius = 6;
  moon.shadow.blurSamples = 12;
  scene.add(moon, moon.target);

  // Phone glow
  const phoneLight = new THREE.PointLight("#48d8ee", 0.15, 0.8, 2);
  phoneLight.position.set(0, 0.05, 0);
  phone.add(phoneLight);

  // Warm hallway light spilling past the door
  const hallLight = new THREE.SpotLight("#ffa458", 22, 12, 0.55, 0.75, 1.6);
  hallLight.position.set(1.2, 2.0, ROOM.front + 1.2);
  hallLight.target.position.set(-0.3, 0, 1.2);
  hallLight.castShadow = true;
  hallLight.shadow.mapSize.set(1024, 1024);
  hallLight.shadow.bias = -0.0005;
  hallLight.shadow.radius = 8;
  hallLight.shadow.blurSamples = 16;
  scene.add(hallLight, hallLight.target);
  const hallFill = new THREE.PointLight("#ff9a4a", 1.4, 3, 2);
  hallFill.position.set(door.x1 + 0.15, 1.3, ROOM.front + 0.5);
  doorway.add(hallFill);

  // Shadow maps are refreshed on a slow tick in the loop rather than every frame
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  // ---------- dust motes in the lamp light ----------

  const DUST = 160;
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dustPos.set([rr(-2.8, -0.9), rr(0.8, 2.2), rr(-2.8, -1.6)], i * 3);
    dustSeed[i] = rand() * 100;
  }
  const dustGeo = track(new THREE.BufferGeometry());
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dustTex = track(
    canvasTexture(32, 32, (c) => {
      const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 32, 32);
    }),
  );
  const dust = new THREE.Points(
    dustGeo,
    track(new THREE.PointsMaterial({ map: dustTex, color: "#ffc58a", size: 0.008, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending })),
  );
  scene.add(dust);

  // ---------- post-processing ----------

  // Multisampled HDR target so edges stay clean and bright bulbs bloom without banding
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), 0.5, 0.75, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  // Final grade: warm vignette, fine film grain, and a fade in from black
  const finish = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFade: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse; uniform float uTime; uniform float uFade; varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        vec2 d = vUv - 0.5;
        float vig = smoothstep(0.85, 0.2, length(d * vec2(1.1, 1.25)));
        c.rgb *= mix(vec3(0.55, 0.45, 0.4), vec3(1.0), vig);
        c.rgb += (hash(vUv * 1000.0 + fract(uTime * 7.0)) - 0.5) * 0.022;
        gl_FragColor = vec4(c.rgb * uFade, 1.0);
      }`,
  });
  composer.addPass(finish);

  // ---------- interaction ----------

  let view: RoomView = "doorway";
  const pointerTarget = new THREE.Vector2();
  const pointer = new THREE.Vector2();
  const onPointerMove = (e: PointerEvent) => {
    const r = renderer.domElement.getBoundingClientRect();
    pointerTarget.set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
  };
  const onPointerLeave = () => pointerTarget.set(0, 0);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerleave", onPointerLeave);

  // camera tween between views
  let tween: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; fovFrom: number; fovTo: number; t: number; dur: number } | null = null;
  const setView = (next: RoomView) => {
    if (next === view && !tween) return;
    view = next;
    controls.enabled = false;
    if (next === "explore") {
      doorway.visible = false;
      renderer.shadowMap.needsUpdate = true;
    }
    tween = {
      from: camera.position.clone(),
      to: VIEWS[next].pos.clone(),
      tFrom: controls.target.clone(),
      tTo: VIEWS[next].target.clone(),
      fovFrom: camera.fov,
      fovTo: VIEWS[next].fov,
      t: 0,
      dur: reducedMotion ? 0.01 : 2.2,
    };
  };

  let pixelRatio = Math.min(window.devicePixelRatio, 2);
  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    // keep the full scene in frame on narrow (portrait) screens
    camera.zoom = camera.aspect < 1 ? Math.max(0.55, camera.aspect * 1.1) : 1;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(w, h);
  };
  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);
  onResize();

  // ---------- animation loop ----------

  // frame-rate independent exponential smoothing
  const damp = (lambda: number, dt: number) => 1 - Math.exp(-lambda * dt);

  const clock = new THREE.Clock(false);
  let lightning = 0;
  let nextLightning = reducedMotion ? Infinity : rr(8, 16);
  const baseCity = new THREE.Color("#d8e0ee");
  const clampMin = new THREE.Vector3(ROOM.left + 0.3, 0.3, ROOM.back + 0.4);
  const clampMax = new THREE.Vector3(ROOM.right - 0.3, ROOM.height - 0.2, ROOM.front - 0.3);
  const lookTarget = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const bulbColor = new THREE.Color();
  let frame = 0;
  let shadowTick = 0;
  let slowFrames = 0;
  let sampled = 0;

  const flickerNoise = (t: number, s: number) =>
    Math.sin(t * 9.1 + s) * 0.5 + Math.sin(t * 23.7 + s * 2.1) * 0.3 + Math.sin(t * 3.3 + s * 0.7) * 0.2;

  const animate = () => {
    frame = requestAnimationFrame(animate);
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;

    // Adaptive resolution: if the device can't hold ~45fps, step the pixel ratio down once or twice
    if (t > 2 && pixelRatio > 1) {
      sampled++;
      if (rawDt > 1 / 45) slowFrames++;
      if (sampled === 90) {
        if (slowFrames > 45) {
          pixelRatio = Math.max(1, pixelRatio - 0.5);
          onResize();
        }
        sampled = slowFrames = 0;
      }
    }

    finish.uniforms.uTime.value = t;
    finish.uniforms.uFade.value = Math.min(1, finish.uniforms.uFade.value + dt / 1.8);

    // rain
    for (let i = 0; i < RAIN; i++) {
      const o = i * 6;
      const dy = rainSpeed[i] * dt;
      rainPos[o + 1] -= dy;
      rainPos[o + 4] -= dy;
      if (rainPos[o + 4] < rainBox.y0) resetDrop(i, rainBox.y1);
    }
    rainGeo.attributes.position.needsUpdate = true;
    streakTex.offset.y += dt * 0.12;

    // dust drift
    for (let i = 0; i < DUST; i++) {
      const s = dustSeed[i];
      dustPos[i * 3] += Math.sin(t * 0.3 + s) * 0.036 * dt;
      dustPos[i * 3 + 1] += (Math.cos(t * 0.2 + s * 1.3) * 0.03 - 0.005) * dt;
      if (dustPos[i * 3 + 1] < 0.8) dustPos[i * 3 + 1] = 2.2;
    }
    dustGeo.attributes.position.needsUpdate = true;

    // screen flicker and phone notification pulse
    laptopLight.intensity = 4.5 * (1 + Math.sin(t * 7.3) * 0.015 + Math.sin(t * 13.1) * 0.01);
    const pulse = Math.max(0, Math.sin(t * 0.9)) ** 12;
    phoneScreenMat.color.setRGB(0.31 + pulse * 0.5, 0.84 + pulse * 0.16, 0.9 + pulse * 0.1);
    phoneLight.intensity = 0.15 + pulse * 0.6;

    // candle flame
    const cf = reducedMotion ? 0 : flickerNoise(t, 0);
    candleLight.intensity = 0.9 + cf * 0.18;
    flame.scale.set(1 - cf * 0.06, 2.3 + cf * 0.25, 1 - cf * 0.06);
    flame.position.x = Math.sin(t * 2.1) * 0.0015;

    // fairy lights breathe slowly, out of phase
    for (const { mesh, phase } of fairyBulbs) {
      for (let i = 0; i < phase.length; i++) {
        const k = reducedMotion ? 1 : 0.82 + 0.18 * Math.sin(t * 0.8 + phase[i]);
        mesh.setColorAt(i, bulbColor.copy(BULB_COLOR).multiplyScalar(k));
      }
      mesh.instanceColor!.needsUpdate = true;
    }
    fairyLights.forEach((l, i) => (l.intensity = 0.8 + (reducedMotion ? 0 : Math.sin(t * 0.8 + i * 1.7) * 0.06)));

    // subtle breathing
    person.update(t, reducedMotion);
    // the figure moves, so refresh shadow maps ~10 times a second rather than baking them once
    if (!reducedMotion && ++shadowTick % 6 === 0) renderer.shadowMap.needsUpdate = true;

    // distant lightning
    if (t > nextLightning) {
      lightning = 1;
      nextLightning = t + rr(12, 24);
    }
    if (lightning > 0) {
      lightning = Math.max(0, lightning - dt * 2.2);
      const strobe = lightning * (0.6 + 0.4 * Math.sin(lightning * 40));
      cityMat.color.copy(baseCity).multiplyScalar(1 + strobe * 1.2);
      windowLight.intensity = 1.8 + strobe * 10;
      moon.intensity = 0.3 + strobe * 2;
    }

    // camera
    pointer.lerp(pointerTarget, damp(3, dt));
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / tween.dur);
      const x = tween.t;
      const e = x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
      camera.position.lerpVectors(tween.from, tween.to, e);
      controls.target.lerpVectors(tween.tFrom, tween.tTo, e);
      camera.fov = THREE.MathUtils.lerp(tween.fovFrom, tween.fovTo, e);
      camera.updateProjectionMatrix();
      camera.lookAt(controls.target);
      if (tween.t >= 1) {
        tween = null;
        if (view === "explore") controls.enabled = true;
        else {
          doorway.visible = true;
          renderer.shadowMap.needsUpdate = true;
        }
      }
    } else if (view === "doorway") {
      // leaning in the doorway: cursor parallax plus a slow idle drift
      const m = reducedMotion ? 0 : 1;
      desired.copy(VIEWS.doorway.pos);
      desired.x += (pointer.x * 0.2 + Math.sin(t * 0.21) * 0.04) * m;
      desired.y += (-pointer.y * 0.1 + Math.sin(t * 0.17) * 0.02) * m;
      camera.position.lerp(desired, damp(2.5, dt));
      lookTarget.copy(VIEWS.doorway.target);
      lookTarget.x += pointer.x * 0.28 * m;
      lookTarget.y += -pointer.y * 0.12 * m;
      controls.target.lerp(lookTarget, damp(2.5, dt));
      camera.lookAt(controls.target);
    } else {
      controls.update(dt);
      camera.position.clamp(clampMin, clampMax);
    }

    composer.render(dt);
  };

  // Compile every shader before the first frame so the scene opens without a hitch
  let disposed = false;
  renderer
    .compileAsync(scene, camera)
    .catch(() => undefined)
    .then(() => {
      if (disposed) return;
      clock.start();
      animate();
    });

  return {
    setView,
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      controls.dispose();
      composer.dispose();
      rt.dispose();
      disposables.forEach((d) => d.dispose());
      scene.traverse((o) => {
        if (o instanceof THREE.InstancedMesh) o.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
