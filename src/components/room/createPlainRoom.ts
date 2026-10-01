import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createCampus } from "./createCampus";
import { createFurniture, paintTexture } from "./createFurniture";
import { CLOSET, COLORS, DOOR, HERO, LAYOUT, ROOM, WINDOW } from "./roomLayout";

/**
 * A plain recreation of the real room: the shell, furniture and night lighting, with orbit
 * controls. Walls between the camera and the room hide themselves, so orbiting out gives a
 * dollhouse view. The floor lamp can be switched, dimmed and recoloured, and the binoculars on
 * the window sill look out at Western's campus.
 */

export type PlainRoomView = "photo" | "window" | "dollhouse" | "desk" | "door" | "binoculars";
type CameraView = Exclude<PlainRoomView, "binoculars">;

export interface LampSettings {
  on: boolean;
  /** 0.15 (dim) to 1.5 (bright); 1 is the lamp as photographed */
  brightness: number;
  /** bulb colour as a hex string */
  color: string;
}

export const LAMP_DEFAULT: LampSettings = { on: true, brightness: 1, color: "#ffd6a0" };

/** bulb colours offered in the lamp panel */
export const LAMP_COLORS: [string, string][] = [
  ["Warm white", "#ffd6a0"],
  ["Soft white", "#ffe8cc"],
  ["Daylight", "#eef2ff"],
  ["Amber", "#ffa95c"],
  ["Western purple", "#a47bff"],
  ["Ice blue", "#8fd0ff"],
  ["Rose", "#ff8fb4"],
];

export interface PlainRoomOptions {
  initialLamp?: Partial<LampSettings>;
  /** fires whenever the lamp's settings change, including by clicking the lamp */
  onLampChange?: (settings: LampSettings) => void;
  /** fires when the view changes, including by clicking the binoculars */
  onViewChange?: (view: PlainRoomView) => void;
  /** the campus landmark nearest the middle of the binoculars, or null */
  onScopeTarget?: (landmark: { name: string; detail: string } | null) => void;
}

export interface PlainRoomHandle {
  setView: (view: PlainRoomView) => void;
  /** switch the floor lamp; it fades like a real bulb. Returns the new state. */
  toggleLamp: () => boolean;
  /** change any lamp settings; the light fades to them */
  setLamp: (settings: Partial<LampSettings>) => void;
  dispose: () => void;
}

const vec = (v: [number, number, number]) => new THREE.Vector3(...v);

// camera poses; the photo view keeps the hero framing but pivots about a point inside the room
const heroPos = vec(HERO.pos);
const heroDir = vec(HERO.target).sub(heroPos).normalize();
const VIEWS: Record<CameraView, { pos: THREE.Vector3; target: THREE.Vector3 }> = {
  photo: { pos: heroPos, target: heroPos.clone().addScaledVector(heroDir, 2.2) },
  // close up on the window sill and the perfume shelf, from beside the bed
  window: { pos: new THREE.Vector3(0.25, 1.38, -0.55), target: new THREE.Vector3(-0.15, 1.0, -1.7) },
  dollhouse: { pos: new THREE.Vector3(-3.4, 4.8, ROOM.midZ + 4.7), target: new THREE.Vector3(0.1, 0.5, ROOM.midZ) },
  // matches photo F: from the foot of the bed, looking into the corner with the lamp and the end of the desk
  desk: { pos: new THREE.Vector3(-0.15, 1.7, 0.6), target: new THREE.Vector3(1.0, 0.3, -1.2) },
  // matches photo E: from beside the desk, looking at the entry door and the closet
  door: { pos: new THREE.Vector3(0.35, 1.5, -0.45), target: new THREE.Vector3(0.0, 1.0, ROOM.front) },
};

export function createPlainRoom(container: HTMLElement, options: PlainRoomOptions = {}): PlainRoomHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  // soft variance shadows, blurred so the lamp's shadows fall off gently the way a shaded bulb's do
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);
  RectAreaLightUniformsLib.init();

  // a small studio environment, used only as reflections on glass and polished metal
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  const env = pmrem.fromScene(envScene, 0.04).texture;
  envScene.dispose();
  pmrem.dispose();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0d0e11");

  const camera = new THREE.PerspectiveCamera(HERO.fov, container.clientWidth / container.clientHeight, 0.03, 60);
  camera.position.copy(VIEWS.photo.pos);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(VIEWS.photo.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.4;
  controls.maxDistance = 9;
  controls.maxPolarAngle = Math.PI * 0.53;
  controls.update();

  // ---------- shell ----------
  const { left, right, back, front, height, wall: t } = ROOM;
  const W = ROOM.width;
  const D = ROOM.depth;
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const slab = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D) => {
    const mesh = new THREE.Mesh(unitBox, m);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  /** a wall in its own plane (x across, y up, thickness toward -z) with rectangular openings, as one seamless mesh */
  const pierced = (x0: number, x1: number, holes: { x0: number; x1: number; y0: number; y1: number }[]) => {
    const shape = new THREE.Shape().moveTo(x0, 0).lineTo(x1, 0).lineTo(x1, height).lineTo(x0, height).lineTo(x0, 0);
    for (const h of holes) shape.holes.push(new THREE.Path().moveTo(h.x0, h.y0).lineTo(h.x0, h.y1).lineTo(h.x1, h.y1).lineTo(h.x1, h.y0).lineTo(h.x0, h.y0));
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false }), wallMat);
    mesh.receiveShadow = mesh.castShadow = true;
    return mesh;
  };

  const carpet = paintTexture(512, 512, (c, w, h) => {
    c.fillStyle = COLORS.carpet;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = COLORS.carpetGrid;
    c.lineWidth = 3;
    for (let i = 0; i <= 16; i++) {
      c.beginPath();
      c.moveTo((i * w) / 16, 0);
      c.lineTo((i * w) / 16, h);
      c.moveTo(0, (i * h) / 16);
      c.lineTo(w, (i * h) / 16);
      c.stroke();
    }
    for (let i = 0; i < 9000; i++) {
      c.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.12)";
      c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  }, [W * 2, D * 2]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: carpet, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = ROOM.midZ;
  floor.receiveShadow = true;
  scene.add(floor);

  const popcorn = paintTexture(512, 512, (c, w, h) => {
    c.fillStyle = COLORS.ceiling;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 14000; i++) {
      c.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.25)" : "rgba(90,80,70,0.18)";
      c.beginPath();
      c.arc(Math.random() * w, Math.random() * h, Math.random() * 2.2 + 0.4, 0, Math.PI * 2);
      c.fill();
    }
  }, [3, 3]);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: popcorn, bumpMap: popcorn, bumpScale: 1.5, roughness: 1 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, height, ROOM.midZ);
  scene.add(ceiling);

  const wallMat = new THREE.MeshStandardMaterial({ color: COLORS.wall, roughness: 0.85 });
  const trim = new THREE.MeshStandardMaterial({ color: COLORS.trim, roughness: 0.5 });
  const walls: { group: THREE.Group; point: THREE.Vector3; inward: THREE.Vector3 }[] = [];
  const wallGroup = (point: THREE.Vector3, inward: THREE.Vector3) => {
    const group = new THREE.Group();
    scene.add(group);
    walls.push({ group, point, inward });
    return group;
  };

  // back wall with the window opening, frame, sill and the blackout blind
  const backWall = wallGroup(new THREE.Vector3(0, 0, back), new THREE.Vector3(0, 0, 1));
  {
    const bz = back - t / 2;
    const { x0, x1, y0, y1 } = WINDOW;
    const wallMesh = pierced(left - t, right + t, [WINDOW]);
    wallMesh.position.z = back - t;
    backWall.add(wallMesh);
    const winMat = new THREE.MeshStandardMaterial({ color: "#e8e6e0", roughness: 0.45 });
    const f = 0.04;
    slab(x1 - x0 + 0.02, 0.02, t + 0.04, winMat, (x0 + x1) / 2, y0 - 0.01, bz + 0.02, backWall); // sill
    slab(x1 - x0, f, 0.05, winMat, (x0 + x1) / 2, y1 - f / 2, back - t + 0.03, backWall);
    slab(f, y1 - y0, 0.05, winMat, x0 + f / 2, (y0 + y1) / 2, back - t + 0.03, backWall);
    slab(f, y1 - y0, 0.05, winMat, x1 - f / 2, (y0 + y1) / 2, back - t + 0.03, backWall);
    // the glass: a faint cool sheen, so the opening reads as a window rather than a hole
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), new THREE.MeshBasicMaterial({ color: "#a8c0ff", transparent: true, opacity: 0.06, depthWrite: false }));
    glass.position.set((x0 + x1) / 2, (y0 + y1) / 2, back - t + 0.03);
    backWall.add(glass);
    slab(0.03, y1 - y0, 0.04, winMat, (x0 + x1) / 2, (y0 + y1) / 2, back - t + 0.03, backWall); // mullion
    // blind: cassette at the top, fabric rolled most of the way up
    const blindH = (y1 - y0) * WINDOW.blindDown;
    slab(x1 - x0 - 0.02, 0.07, 0.07, new THREE.MeshStandardMaterial({ color: "#ecebe6", roughness: 0.5 }), (x0 + x1) / 2, y1 - 0.035, back - t + 0.09, backWall);
    const blind = slab(x1 - x0 - 0.05, blindH - 0.07, 0.004, new THREE.MeshStandardMaterial({ color: COLORS.blind, roughness: 0.9 }), (x0 + x1) / 2, y1 - 0.07 - (blindH - 0.07) / 2, back - t + 0.08, backWall);
    blind.castShadow = false;
    slab(x1 - x0 - 0.04, 0.012, 0.02, new THREE.MeshStandardMaterial({ color: "#b9b9b9", roughness: 0.4, metalness: 0.6 }), (x0 + x1) / 2, y1 - blindH, back - t + 0.08, backWall);
    slab(W, 0.1, 0.015, trim, 0, 0.05, back + 0.0075, backWall);
  }

  // the night sky outside, painted once: deep blue overhead, a city glow low down, stars, the moon,
  // and a dark line of trees and rooftops. Seen only through the window, so hidden from outside the room.
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 5),
    new THREE.MeshBasicMaterial({
      map: paintTexture(1536, 860, (c, w, h) => {
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, "#050a1c");
        g.addColorStop(0.45, "#102047");
        g.addColorStop(0.75, "#2d3b6b");
        g.addColorStop(0.9, "#6a5a78");
        g.addColorStop(1, "#b07a62");
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
        for (let i = 0; i < 700; i++) {
          const y = Math.random() ** 1.6 * h * 0.7;
          c.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.75 * (1 - y / h)})`;
          const r = Math.random() < 0.06 ? 1.6 : 0.8;
          c.beginPath();
          c.arc(Math.random() * w, y, r, 0, Math.PI * 2);
          c.fill();
        }
        // the moon with a soft halo, up and to the left of centre
        const mx = w * 0.42;
        const my = h * 0.24;
        const halo = c.createRadialGradient(mx, my, 10, mx, my, 120);
        halo.addColorStop(0, "rgba(220,230,255,0.45)");
        halo.addColorStop(1, "rgba(220,230,255,0)");
        c.fillStyle = halo;
        c.fillRect(mx - 130, my - 130, 260, 260);
        c.fillStyle = "#f3f1e6";
        c.beginPath();
        c.arc(mx, my, 26, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "rgba(170,165,150,0.35)";
        for (const [dx, dy, r] of [[-8, -6, 6], [7, 5, 5], [2, -12, 3], [-4, 10, 4]]) {
          c.beginPath();
          c.arc(mx + dx, my + dy, r, 0, Math.PI * 2);
          c.fill();
        }
        // rooftops with a few lit windows, then trees in front
        let x = 0;
        while (x < w) {
          const bw = 60 + Math.random() * 140;
          const bh = h * (0.06 + Math.random() * 0.12);
          c.fillStyle = "#0b0d16";
          c.fillRect(x, h - bh - h * 0.08, bw, bh + h * 0.08);
          for (let k = 0; k < bw * bh * 0.0012; k++) {
            c.fillStyle = Math.random() > 0.3 ? "rgba(255,200,120,0.85)" : "rgba(180,210,255,0.7)";
            c.fillRect(x + 6 + Math.random() * (bw - 16), h - bh - h * 0.06 + Math.random() * bh * 0.8, 6, 8);
          }
          x += bw + Math.random() * 30;
        }
        c.fillStyle = "#05070c";
        for (let i = 0; i < 70; i++) {
          const tx = Math.random() * w;
          const tr = 30 + Math.random() * 60;
          c.beginPath();
          c.arc(tx, h - h * 0.04 - Math.random() * 30, tr, 0, Math.PI * 2);
          c.fill();
        }
        c.fillRect(0, h - h * 0.05, w, h * 0.05);
      }),
      toneMapped: false,
      fog: false,
    }),
  );
  sky.position.set((WINDOW.x0 + WINDOW.x1) / 2, 1.9, back - t - 3);
  scene.add(sky);

  // side walls, each with its skirting board
  const leftWall = wallGroup(new THREE.Vector3(left, 0, 0), new THREE.Vector3(1, 0, 0));
  slab(t, height, D + t * 2, wallMat, left - t / 2, height / 2, ROOM.midZ, leftWall);
  slab(0.015, 0.1, D, trim, left + 0.0075, 0.05, ROOM.midZ, leftWall);
  const rightWall = wallGroup(new THREE.Vector3(right, 0, 0), new THREE.Vector3(-1, 0, 0));
  slab(t, height, D + t * 2, wallMat, right + t / 2, height / 2, ROOM.midZ, rightWall);
  slab(0.015, 0.1, D, trim, right - 0.0075, 0.05, ROOM.midZ, rightWall);

  // front wall: the entry door in an alcove by the desk wall, and the closet jutting out beside it
  const frontWall = wallGroup(new THREE.Vector3(0, 0, front), new THREE.Vector3(0, 0, -1));
  {
    const closetZ = front - CLOSET.depth;
    const doorMat = new THREE.MeshStandardMaterial({ color: "#f1efea", roughness: 0.45 });
    // satin nickel; kept low on metalness since the scene has no reflections to show
    const steelMat = new THREE.MeshStandardMaterial({ color: "#b4b7bb", metalness: 0.8, roughness: 0.3, envMap: env, envMapIntensity: 0.7 });
    /** casing around an opening, on the room side of a wall whose room face is at z */
    const casing = (x0: number, x1: number, h: number, z: number) => {
      for (const x of [x0 - 0.035, x1 + 0.035]) slab(0.07, h + 0.035, 0.015, trim, x, (h + 0.035) / 2, z - 0.0075, frontWall);
      slab(x1 - x0 + 0.14, 0.07, 0.015, trim, (x0 + x1) / 2, h + 0.035, z - 0.0075, frontWall);
    };
    /** a lever handle on a door face at z, its bar pointing along x by `dir` */
    const lever = (x: number, y: number, z: number, dir: number) => {
      const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 20), steelMat);
      rose.rotation.x = Math.PI / 2;
      rose.position.set(x, y, z - 0.006);
      frontWall.add(rose);
      slab(0.012, 0.012, 0.05, steelMat, x, y, z - 0.03, frontWall);
      slab(0.11, 0.016, 0.014, steelMat, x + dir * 0.05, y, z - 0.055, frontWall);
    };
    const hinges = (x: number, z: number, h: number) => {
      for (const y of [0.22, h / 2, h - 0.22]) slab(0.014, 0.09, 0.012, steelMat, x, y, z - 0.004, frontWall);
    };

    // entry door, hinged on the desk-wall side, with a deadbolt above the lever
    const doorWall = pierced(CLOSET.x1 - t, right + t, [{ x0: DOOR.x0, x1: DOOR.x1, y0: 0, y1: DOOR.h }]);
    doorWall.position.z = front;
    frontWall.add(doorWall);
    const entry = paintTexture(256, 640, (c, w, h) => {
      c.fillStyle = "#f1efea";
      c.fillRect(0, 0, w, h);
      c.strokeStyle = "rgba(0,0,0,0.05)";
      c.lineWidth = 2;
      c.strokeRect(w * 0.14, h * 0.07, w * 0.72, h * 0.38);
      c.strokeRect(w * 0.14, h * 0.55, w * 0.72, h * 0.38);
    });
    slab(DOOR.x1 - DOOR.x0, DOOR.h, 0.04, new THREE.MeshStandardMaterial({ map: entry, roughness: 0.4 }), (DOOR.x0 + DOOR.x1) / 2, DOOR.h / 2, front + 0.03, frontWall);
    casing(DOOR.x0, DOOR.x1, DOOR.h, front);
    hinges(DOOR.x1 - 0.005, front + 0.01, DOOR.h);
    lever(DOOR.x0 + 0.08, 0.98, front + 0.01, 1);
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 24), steelMat);
    bolt.rotation.x = Math.PI / 2;
    bolt.scale.set(0.8, 1, 1.15);
    bolt.position.set(DOOR.x0 + 0.08, 1.24, front + 0.004);
    frontWall.add(bolt);

    // the closet: a side face toward the alcove and a front face with two six-panel doors
    // starts behind the front face so the two never share a face
    slab(t, height, CLOSET.depth - t, wallMat, CLOSET.x1 - t / 2, height / 2, closetZ + t + (CLOSET.depth - t) / 2, frontWall);
    const closetFront = pierced(left - t, CLOSET.x1, [{ x0: CLOSET.doorX0, x1: CLOSET.doorX1, y0: 0, y1: CLOSET.doorH }]);
    closetFront.position.z = closetZ;
    frontWall.add(closetFront);
    const leafW = (CLOSET.doorX1 - CLOSET.doorX0) / 2;
    const sixPanel = paintTexture(256, 860, (c, w, h) => {
      c.fillStyle = "#f2f0ea";
      c.fillRect(0, 0, w, h);
      // faint embossed wood grain
      for (let i = 0; i < 260; i++) {
        c.strokeStyle = `rgba(0,0,0,${0.012 + Math.random() * 0.02})`;
        c.lineWidth = 1;
        const x = Math.random() * w;
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x + Math.random() * 6 - 3, h);
        c.stroke();
      }
      // raised panels: shadow on the top and left edges, light on the bottom and right
      const panel = (x: number, y: number, pw: number, ph: number) => {
        c.lineWidth = 5;
        c.strokeStyle = "rgba(0,0,0,0.13)";
        c.beginPath();
        c.moveTo(x, y + ph);
        c.lineTo(x, y);
        c.lineTo(x + pw, y);
        c.stroke();
        c.strokeStyle = "rgba(255,255,255,0.7)";
        c.beginPath();
        c.moveTo(x + pw, y);
        c.lineTo(x + pw, y + ph);
        c.lineTo(x, y + ph);
        c.stroke();
        c.lineWidth = 2;
        c.strokeStyle = "rgba(0,0,0,0.07)";
        c.strokeRect(x + 12, y + 12, pw - 24, ph - 24);
      };
      for (const col of [0, 1]) {
        const x = w * (0.1 + col * 0.46);
        const pw = w * 0.34;
        panel(x, h * 0.05, pw, h * 0.14);
        panel(x, h * 0.25, pw, h * 0.3);
        panel(x, h * 0.6, pw, h * 0.34);
      }
    });
    const leafMat = new THREE.MeshStandardMaterial({ map: sixPanel, bumpMap: sixPanel, bumpScale: 2, roughness: 0.5 });
    for (const s of [-1, 1]) {
      const cx = (CLOSET.doorX0 + CLOSET.doorX1) / 2 + s * (leafW / 2 + 0.002);
      slab(leafW - 0.006, CLOSET.doorH, 0.035, leafMat, cx, CLOSET.doorH / 2, closetZ + 0.03, frontWall);
      // lever beside the centre seam, its bar pointing toward the leaf's hinge
      lever(cx - s * (leafW / 2 - 0.07), 1.0, closetZ + 0.0125, s);
      hinges(cx + s * (leafW / 2 - 0.004), closetZ + 0.012, CLOSET.doorH);
    }
    casing(CLOSET.doorX0, CLOSET.doorX1, CLOSET.doorH, closetZ);
    // dark closet interior, seen only through the seam
    const inside = new THREE.Mesh(new THREE.PlaneGeometry(CLOSET.doorX1 - CLOSET.doorX0, CLOSET.doorH), new THREE.MeshBasicMaterial({ color: "#121212" }));
    inside.position.set((CLOSET.doorX0 + CLOSET.doorX1) / 2, CLOSET.doorH / 2, front - 0.01);
    inside.rotation.y = Math.PI;
    frontWall.add(inside);

    // skirting boards along the closet front, its side, and the alcove wall either side of the door
    slab(CLOSET.doorX0 - 0.07 - left, 0.1, 0.015, trim, (left + CLOSET.doorX0 - 0.07) / 2, 0.05, closetZ - 0.0075, frontWall);
    slab(CLOSET.x1 - CLOSET.doorX1 - 0.07, 0.1, 0.015, trim, (CLOSET.doorX1 + 0.07 + CLOSET.x1) / 2, 0.05, closetZ - 0.0075, frontWall);
    slab(0.015, 0.1, CLOSET.depth, trim, CLOSET.x1 + 0.0075, 0.05, closetZ + CLOSET.depth / 2, frontWall);
    slab(DOOR.x0 - 0.07 - CLOSET.x1, 0.1, 0.015, trim, (CLOSET.x1 + DOOR.x0 - 0.07) / 2, 0.05, front - 0.0075, frontWall);
    slab(right - DOOR.x1 - 0.07, 0.1, 0.015, trim, (DOOR.x1 + 0.07 + right) / 2, 0.05, front - 0.0075, frontWall);
  }

  // ceiling light (off) and the sprinkler head
  {
    const { pos, r } = LAYOUT.ceilingLight;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#f4f1ea", roughness: 0.3 }));
    dome.scale.y = 0.35;
    dome.rotation.x = Math.PI;
    dome.position.set(pos[0], height, pos[2]);
    scene.add(dome);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.98, 0.012, 8, 48), new THREE.MeshStandardMaterial({ color: "#9c9fa3", metalness: 0.8, roughness: 0.35 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(pos[0], height - 0.03, pos[2]);
    scene.add(ring);
    const sp = LAYOUT.sprinkler.pos;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.015, 24), new THREE.MeshStandardMaterial({ color: "#f0efeb", roughness: 0.5 }));
    head.position.set(sp[0], height - 0.008, sp[2]);
    scene.add(head);
  }

  const furniture = createFurniture(env);
  scene.add(furniture.group);

  // ---------- night lighting ----------
  const hemi = new THREE.HemisphereLight("#fff1dc", "#3b352e", 0.9);
  scene.add(hemi);
  // cool moonlight through the open window, falling across the bed
  const moon = new THREE.SpotLight("#9fb4ff", 3, 6, 0.45, 0.9, 1.2);
  moon.position.set((WINDOW.x0 + WINDOW.x1) / 2 + 0.3, 2.6, back - 1.2);
  moon.target.position.set(-0.6, 0.4, -0.4);
  scene.add(moon, moon.target);
  // light bouncing off the pale walls and ceiling: a soft, shadowless fill from above the room
  const bounce = new THREE.PointLight("#ffe2c0", 1.4, 0, 1.2);
  bounce.position.set(0.1, height - 0.3, ROOM.midZ);
  scene.add(bounce);

  // The floor lamp. A drum shade sends most light out of its open bottom and top, and only a soft
  // glow through the fabric, so it's three lights: a shadowed cone down, a cone up the corner, and a
  // dim shadowless glow. (One shadowed point light threw hard shadows of the desk across every wall.)
  const bulb = furniture.lamp.bulb;
  const downLight = new THREE.SpotLight("#ffd6a0", 7, 0, 1.1, 0.75, 1.5);
  downLight.position.copy(bulb);
  downLight.target.position.copy(bulb).add(new THREE.Vector3(0, -2, 0));
  downLight.castShadow = true;
  downLight.shadow.mapSize.set(1024, 1024);
  downLight.shadow.camera.near = 0.05;
  downLight.shadow.camera.far = 6;
  downLight.shadow.radius = 7;
  downLight.shadow.blurSamples = 16;
  downLight.shadow.bias = -0.0004;
  downLight.shadow.normalBias = 0.02;
  scene.add(downLight, downLight.target);
  const upLight = new THREE.SpotLight("#ffd6a0", 6, 2.4, 0.8, 0.85, 1.5);
  upLight.position.copy(bulb).add(new THREE.Vector3(0, 0.1, 0));
  upLight.target.position.copy(bulb).add(new THREE.Vector3(0, 2, 0));
  scene.add(upLight, upLight.target);
  const glowLight = new THREE.PointLight("#ffd6a0", 2.2, 0, 1.6);
  glowLight.position.copy(bulb);
  scene.add(glowLight);

  // ---------- the lamp switch and its settings ----------
  // Every change fades: switching on is quick, switching off leaves a short filament glow, and
  // colour and brightness glide to their new values.
  const lampSettings: LampSettings = { ...LAMP_DEFAULT, ...options.initialLamp };
  let lampLevel = lampSettings.on ? lampSettings.brightness : 0;
  const lampColor = new THREE.Color(lampSettings.color);
  const lampColorTarget = lampColor.clone();
  const warmWhite = new THREE.Color("#ffe2c0");
  const bounceColor = new THREE.Color();
  const applyLamp = () => {
    const k = lampLevel;
    for (const l of [downLight, upLight, glowLight]) l.color.copy(lampColor);
    downLight.intensity = 7 * k;
    upLight.intensity = 6 * k;
    glowLight.intensity = 2.2 * k;
    // the walls bounce less light, and the room falls back on the screens and the moon
    bounce.intensity = 0.25 + 1.15 * k;
    bounce.color.copy(bounceColor.copy(warmWhite).lerp(lampColor, 0.6));
    hemi.intensity = 0.25 + 0.65 * Math.min(k, 1.2);
    furniture.lamp.setGlow(k, lampColor);
  };
  applyLamp();
  const setLamp = (next: Partial<LampSettings>) => {
    Object.assign(lampSettings, next);
    lampSettings.brightness = THREE.MathUtils.clamp(lampSettings.brightness, 0.15, 1.5);
    lampColorTarget.set(lampSettings.color);
    options.onLampChange?.({ ...lampSettings });
  };
  const toggleLamp = () => {
    setLamp({ on: !lampSettings.on });
    return lampSettings.on;
  };

  for (const s of furniture.screens) {
    const area = new THREE.RectAreaLight(s.color, s.strength, s.w, s.h);
    area.position.copy(s.center);
    area.lookAt(s.center.clone().add(s.normal));
    scene.add(area);
  }

  // ---------- Western's campus, seen only through the binoculars ----------
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(d: T) => {
    disposables.push(d);
    return d;
  };
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const campus = createCampus(track, rand);
  campus.group.visible = false;
  scene.add(campus.group);
  // a clear night, matching the sky painted outside the window
  const campusFog = campus.setConditions({ day: 0, dusk: 0, weather: "clear" });
  const outsideFog = new THREE.FogExp2(campusFog.fogColor, campusFog.fogDensity);

  // The mask: two overlapping round fields with darkened rims, drawn over the frame
  const maskMat = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: { uAspect: { value: 1 }, uRadius: { value: 0.42 }, uMask: { value: 0 }, uFade: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uAspect; uniform float uRadius; uniform float uMask; uniform float uFade; varying vec2 vUv;
      void main() {
        vec2 d = (vUv - 0.5) * vec2(uAspect, 1.0);
        float R = uRadius;
        float sep = R * 0.48;
        float r = min(length(d - vec2(-sep, 0.0)), length(d - vec2(sep, 0.0)));
        float inside = smoothstep(R, R - 0.012, r) * (0.6 + 0.4 * smoothstep(R, R * 0.6, r));
        float seen = mix(1.0, inside, uMask) * (1.0 - uFade);
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0 - seen);
      }`,
  });
  const overlay = new THREE.Scene();
  const overlayQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), maskMat);
  overlayQuad.frustumCulled = false;
  overlay.add(overlayQuad);
  const overlayCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // the binocular camera sits just outside the glass, so the window frame never crosses the view
  const binos = furniture.binoculars;
  const scopePos = new THREE.Vector3((WINDOW.x0 + WINDOW.x1) / 2, (WINDOW.y0 + WINDOW.y1) / 2, back - t - 0.35);
  const aimAt = (p: THREE.Vector3) => {
    const d = p.clone().sub(scopePos).normalize();
    return { yaw: Math.atan2(d.x, -d.z), pitch: Math.asin(d.y) };
  };
  // binoculars magnify less than the telescope did, so the settled field is a little wider
  const SCOPE_FOV = 13;
  const home = aimAt(campus.landmarks[0].position.clone().add(new THREE.Vector3(0, -4, 0)));
  const outward = aimAt(scopePos.clone().addScaledVector(binos.direction, 100));
  const scope = { yaw: home.yaw, yawT: home.yaw, pitch: home.pitch, pitchT: home.pitch, fov: SCOPE_FOV, fovT: SCOPE_FOV };
  // end the glide just behind the eyecups, looking along the binoculars and out of the window
  const eyePose = {
    pos: binos.position.clone().addScaledVector(binos.direction, -0.3).add(new THREE.Vector3(0, 0.07, 0)),
    target: binos.position.clone().addScaledVector(binos.direction, 4).add(new THREE.Vector3(0, 0.25, 0)),
  };
  const ZOOM_FROM_FOV = 58;
  let zoom: { t: number; dur: number } | null = null;
  let currentLandmark: string | null = null;
  const scopeLook = new THREE.Vector3();
  const updateScope = (dt: number) => {
    const fit = Math.min(1, camera.aspect / 1.5); // keep both fields on narrow screens
    if (zoom) {
      zoom.t = Math.min(1, zoom.t + dt / zoom.dur);
      const x = zoom.t;
      const e = x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
      // aim swings from straight out of the window onto the school while the field narrows
      const ea = 1 - (1 - Math.min(1, x * 1.4)) ** 3;
      scope.yaw = scope.yawT = THREE.MathUtils.lerp(outward.yaw, home.yaw, ea);
      scope.pitch = scope.pitchT = THREE.MathUtils.lerp(outward.pitch, home.pitch, ea);
      scope.fov = scope.fovT = THREE.MathUtils.lerp(ZOOM_FROM_FOV, SCOPE_FOV, e);
      maskMat.uniforms.uRadius.value = THREE.MathUtils.lerp(1.6, 0.6 * fit, e);
      if (zoom.t >= 1) zoom = null;
    } else maskMat.uniforms.uRadius.value = 0.6 * fit;
    scope.yaw += (scope.yawT - scope.yaw) * (1 - Math.exp(-8 * dt));
    scope.pitch += (scope.pitchT - scope.pitch) * (1 - Math.exp(-8 * dt));
    scope.fov += (scope.fovT - scope.fov) * (1 - Math.exp(-6 * dt));
    camera.position.copy(scopePos);
    scopeLook.set(Math.sin(scope.yaw) * Math.cos(scope.pitch), Math.sin(scope.pitch), -Math.cos(scope.yaw) * Math.cos(scope.pitch));
    camera.lookAt(scopeLook.clone().add(scopePos));
    camera.fov = scope.fov;
    camera.updateProjectionMatrix();
    // name what's in the middle of the view
    let best: (typeof campus.landmarks)[number] | null = null;
    let bestAngle = THREE.MathUtils.degToRad(scope.fov) * 0.45;
    for (const l of campus.landmarks) {
      const a = scopeLook.angleTo(l.position.clone().sub(scopePos));
      if (a < bestAngle) {
        bestAngle = a;
        best = l;
      }
    }
    const name = best?.name ?? null;
    if (name !== currentLandmark) {
      currentLandmark = name;
      options.onScopeTarget?.(best ? { name: best.name, detail: best.detail } : null);
    }
  };

  // ---------- views ----------
  type Mode = "room" | "toBinoculars" | "binoculars";
  let mode: Mode = "room";
  let roomView: CameraView = "photo";
  let returnPose = { pos: VIEWS.photo.pos.clone(), target: VIEWS.photo.target.clone() };
  let baseFov = HERO.fov;
  let tween: { fromPos: THREE.Vector3; fromTarget: THREE.Vector3; toPos: THREE.Vector3; toTarget: THREE.Vector3; t: number; dur: number; done?: () => void } | null = null;
  // a quick dip to black, used to cut between the room and the view through the binoculars
  let fade: { t: number; mid: () => void; fired: boolean } | null = null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const moveTo = (pos: THREE.Vector3, target: THREE.Vector3, done?: () => void) => {
    if (reducedMotion) {
      camera.position.copy(pos);
      controls.target.copy(target);
      done?.();
      return;
    }
    tween = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), toPos: pos.clone(), toTarget: target.clone(), t: 0, dur: 1.4, done };
  };
  const cutWithFade = (mid: () => void) => {
    if (reducedMotion) mid();
    else fade = { t: 0, mid, fired: false };
  };

  const startBinoculars = () => {
    mode = "binoculars";
    campus.group.visible = true;
    sky.visible = false;
    scene.fog = outsideFog;
    camera.near = 1;
    camera.far = 1500;
    maskMat.uniforms.uMask.value = 1;
    zoom = { t: 0, dur: reducedMotion ? 0.01 : 2.6 };
    updateScope(0);
  };
  const enterBinoculars = () => {
    if (mode !== "room") return;
    returnPose = { pos: camera.position.clone(), target: controls.target.clone() };
    mode = "toBinoculars";
    controls.enabled = false;
    options.onViewChange?.("binoculars");
    moveTo(eyePose.pos, eyePose.target, () => cutWithFade(startBinoculars));
  };
  const leaveBinoculars = (then: CameraView) => {
    const returnToRoom = () => {
      mode = "room";
      zoom = null;
      campus.group.visible = false;
      scene.fog = null;
      maskMat.uniforms.uMask.value = 0;
      camera.near = 0.03;
      camera.far = 60;
      camera.fov = baseFov;
      camera.updateProjectionMatrix();
      camera.position.copy(eyePose.pos);
      controls.target.copy(eyePose.target);
      camera.lookAt(controls.target);
      currentLandmark = null;
      options.onScopeTarget?.(null);
      const to = then === roomView ? returnPose : VIEWS[then];
      roomView = then;
      moveTo(to.pos, to.target, () => (controls.enabled = true));
    };
    if (mode === "binoculars") cutWithFade(returnToRoom);
    else {
      tween = null;
      returnToRoom();
    }
    options.onViewChange?.(then);
  };
  const setView = (view: PlainRoomView) => {
    if (view === "binoculars") return enterBinoculars();
    if (mode !== "room") return leaveBinoculars(view);
    roomView = view;
    moveTo(VIEWS[view].pos, VIEWS[view].target);
    options.onViewChange?.(view);
  };
  controls.addEventListener("start", () => {
    if (mode === "room") tween = null;
  });

  // ---------- pointer: click the lamp or the binoculars; drag to aim through the binoculars ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickTarget = (e: PointerEvent): "lamp" | "binoculars" | null => {
    if (mode !== "room") return null;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(furniture.group.children, true).find((h) => (h.object as THREE.Mesh).isMesh);
    if (!hit) return null;
    if (furniture.lamp.parts.includes(hit.object)) return "lamp";
    if (binos.parts.includes(hit.object)) return "binoculars";
    return null;
  };
  // a press that drags (orbiting, aiming) isn't a click
  let downAt: { x: number; y: number } | null = null;
  let dragFrom: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => (downAt = dragFrom = { x: e.clientX, y: e.clientY });
  const onUp = (e: PointerEvent) => {
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6) {
      const hit = pickTarget(e);
      if (hit === "lamp") toggleLamp();
      else if (hit === "binoculars") enterBinoculars();
    }
    downAt = dragFrom = null;
  };
  const onMove = (e: PointerEvent) => {
    if (mode === "binoculars") {
      renderer.domElement.style.cursor = e.buttons ? "grabbing" : "grab";
      if (e.buttons && dragFrom && !zoom) {
        // the view follows the pointer, scaled to the current magnification
        const fovRad = THREE.MathUtils.degToRad(scope.fov);
        const h = renderer.domElement.clientHeight;
        scope.yawT = THREE.MathUtils.clamp(scope.yawT - ((e.clientX - dragFrom.x) / h) * fovRad, home.yaw - 0.6, home.yaw + 0.6);
        scope.pitchT = THREE.MathUtils.clamp(scope.pitchT + ((e.clientY - dragFrom.y) / h) * fovRad, -0.2, 0.3);
        dragFrom = { x: e.clientX, y: e.clientY };
      }
      return;
    }
    if (!e.buttons) renderer.domElement.style.cursor = pickTarget(e) ? "pointer" : "";
  };
  const onWheel = (e: WheelEvent) => {
    if (mode !== "binoculars") return;
    e.preventDefault();
    if (!zoom) scope.fovT = THREE.MathUtils.clamp(scope.fovT * Math.exp(e.deltaY * 0.0012), 2.5, 18);
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);
  renderer.domElement.addEventListener("pointermove", onMove);
  renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    maskMat.uniforms.uAspect.value = w / h;
    // keep the room's width in frame on narrow screens
    baseFov = w / h < 1 ? Math.min(90, HERO.fov * 1.35) : HERO.fov;
    if (mode !== "binoculars") camera.fov = baseFov;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(onResize);
  ro.observe(container);
  onResize();

  const clock = new THREE.Clock();
  const toCamera = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    const time = clock.elapsedTime;

    // lamp: level and colour chase their settings
    const lampTarget = lampSettings.on ? lampSettings.brightness : 0;
    const colorMoving = !lampColor.equals(lampColorTarget);
    if (lampLevel !== lampTarget || colorMoving) {
      const rate = lampTarget > lampLevel ? 18 : 9;
      lampLevel += (lampTarget - lampLevel) * (reducedMotion ? 1 : 1 - Math.exp(-rate * dt));
      if (Math.abs(lampTarget - lampLevel) < 0.002) lampLevel = lampTarget;
      lampColor.lerp(lampColorTarget, reducedMotion ? 1 : 1 - Math.exp(-6 * dt));
      const dc = Math.abs(lampColor.r - lampColorTarget.r) + Math.abs(lampColor.g - lampColorTarget.g) + Math.abs(lampColor.b - lampColorTarget.b);
      if (dc < 0.004) lampColor.copy(lampColorTarget);
      applyLamp();
    }

    if (fade) {
      fade.t = Math.min(1, fade.t + dt / 0.5);
      if (!fade.fired && fade.t >= 0.5) {
        fade.fired = true;
        fade.mid();
      }
      maskMat.uniforms.uFade.value = 1 - Math.abs(fade.t * 2 - 1);
      if (fade.t >= 1) {
        fade = null;
        maskMat.uniforms.uFade.value = 0;
      }
    }

    if (mode === "binoculars") {
      updateScope(dt);
      campus.update(time);
    } else {
      if (tween) {
        tween.t = Math.min(1, tween.t + dt / tween.dur);
        const e = tween.t < 0.5 ? 4 * tween.t ** 3 : 1 - (-2 * tween.t + 2) ** 3 / 2;
        camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
        controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e);
        if (tween.t >= 1) {
          const done = tween.done;
          tween = null;
          done?.();
        }
      }
      if (mode === "room") controls.update();
      else camera.lookAt(controls.target);
      // dollhouse cutaway: hide any wall the camera is behind, and the ceiling from above
      for (const w of walls) w.group.visible = toCamera.subVectors(camera.position, w.point).dot(w.inward) > -0.05;
      ceiling.visible = camera.position.y < height;
      const p = camera.position;
      sky.visible = p.x > left && p.x < right && p.z > back && p.z < front && p.y < height;
    }

    renderer.render(scene, camera);
    if (maskMat.uniforms.uMask.value > 0 || maskMat.uniforms.uFade.value > 0) {
      renderer.autoClear = false;
      renderer.render(overlay, overlayCam);
      renderer.autoClear = true;
    }
  });

  return {
    setView,
    toggleLamp,
    setLamp,
    dispose: () => {
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
          m.dispose();
        }
      });
      for (const d of disposables) d.dispose();
      env.dispose();
      overlayQuad.geometry.dispose();
      maskMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
