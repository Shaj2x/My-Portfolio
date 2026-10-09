import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { createAudio, RADIO_STATION, type Outside } from "./createAudio";
import { createCampus } from "./createCampus";
import { createFurniture, paintTexture } from "./createFurniture";
import { createSteam } from "./createDetails";
import posterTakeCare from "@/assets/poster-take-care.jpg";
import { PORTFOLIO_SPOTS, type PortfolioId } from "./portfolioSpots";
import { CLOSET, COLORS, DOOR, HERO, LAYOUT, ROOM, WINDOW } from "./roomLayout";

/**
 * A plain recreation of the real room: the shell, furniture and night lighting, with orbit
 * controls. Walls between the camera and the room hide themselves, so orbiting out gives a
 * dollhouse view. The floor lamp can be switched, dimmed and recoloured, and the binoculars on
 * the window sill look out at Western's campus.
 */

/** what you hear: levels (0..1) for the small sound effects and the ambience, and what's outside */
export interface SoundSettings {
  effects: number;
  ambience: number;
  outside: "breeze" | "rain" | "storm" | "snow";
}
export const DEFAULT_SOUND: SoundSettings = { effects: 1, ambience: 1, outside: "breeze" };
export const OUTSIDE_SOUNDS: [SoundSettings["outside"], string][] = [
  ["breeze", "Night breeze"],
  ["rain", "Rain"],
  ["storm", "Thunderstorm"],
  ["snow", "Snowy wind"],
];
const OUTSIDE_AUDIO: Record<SoundSettings["outside"], Outside> = { breeze: "clear", rain: "rain", storm: "storm", snow: "snow" };

/** the sky through the window: the visitor's own clock, or a fixed time of day */
export type SkyMode = "live" | "sunrise" | "day" | "sunset" | "night";
export const SKY_MODES: [SkyMode, string][] = [
  ["live", "Live (your time)"],
  ["sunrise", "Sunrise"],
  ["day", "Day"],
  ["sunset", "Sunset"],
  ["night", "Night"],
];

/** a project as the monitor shows it */
export interface MonitorProject {
  name: string;
  title: string;
  description?: string | null;
  /** a screenshot, if there is one */
  image?: string;
  status?: string;
}

export type PlainRoomView = "photo" | "window" | "dollhouse" | "desk" | "door" | "binoculars" | "console";
type CameraView = Exclude<PlainRoomView, "binoculars" | "console">;

/** the room's switchable lights: the floor lamp (dimmable, any colour), the ceiling light and the sunset lamp */
export interface LampSettings {
  on: boolean;
  /** 0.15 (dim) to 1.5 (bright); 1 is the lamp as photographed */
  brightness: number;
  /** bulb colour as a hex string */
  color: string;
  /** the flush ceiling light */
  ceiling: boolean;
  /** its tone as a hex string; one of CEILING_TONES */
  ceilingTone: string;
  /** the sunset lamp on the desk, projecting a disc onto the wall over the bed */
  sunset: boolean;
  /** which disc the sunset lamp projects; a key of SUNSET_STYLES */
  sunsetStyle: string;
  /** the ring lamp on the desk */
  desk: boolean;
  /** 0.2 to 1.5 */
  deskBrightness: number;
  /** its tone as a hex string; one of DESK_TONES */
  deskTone: string;
}

/** discs for the sunset lamp: colour stops from the centre outward */
export const SUNSET_STYLES: Record<string, string[]> = {
  Sunset: ["#ffc65e", "#ff8f2e", "#f2521c", "#b8182a"],
  Ember: ["#ffb347", "#ff7a1a", "#d9400f", "#8a1c08"],
  Sunrise: ["#fff3b0", "#ffbe6b", "#ff8aa6", "#c4549a"],
  Rainbow: ["#ffffff", "#ffe14d", "#48d16a", "#3a8bff", "#9a4dff", "#ff3d5a"],
  Moon: ["#ffffff", "#e6eeff", "#a9bcff", "#5d72c4"],
  Aurora: ["#c8ffe4", "#4fe3b0", "#36a2e8", "#7a4fdc"],
  Ocean: ["#e2fffa", "#63dbe4", "#1d8fcf", "#0c3d91"],
  "Western purple": ["#f0e4ff", "#bd94ff", "#8045e6", "#4b1a9e"],
};

/** tones for the ceiling light */
export const CEILING_TONES: [string, string][] = [
  ["Very warm", "#ffb46e"],
  ["Warm", "#ffdcb0"],
  ["Neutral", "#fff1dc"],
];

/** tones for the ring desk lamp */
export const DESK_TONES: [string, string][] = [
  ["Very warm", "#ffa95a"],
  ["Warm", "#ffd2a1"],
  ["Neutral", "#fff3e3"],
  ["Cool", "#e2edff"],
];

export const LAMP_DEFAULT: LampSettings = {
  on: true,
  brightness: 1,
  color: "#ffd6a0",
  ceiling: false,
  ceilingTone: "#fff1dc",
  sunset: false,
  sunsetStyle: "Sunset",
  desk: false,
  deskBrightness: 1,
  deskTone: "#fff3e3",
};

/** bulb colours offered in the lamp panel */
export const LAMP_COLORS: [string, string][] = [
  ["Warm white", "#ffd6a0"],
  ["Candlelight", "#ff9a45"],
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
  /** the camera has reached the monitor: show the console on it */
  onConsoleReady?: () => void;
  /** the keyboard was clicked: open the note pad */
  onKeyboard?: () => void;
  /** an object hiding a section of the portfolio was clicked */
  onPortfolio?: (id: PortfolioId) => void;
  /** the room has drawn its first frame (shaders compiled, everything on screen) */
  onFirstFrame?: () => void;
  /** the light switch by the door was clicked */
  onLightSwitch?: () => void;
  /** the speaker was clicked; when given, this replaces the built-in radio (e.g. to open a playlist player) */
  onSpeaker?: () => void;
  /** the speaker's radio was switched */
  onRadioChange?: (on: boolean) => void;
  /** the thing under the pointer, named for a hover label, or null */
  onHover?: (label: string | null) => void;
  /** start muted */
  muted?: boolean;
  /** the candle was lit (true) or blown out (false) */
  onCandle?: (lit: boolean) => void;
  /** the starting sound mix */
  sound?: SoundSettings;
  /** the sky outside: the visitor's own clock, or a fixed time */
  sky?: SkyMode;
}

export interface PlainRoomHandle {
  setView: (view: PlainRoomView) => void;
  /** switch the floor lamp; it fades like a real bulb. Returns the new state. */
  toggleLamp: () => boolean;
  /** switch the ceiling light, the sunset lamp or the desk lamp */
  toggleLight: (which: "ceiling" | "sunset" | "desk") => boolean;
  /** change any lamp settings; the light fades to them */
  setLamp: (settings: Partial<LampSettings>) => void;
  /** play or stop the lo-fi radio on the speaker; returns the new state */
  toggleRadio: () => boolean;
  setMuted: (muted: boolean) => void;
  /** change the sound effects and ambience levels, and what's heard outside */
  setSound: (sound: SoundSettings) => void;
  /** make the speaker pulse as if playing, for music the room can't hear itself (an embedded playlist) */
  setSpeakerPlaying: (on: boolean) => void;
  /** a soft two-note chime, for celebrations in the page (e.g. a trophy) */
  chime: () => void;
  /** put a project on the curved monitor (its screenshot, or a title card when there isn't one), or null to clear it */
  showProject: (project: MonitorProject | null) => void;
  /** frame the monitor on the left of the screen while the Projects panel is open; false goes back */
  focusMonitor: (on: boolean) => void;
  /** what time it is outside: follow the visitor's clock, or pick one */
  setSky: (mode: SkyMode) => void;
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
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  // resolution: starts a little under the screen's on high-density displays (the difference is hard
  // to see in a soft, dim room) and then adapts to how fast this device actually draws; see the loop
  const maxPixelRatio = Math.min(window.devicePixelRatio, 1.5);
  let pixelRatio = Math.min(window.devicePixelRatio, 1.25);
  renderer.setPixelRatio(pixelRatio);
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

  const blindParts: THREE.Object3D[] = [];
  // the closet and the entry door hide sections of the portfolio too
  const roomSpots: { id: PortfolioId; root: THREE.Object3D }[] = [];
  let setBlind: (k: number) => void = () => {};
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
    const cassette = slab(x1 - x0 - 0.02, 0.07, 0.07, new THREE.MeshStandardMaterial({ color: "#ecebe6", roughness: 0.5 }), (x0 + x1) / 2, y1 - 0.035, back - t + 0.09, backWall);
    const blind = slab(x1 - x0 - 0.05, 1, 0.004, new THREE.MeshStandardMaterial({ color: COLORS.blind, roughness: 0.9 }), (x0 + x1) / 2, 0, back - t + 0.08, backWall);
    blind.castShadow = false;
    const blindBar = slab(x1 - x0 - 0.04, 0.012, 0.02, new THREE.MeshStandardMaterial({ color: "#b9b9b9", roughness: 0.4, metalness: 0.6 }), (x0 + x1) / 2, 0, back - t + 0.08, backWall);
    blindParts.push(cassette, blind, blindBar);
    /** how far down the blind is, 0 (rolled up) to 1 (closed) */
    setBlind = (k) => {
      const len = Math.max(0.002, (y1 - y0) * k - 0.07);
      blind.scale.y = len;
      blind.position.y = y1 - 0.07 - len / 2;
      blind.visible = len > 0.004;
      blindBar.position.y = y1 - 0.07 - len;
    };
    setBlind(WINDOW.blindDown);
    slab(W, 0.1, 0.015, trim, 0, 0.05, back + 0.0075, backWall);
  }
  // the Take Care poster, framed on the wall to the left of the window, above the headboard
  {
    const pw = 0.42;
    const ph = pw * (380 / 270);
    const cx = (left + WINDOW.x0) / 2 - 0.01;
    const cy = (WINDOW.y0 + WINDOW.y1) / 2 + 0.02;
    const frame = slab(pw + 0.028, ph + 0.028, 0.018, new THREE.MeshStandardMaterial({ color: "#121212", roughness: 0.45 }), cx, cy, back + 0.009, backWall);
    frame.castShadow = false;
    // a dark stand-in until the print loads, so the material is built with its picture slot from the start
    const blank = new THREE.DataTexture(new Uint8Array([20, 16, 12, 255]), 1, 1);
    blank.needsUpdate = true;
    const printMat = new THREE.MeshStandardMaterial({ map: blank, roughness: 0.55 });
    new THREE.TextureLoader().load(posterTakeCare, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      printMat.map = tex;
      blank.dispose();
    });
    const print = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), printMat);
    print.position.set(cx, cy, back + 0.0185);
    print.receiveShadow = true;
    backWall.add(print);
  }

  // the sky outside, painted three times (night, sunrise/sunset, day) and cross-faded to match the
  // visitor's clock. Night: deep blue, a city glow, stars, the moon and lit windows. Golden hour:
  // a warm gradient with the sun low over the roofs. Day: soft blue with clouds. Seen only through
  // the window, so hidden from outside the room.
  const paintNight = (c: CanvasRenderingContext2D, w: number, h: number) => {
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
  };
  /** rooftops and trees along the bottom, in one colour, optionally with lit windows */
  const skyline = (c: CanvasRenderingContext2D, w: number, h: number, roof: string, trees: string, windows: number) => {
    let x = 0;
    while (x < w) {
      const bw = 60 + Math.random() * 140;
      const bh = h * (0.06 + Math.random() * 0.12);
      c.fillStyle = roof;
      c.fillRect(x, h - bh - h * 0.08, bw, bh + h * 0.08);
      for (let k = 0; k < bw * bh * 0.0012 * windows; k++) {
        c.fillStyle = "rgba(255,200,120,0.75)";
        c.fillRect(x + 6 + Math.random() * (bw - 16), h - bh - h * 0.06 + Math.random() * bh * 0.8, 6, 8);
      }
      x += bw + Math.random() * 30;
    }
    c.fillStyle = trees;
    for (let i = 0; i < 70; i++) {
      c.beginPath();
      c.arc(Math.random() * w, h - h * 0.04 - Math.random() * 30, 30 + Math.random() * 60, 0, Math.PI * 2);
      c.fill();
    }
    c.fillRect(0, h - h * 0.05, w, h * 0.05);
  };
  const paintGolden = (c: CanvasRenderingContext2D, w: number, h: number) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#29306a");
    g.addColorStop(0.35, "#6a4a8c");
    g.addColorStop(0.6, "#d0648a");
    g.addColorStop(0.8, "#f59a56");
    g.addColorStop(1, "#ffd48a");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // the sun low over the roofs, with a wide glow
    const sx = w * 0.62;
    const sy = h * 0.8;
    const glow = c.createRadialGradient(sx, sy, 10, sx, sy, w * 0.35);
    glow.addColorStop(0, "rgba(255,228,170,0.9)");
    glow.addColorStop(0.2, "rgba(255,180,110,0.35)");
    glow.addColorStop(1, "rgba(255,150,90,0)");
    c.fillStyle = glow;
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#fff1cf";
    c.beginPath();
    c.arc(sx, sy, 34, 0, Math.PI * 2);
    c.fill();
    // long thin clouds catching the light
    for (let i = 0; i < 14; i++) {
      c.fillStyle = `rgba(255,${150 + Math.random() * 60},${120 + Math.random() * 40},${0.18 + Math.random() * 0.22})`;
      c.beginPath();
      c.ellipse(Math.random() * w, h * (0.2 + Math.random() * 0.45), 120 + Math.random() * 220, 6 + Math.random() * 10, 0, 0, Math.PI * 2);
      c.fill();
    }
    skyline(c, w, h, "#1d1626", "#120d18", 0.25);
  };
  const paintDay = (c: CanvasRenderingContext2D, w: number, h: number) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#3d78c9");
    g.addColorStop(0.55, "#77a9e0");
    g.addColorStop(1, "#cfe3f2");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // puffy clouds: clusters of soft white circles with a shaded base
    for (let i = 0; i < 9; i++) {
      const cx = Math.random() * w;
      const cy = h * (0.15 + Math.random() * 0.45);
      const size = 40 + Math.random() * 50;
      for (let k = 0; k < 9; k++) {
        const r = size * (0.5 + Math.random() * 0.6);
        const px = cx + (Math.random() - 0.5) * size * 3;
        const py = cy + (Math.random() - 0.5) * size * 0.7;
        const cg = c.createRadialGradient(px, py - r * 0.3, r * 0.1, px, py, r);
        cg.addColorStop(0, "rgba(255,255,255,0.95)");
        cg.addColorStop(0.7, "rgba(240,244,250,0.75)");
        cg.addColorStop(1, "rgba(220,230,242,0)");
        c.fillStyle = cg;
        c.beginPath();
        c.arc(px, py, r, 0, Math.PI * 2);
        c.fill();
      }
    }
    skyline(c, w, h, "#7d8796", "#3d5236", 0);
  };
  const skyLayer = (paint: (c: CanvasRenderingContext2D, w: number, h: number) => void, z: number, transparent: boolean) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 5),
      new THREE.MeshBasicMaterial({ map: paintTexture(1536, 860, paint), toneMapped: false, fog: false, transparent, opacity: transparent ? 0 : 1, depthWrite: !transparent }),
    );
    m.position.z = z;
    return m;
  };
  const sky = new THREE.Group();
  const skyNight = skyLayer(paintNight, 0, false);
  const skyGolden = skyLayer(paintGolden, 0.01, true);
  const skyDay = skyLayer(paintDay, 0.02, true);
  sky.add(skyNight, skyGolden, skyDay);
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
    roomSpots.push({ id: "contact", root: slab(DOOR.x1 - DOOR.x0, DOOR.h, 0.04, new THREE.MeshStandardMaterial({ map: entry, roughness: 0.4 }), (DOOR.x0 + DOOR.x1) / 2, DOOR.h / 2, front + 0.03, frontWall) });
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

  // the ceiling light and the sprinkler head
  const domeMat = new THREE.MeshStandardMaterial({ color: "#f4f1ea", roughness: 0.3, emissive: "#fff3df", emissiveIntensity: 0 });
  const ceilingParts: THREE.Object3D[] = [];
  {
    const { pos, r } = LAYOUT.ceilingLight;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.scale.y = 0.35;
    dome.rotation.x = Math.PI;
    dome.position.set(pos[0], height, pos[2]);
    scene.add(dome);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.98, 0.012, 8, 48), new THREE.MeshStandardMaterial({ color: "#a9adb2", metalness: 0.8, roughness: 0.3, envMap: env, envMapIntensity: 0.7 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(pos[0], height - 0.03, pos[2]);
    scene.add(ring);
    ceilingParts.push(dome, ring);
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

  // ---------- time of day ----------
  // The window follows the visitor's own clock: sunrise around 6–8, daylight, golden hour around
  // 18–20, then night. `day` (0 night … 1 noon) and `dusk` (how much sunrise/sunset colour) drive
  // the sky layers, the light coming through the window (cool moonlight, warm low sun, bright
  // daylight), a daylight fill in the room, the floor lamp dimming a little by day, and the campus
  // seen through the binoculars.
  const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);
  const bump = (x: number, c: number, w: number) => Math.exp(-(((x - c) / w) ** 2));
  const skyAt = (hour: number) => {
    const day = smooth(6.2, 8.2, hour) * (1 - smooth(18.2, 20.2, hour));
    const dusk = Math.min(1, Math.max(bump(hour, 6.9, 0.9), bump(hour, 19.3, 0.95)));
    return { day, dusk };
  };
  const PRESET_HOURS: Record<Exclude<SkyMode, "live">, number> = { sunrise: 6.9, day: 13, sunset: 19.3, night: 23 };
  let skyMode: SkyMode = options.sky ?? "live";
  const clockHour = () => {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  };
  const skyTarget = skyAt(skyMode === "live" ? clockHour() : PRESET_HOURS[skyMode]);
  const skyNow = { ...skyTarget };
  const NIGHT_LIGHT = new THREE.Color("#9fb4ff");
  const SUNSET_LIGHT = new THREE.Color("#ffa05a");
  const DAY_LIGHT = new THREE.Color("#fff3dc");
  const DAY_SKY = new THREE.Color("#dfe9f5");
  const LAMP_SKY = new THREE.Color("#fff1dc");
  /** the light through the window at full strength, before the blind */
  const windowLight = () => 3 + 9 * skyNow.day + 4 * skyNow.dusk * (1 - skyNow.day);
  let campusDay = -1;
  /** what's falling outside, set from the Sound panel's "Outside" choice so what you see matches what you hear */
  let weatherLook: "clear" | "rain" | "storm" | "snow" = "clear";
  const refreshCampus = () => {
    // repainting the campus is a little costly, so only when the light has really changed
    if (Math.abs(campusDay - skyNow.day) < 0.08 && campusDay >= 0) return;
    campusDay = skyNow.day;
    const weather = weatherLook === "storm" ? "rain" : weatherLook;
    const fog = campus.setConditions({ day: skyNow.day, dusk: skyNow.dusk, weather });
    outsideFog.color.copy(fog.fogColor);
    outsideFog.density = fog.fogDensity;
  };
  // light bouncing off the pale walls and ceiling: a soft, shadowless fill from above the room
  const bounce = new THREE.PointLight("#ffe2c0", 1.4, 0, 1.2);
  // kept well below the ceiling so it doesn't paint a hot spot onto it
  bounce.position.set(0.1, 1.5, ROOM.midZ);
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

  // the ceiling light: a soft, shadowless wash from the dome
  const cl = LAYOUT.ceilingLight.pos;
  const ceilingLight = new THREE.PointLight("#fff1dc", 0, 0, 1.3);
  ceilingLight.position.set(cl[0], height - 0.12, cl[2]);
  scene.add(ceilingLight);

  // the sunset lamp: a narrow projector with a painted disc (a bright amber core fading to red)
  const sun = furniture.sunset;
  // each disc is painted once, its stops spread over most of the radius and then feathered out to
  // black, so the projected circle has a soft rim rather than a hard edge
  const sunsetDiscs = new Map<string, THREE.Texture>();
  const sunsetDisc = (style: string) => {
    const stops = SUNSET_STYLES[style] ?? SUNSET_STYLES.Sunset;
    let tex = sunsetDiscs.get(style);
    if (!tex) {
      tex = paintTexture(512, 512, (c, w, h) => {
        c.fillStyle = "#000";
        c.fillRect(0, 0, w, h);
        const R = w * 0.48;
        const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, R);
        stops.forEach((col, i) => g.addColorStop((i / (stops.length - 1)) * 0.72, col));
        g.addColorStop(0.86, stops[stops.length - 1]);
        g.addColorStop(1, "#000");
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
      });
      sunsetDiscs.set(style, tex);
    }
    return tex;
  };
  const sunsetLight = new THREE.SpotLight("#ffffff", 0, 6, 0.28, 0.1, 1.2);
  let shownStyle = SUNSET_STYLES[options.initialLamp?.sunsetStyle ?? ""] ? options.initialLamp!.sunsetStyle! : "Sunset";
  sunsetLight.map = sunsetDisc(shownStyle);
  sunsetLight.position.copy(sun.lens);
  sunsetLight.target.position.copy(sun.target);
  // a projected texture needs a shadow map; the lamp only ever lights a wall, so a small one does
  sunsetLight.castShadow = true;
  sunsetLight.shadow.mapSize.set(512, 512);
  // things right beside the lamp (the monitor's edge, the speaker) must not cut into the disc
  sunsetLight.shadow.camera.near = 0.5;
  sunsetLight.shadow.bias = -0.0005;
  scene.add(sunsetLight, sunsetLight.target);
  // the ring desk lamp: a soft spot onto the keyboard and the chair, with gentle shadows
  const dk = furniture.deskLamp;
  const deskLight = new THREE.SpotLight("#fff3e3", 0, 3, 0.7, 0.7, 1.5);
  deskLight.position.copy(dk.head);
  deskLight.target.position.copy(dk.target);
  deskLight.castShadow = true;
  deskLight.shadow.mapSize.set(512, 512);
  deskLight.shadow.camera.near = 0.05;
  deskLight.shadow.radius = 5;
  deskLight.shadow.blurSamples = 12;
  deskLight.shadow.normalBias = 0.02;
  scene.add(deskLight, deskLight.target);
  const deskColor = new THREE.Color("#fff3e3");
  const deskColorTarget = deskColor.clone();

  const ceilingColor = new THREE.Color("#fff1dc");
  const ceilingColorTarget = ceilingColor.clone();
  let ceilingLevel = 0;
  let sunsetLevel = 0;
  let deskLevel = 0;
  const applyExtras = () => {
    deskLight.color.copy(deskColor);
    deskLight.intensity = 3.2 * deskLevel;
    dk.setGlow(deskLevel, deskColor);
    ceilingLight.color.copy(ceilingColor);
    domeMat.emissive.copy(ceilingColor);
    ceilingLight.intensity = 4.2 * ceilingLevel;
    domeMat.emissiveIntensity = 1.4 * ceilingLevel;
    sunsetLight.intensity = 11 * sunsetLevel;
    sun.setGlow(sunsetLevel);
  };

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
    // by day the floor lamp is turned down a little; the daylight does the work
    const k = lampLevel * (1 - 0.45 * skyNow.day);
    for (const l of [downLight, upLight, glowLight]) l.color.copy(lampColor);
    downLight.intensity = 7 * k;
    upLight.intensity = 6 * k;
    glowLight.intensity = 2.2 * k;
    // the walls bounce less light, and the room falls back on the screens and the moon
    bounce.intensity = 0.25 + 1.15 * k;
    bounce.color.copy(bounceColor.copy(warmWhite).lerp(lampColor, 0.6));
    hemi.intensity = 0.25 + 0.65 * Math.min(k, 1.2) + 0.35 * ceilingLevel + 0.85 * skyNow.day + 0.25 * skyNow.dusk;
    hemi.color.copy(LAMP_SKY).lerp(DAY_SKY, skyNow.day * 0.6);
    furniture.lamp.setGlow(k, lampColor);
  };
  applyLamp();
  const setLamp = (next: Partial<LampSettings>) => {
    Object.assign(lampSettings, next);
    lampSettings.brightness = THREE.MathUtils.clamp(lampSettings.brightness, 0.15, 1.5);
    lampColorTarget.set(lampSettings.color);
    lampSettings.deskBrightness = THREE.MathUtils.clamp(lampSettings.deskBrightness, 0.2, 1.5);
    deskColorTarget.set(lampSettings.deskTone);
    ceilingColorTarget.set(lampSettings.ceilingTone);
    if (!SUNSET_STYLES[lampSettings.sunsetStyle]) lampSettings.sunsetStyle = "Sunset";
    options.onLampChange?.({ ...lampSettings });
  };
  const toggleLamp = () => {
    setLamp({ on: !lampSettings.on });
    return lampSettings.on;
  };
  const toggleLight = (which: "ceiling" | "sunset" | "desk") => {
    setLamp({ [which]: !lampSettings[which] });
    return lampSettings[which];
  };
  if (lampSettings.ceiling) ceilingLevel = 1;
  if (lampSettings.sunset) sunsetLevel = 1;
  ceilingColor.set(lampSettings.ceilingTone);
  ceilingColorTarget.copy(ceilingColor);
  deskColor.set(lampSettings.deskTone);
  deskColorTarget.copy(deskColor);
  if (lampSettings.desk) deskLevel = lampSettings.deskBrightness;
  applyExtras();
  applyLamp();

  // only the big monitor casts its glow as a real area light: area lights are expensive for every
  // pixel, and the laptop's small screen barely registers on the room
  for (const s of furniture.screens.slice(0, 1)) {
    const area = new THREE.RectAreaLight(s.color, s.strength, s.w, s.h);
    area.position.copy(s.center);
    area.lookAt(s.center.clone().add(s.normal));
    scene.add(area);
  }

  // ---------- shadows, drawn only when something that casts one has moved ----------
  // Almost nothing in the room moves, so re-rendering three soft shadow maps every frame was the
  // biggest cost here. Each map is redrawn on demand instead: when a lamp comes on, or when the
  // drawer, the blind, a plushie, a lifted object or the dollhouse cutaway changes. A lamp that is
  // off keeps its old map and costs nothing.
  const shadowLights = [downLight, sunsetLight, deskLight];
  const shadowWasLit = new Map<THREE.Light, boolean>();
  for (const l of shadowLights) {
    l.shadow.autoUpdate = false;
    l.shadow.needsUpdate = true;
  }
  let shadowsDirty = true;
  // Lights stay in the scene even when they're dark (at zero brightness). Taking a dark light out
  // changes how many lights the room has, and three.js then has to rebuild the shader of every
  // material in the room, which froze the page for a moment each time a lamp was switched. With the
  // count fixed, the shaders are built once, while the loading screen is up, and switching any
  // light on or off afterwards is only a change of brightness.
  const updateShadows = () => {
    for (const l of shadowLights) {
      const lit = l.intensity > 0.001;
      if (lit && (shadowsDirty || !shadowWasLit.get(l))) l.shadow.needsUpdate = true;
      shadowWasLit.set(l, lit);
    }
    shadowsDirty = false;
  };

  // ---------- Western's campus, seen only through the binoculars ----------
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(d: T) => {
    disposables.push(d);
    return d;
  };
  // coffee in the desk mug, still steaming

  // kept faint: a hint of warmth off the cup rather than a plume
  const steam = createSteam(track, 0.28, new THREE.Color("#f4f1ec"));
  steam.group.position.copy(furniture.mugTop);
  steam.group.scale.set(0.7, 0.6, 0.7);
  scene.add(steam.group);

  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const campus = createCampus(track, rand);
  campus.group.visible = false;
  scene.add(campus.group);
  // the campus matches the sky outside the window; repainted for the time of day on the way in
  const outsideFog = new THREE.FogExp2("#000000", 0.001);

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
  type Mode = "room" | "toBinoculars" | "binoculars" | "console";
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
    refreshCampus();
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
  // the console: glide in until the monitor fills the view, then the page draws the console over it
  const enterConsole = () => {
    if (mode !== "room") return;
    returnPose = { pos: camera.position.clone(), target: controls.target.clone() };
    mode = "console";
    controls.enabled = false;
    if (!consoleOn) audio.play("chime");
    consoleOn = true;
    options.onViewChange?.("console");
    const screen = furniture.screens[0];
    moveTo(screen.center.clone().addScaledVector(screen.normal, 0.62), screen.center, () => options.onConsoleReady?.());
  };
  const leaveConsole = (then: CameraView) => {
    mode = "room";
    const to = then === roomView ? returnPose : VIEWS[then];
    roomView = then;
    moveTo(to.pos, to.target, () => (controls.enabled = true));
    options.onViewChange?.(then);
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
    if (view === "console") return enterConsole();
    if (mode === "console") return leaveConsole(view);
    if (mode !== "room") return leaveBinoculars(view);
    roomView = view;
    moveTo(VIEWS[view].pos, VIEWS[view].target);
    options.onViewChange?.(view);
  };
  controls.addEventListener("start", () => {
    if (mode === "room") tween = null;
  });

  // ---------- projects on the monitor ----------
  // While Projects is open the camera turns to the curved monitor (on the left of the screen, beside
  // the panel) and the monitor shows whichever project the visitor is looking at: a screenshot of
  // its demo, or a title card painted here when there isn't one. Changing project dips the screen
  // out and back in, like switching inputs.
  const projectTex = new Map<string, THREE.Texture>();
  const loader = new THREE.TextureLoader();
  const titleCard = (p: MonitorProject) =>
    paintTexture(1024, 600, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#14182a");
      g.addColorStop(1, "#06070d");
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      const glow = c.createRadialGradient(w * 0.8, h * 0.15, 10, w * 0.8, h * 0.15, w * 0.6);
      glow.addColorStop(0, "rgba(252,217,154,0.22)");
      glow.addColorStop(1, "rgba(252,217,154,0)");
      c.fillStyle = glow;
      c.fillRect(0, 0, w, h);
      c.fillStyle = "rgba(252,217,154,0.8)";
      c.font = "600 22px system-ui, sans-serif";
      c.fillText((p.status ?? "Project").toUpperCase(), 72, 150);
      c.fillStyle = "#ffffff";
      c.font = "700 72px system-ui, sans-serif";
      c.fillText(p.title, 72, 236, w - 144);
      c.fillStyle = "rgba(255,255,255,0.72)";
      c.font = "28px system-ui, sans-serif";
      // wrap the description to the card
      const words = (p.description ?? "").split(/\s+/).filter(Boolean);
      let line = "";
      let y = 300;
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (c.measureText(next).width > w - 144 && line) {
          c.fillText(line, 72, y);
          line = word;
          y += 40;
          if (y > h - 80) break;
        } else line = next;
      }
      if (line && y <= h - 80) c.fillText(line, 72, y);
      c.fillStyle = "rgba(255,255,255,0.35)";
      c.font = "22px ui-monospace, monospace";
      c.fillText(`github.com/Shaj2x/${p.name}`, 72, h - 56);
    });
  const textureFor = (p: MonitorProject) => {
    const cached = projectTex.get(p.name);
    if (cached) return cached;
    const card = titleCard(p);
    projectTex.set(p.name, card);
    if (p.image) {
      // the card stands in until the screenshot arrives (and stays if it can't load)
      loader.load(p.image, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        projectTex.set(p.name, tex);
        if (projectShown === card || projectNext === card) projectNext = tex;
      });
    }
    return card;
  };
  let projectShown: THREE.Texture | null = null;
  let projectNext: THREE.Texture | null = null;
  let projectWanted = false;
  let projectLevel = 0;
  const showProject = (p: MonitorProject | null) => {
    projectWanted = !!p;
    projectNext = p ? textureFor(p) : null;
  };
  let beforeFocus: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
  const focusMonitor = (on: boolean) => {
    if (mode !== "room") return;
    const wide = container.clientWidth > 900;
    if (on && wide && !beforeFocus) {
      beforeFocus = { pos: camera.position.clone(), target: controls.target.clone() };
      const s = furniture.screens[0];
      const right = new THREE.Vector3().crossVectors(s.normal.clone().negate(), new THREE.Vector3(0, 1, 0)).normalize();
      // the monitor sits in the left part of the frame, clear of the panel on the right
      const pos = s.center.clone().addScaledVector(s.normal, 1.2).add(new THREE.Vector3(0, 0.14, 0)).addScaledVector(right, 0.12);
      const target = s.center.clone().addScaledVector(right, 0.46).add(new THREE.Vector3(0, -0.03, 0));
      moveTo(pos, target);
    } else if (!on && beforeFocus) {
      moveTo(beforeFocus.pos, beforeFocus.target);
      beforeFocus = null;
    }
  };

  // ---------- pointer: click the lamp or the binoculars; drag to aim through the binoculars ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  type Pick =
    | { kind: "lamp" | "binoculars" | "ceiling" | "sunset" | "desk" | "switch" | "radio" | "console" | "blind" | "drawer" | "keyboard" | "candle" }
    | { kind: "plushie"; target: (typeof inter.plushies)[number] }
    | { kind: "perfume"; target: THREE.Group }
    | { kind: "portfolio"; id: PortfolioId };
  const inter = furniture.interact;
  const isIn = (o: THREE.Object3D, root: THREE.Object3D) => {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === root) return true;
    return false;
  };
  const LABELS: Record<string, string> = {
    lamp: "Floor lamp · click to switch",
    binoculars: "Binoculars · look out at Western",
    ceiling: "Ceiling light · click to switch",
    sunset: "Sunset lamp · click to switch",
    desk: "Desk lamp · click to switch",
    switch: "Light switch · open the lights",
    radio: options.onSpeaker ? "Speaker · play my playlist" : `Speaker · ${RADIO_STATION.name}`,
    console: "PS5 · pick up the controller and play",
    blind: "Blind · roll it up or down",
    drawer: "Dresser drawer · open it",
    keyboard: "Keyboard · leave me a note",
    candle: "Candle · blow it out or light it",
    perfume: "The fragrances · spray one",
  };
  // the mesh under the pointer at the last pick, for the hover glow and lift
  let lastHitObject: THREE.Object3D | null = null;
  const lastHitPoint = new THREE.Vector3();
  const pickTarget = (e: PointerEvent): Pick | null => {
    if (mode !== "room") return null;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects([...furniture.group.children, ...ceilingParts, ...blindParts, ...roomSpots.map((r) => r.root)], true).find((h) => {
      if (!(h.object as THREE.Mesh).isMesh) return false;
      // skip anything hidden, including walls cut away for the dollhouse view
      for (let p: THREE.Object3D | null = h.object; p; p = p.parent) if (!p.visible) return false;
      return true;
    });
    if (!hit) return null;
    const o = hit.object;
    lastHitObject = o;
    lastHitPoint.copy(hit.point);
    if (ceilingParts.includes(o)) return { kind: "ceiling" };
    if (blindParts.includes(o)) return { kind: "blind" };
    if (sun.parts.includes(o)) return { kind: "sunset" };
    if (dk.parts.includes(o)) return { kind: "desk" };
    if (furniture.lamp.parts.includes(o)) return { kind: "lamp" };
    if (binos.parts.includes(o)) return { kind: "binoculars" };
    if (o === inter.lightSwitch) return { kind: "switch" };
    if (o === inter.speaker) return { kind: "radio" };
    if (isIn(o, inter.controller) || isIn(o, inter.monitor) || isIn(o, inter.ps5)) return { kind: "console" };
    // the resume is only reachable once the drawer is open
    if (o === inter.drawer.paper) return drawerTarget > 0.5 ? { kind: "portfolio", id: "resume" } : { kind: "drawer" };
    if (inter.drawer.parts.includes(o)) return { kind: "drawer" };
    if (isIn(o, inter.keyboard)) return { kind: "keyboard" };
    if (inter.candle.parts.includes(o)) return { kind: "candle" };
    const spot = [...inter.spots, ...roomSpots].find((r) => isIn(o, r.root));
    if (spot) return { kind: "portfolio", id: spot.id };
    const plush = inter.plushies.find((p) => isIn(o, p.group));
    if (plush) return { kind: "plushie", target: plush };
    const bottle = inter.bottles.find((g) => isIn(o, g));
    if (bottle) return { kind: "perfume", target: bottle };
    return null;
  };

  // ---------- sound, the radio, and the small reactions ----------
  const audio = createAudio();
  audio.setMuted(options.muted ?? false);
  const applySound = (s: SoundSettings) => {
    audio.setMix({ effects: s.effects, ambience: s.ambience });
    audio.setWeather(OUTSIDE_AUDIO[s.outside]);
    const look = s.outside === "breeze" ? "clear" : s.outside;
    if (look !== weatherLook) {
      weatherLook = look;
      campusDay = -1; // repaint the campus wet or snowy next time the binoculars come up
    }
  };
  applySound(options.sound ?? DEFAULT_SOUND);
  // lightning lights up the room through the window for a moment
  let lightning = 0;
  audio.onLightning = () => {
    lightning = 1;
  };
  const unlockAudio = () => audio.unlock();
  window.addEventListener("pointerdown", unlockAudio);
  window.addEventListener("keydown", unlockAudio);
  let radioOn = false;
  let speakerPlaying = false;
  const toggleRadio = () => {
    audio.unlock();
    audio.click("radio");
    radioOn = !radioOn;
    audio.setRadio(radioOn);
    options.onRadioChange?.(radioOn);
    return radioOn;
  };
  // the PS5: the controller wakes it to the home screen and puts it back to the user picker
  let consoleOn = false;
  let consoleLevel = 0;
  // the blind rolls between nearly up and fully closed
  let blindTarget = WINDOW.blindDown;
  let blindLevel = WINDOW.blindDown;
  // the dresser's top drawer slides out with an ease, and the resume is waiting inside
  let drawerTarget = 0;
  let drawerLevel = 0;
  // the candle burns from the start; a click blows it out (quickly) or lights it (it catches more slowly)
  let candleTarget = 1;
  let candleLevel = 1;
  // plushies squash and spring back, each on its own clock
  const bounces = new Map<THREE.Group, number>();

  // ---------- small wonders ----------
  // a soft round sprite shared by the sparkles and the dust
  const dotTex = paintTexture(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.5)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });

  // ---------- glow ----------
  // A soft bloom around the room's bright spots (the lamp shade, the desk lamp's ring, the sunset
  // lamp's lens, the ceiling dome and the monitor), done as additive halo sprites that fade with
  // each light rather than a full-screen blur pass, so it costs next to nothing. Each halo is
  // nudged toward the camera so the fixture it surrounds doesn't cut it in half.
  const glows: { sprite: THREE.Sprite; at: THREE.Vector3; level: () => number; color: () => THREE.Color; strength: number }[] = [];
  const glow = (at: THREE.Vector3, size: [number, number], strength: number, level: () => number, color: () => THREE.Color) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 }));
    sprite.scale.set(size[0], size[1], 1);
    sprite.renderOrder = 3;
    scene.add(sprite);
    glows.push({ sprite, at: at.clone(), level, color, strength });
  };
  const SUNSET_GLOW = new THREE.Color("#ff8a3d");
  const SCREEN_GLOW = new THREE.Color("#4a8ef0");
  glow(furniture.lamp.bulb, [0.75, 0.6], 0.32, () => lampLevel * (1 - 0.45 * skyNow.day), () => lampColor);
  glow(dk.head, [0.4, 0.4], 0.5, () => deskLevel, () => deskColor);
  glow(sun.lens, [0.22, 0.22], 0.7, () => sunsetLevel, () => SUNSET_GLOW);
  glow(new THREE.Vector3(cl[0], height - 0.06, cl[2]), [0.9, 0.5], 0.3, () => ceilingLevel, () => ceilingColor);
  glow(furniture.screens[0].center, [1.15, 0.8], 0.09, () => 1, () => SCREEN_GLOW);
  const toCam = new THREE.Vector3();
  const updateGlows = () => {
    for (const g of glows) {
      const k = g.level();
      g.sprite.visible = k > 0.01 && mode !== "binoculars";
      if (!g.sprite.visible) continue;
      toCam.subVectors(camera.position, g.at).normalize();
      g.sprite.position.copy(g.at).addScaledVector(toCam, 0.12);
      g.sprite.material.color.copy(g.color());
      g.sprite.material.opacity = Math.min(1, g.strength * k);
    }
  };

  // ---------- weather you can see ----------
  // Rain, a thunderstorm or snow (picked under Sound → Outside) show through the window too: the sky
  // goes overcast, rain falls past the glass in streaks, or snow drifts down, and lightning lights
  // the clouds. The campus through the binoculars gets wet streets or snow to match.
  const weatherNow = { rain: 0, snow: 0, cloud: 0 };
  const overcastMat = new THREE.MeshBasicMaterial({ color: "#151a26", transparent: true, opacity: 0, toneMapped: false, fog: false, depthWrite: false });
  const overcast = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), overcastMat);
  overcast.position.z = 0.03;
  overcast.visible = false;
  sky.add(overcast);
  const rainTex = paintTexture(256, 512, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const len = 14 + Math.random() * 46;
      const g = c.createLinearGradient(x, y, x, y + len);
      g.addColorStop(0, "rgba(210,222,245,0)");
      g.addColorStop(1, `rgba(210,222,245,${0.25 + Math.random() * 0.4})`);
      c.strokeStyle = g;
      c.lineWidth = 0.8 + Math.random() * 0.9;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + len * 0.06, y + len);
      c.stroke();
    }
  });
  rainTex.wrapS = rainTex.wrapT = THREE.RepeatWrapping;
  rainTex.repeat.set(2, 1.2);
  const winW = WINDOW.x1 - WINDOW.x0;
  const winH = WINDOW.y1 - WINDOW.y0;
  const rainMat = new THREE.MeshBasicMaterial({ map: rainTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false });
  const rain = new THREE.Mesh(new THREE.PlaneGeometry(winW * 1.6, winH * 1.6), rainMat);
  rain.position.set((WINDOW.x0 + WINDOW.x1) / 2, (WINDOW.y0 + WINDOW.y1) / 2, back - t - 0.35);
  rain.visible = false;
  scene.add(rain);
  const SNOW = 260;
  const snowPos = new Float32Array(SNOW * 3);
  const snowSeed = new Float32Array(SNOW);
  const snowBox = { x0: WINDOW.x0 - 0.6, x1: WINDOW.x1 + 0.6, y0: WINDOW.y0 - 0.6, y1: WINDOW.y1 + 0.8, z0: back - t - 2.4, z1: back - t - 0.15 };
  for (let i = 0; i < SNOW; i++) {
    snowSeed[i] = Math.random();
    snowPos.set([THREE.MathUtils.lerp(snowBox.x0, snowBox.x1, Math.random()), THREE.MathUtils.lerp(snowBox.y0, snowBox.y1, Math.random()), THREE.MathUtils.lerp(snowBox.z0, snowBox.z1, Math.random())], i * 3);
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
  const snowMat = new THREE.PointsMaterial({ map: dotTex, size: 0.03, transparent: true, opacity: 0, depthWrite: false, color: "#f4f7ff", fog: false });
  const snow = new THREE.Points(snowGeo, snowMat);
  snow.frustumCulled = false;
  snow.visible = false;
  scene.add(snow);
  const OVERCAST_NIGHT = new THREE.Color("#151a26");
  const OVERCAST_DAY = new THREE.Color("#8d97a4");
  const FLASH = new THREE.Color("#dfe6ff");
  const updateWeather = (dt: number, time: number) => {
    const target = {
      rain: weatherLook === "rain" || weatherLook === "storm" ? 1 : 0,
      snow: weatherLook === "snow" ? 1 : 0,
      cloud: weatherLook === "storm" ? 0.78 : weatherLook === "rain" ? 0.62 : weatherLook === "snow" ? 0.45 : 0,
    };
    const e = reducedMotion ? 1 : 1 - Math.exp(-1.5 * dt);
    weatherNow.rain += (target.rain - weatherNow.rain) * e;
    weatherNow.snow += (target.snow - weatherNow.snow) * e;
    weatherNow.cloud += (target.cloud - weatherNow.cloud) * e;
    const outside = sky.visible;
    overcast.visible = outside && weatherNow.cloud > 0.01;
    if (overcast.visible) {
      overcastMat.opacity = weatherNow.cloud;
      overcastMat.color.copy(OVERCAST_NIGHT).lerp(OVERCAST_DAY, skyNow.day);
      if (lightning > 0.4) overcastMat.color.lerp(FLASH, (lightning - 0.4) * 1.4);
    }
    rain.visible = outside && weatherNow.rain > 0.01;
    if (rain.visible) {
      rainMat.opacity = 0.6 * weatherNow.rain;
      rainTex.offset.y += dt * (weatherLook === "storm" ? 2.6 : 1.9);
      rainTex.offset.x -= dt * (weatherLook === "storm" ? 0.12 : 0.04);
    }
    snow.visible = outside && weatherNow.snow > 0.01;
    if (snow.visible) {
      snowMat.opacity = 0.9 * weatherNow.snow;
      for (let i = 0; i < SNOW; i++) {
        const k = i * 3;
        snowPos[k + 1] -= dt * (0.22 + snowSeed[i] * 0.25);
        snowPos[k] += Math.sin(time * (0.6 + snowSeed[i]) + snowSeed[i] * 9) * dt * 0.08;
        if (snowPos[k + 1] < snowBox.y0) snowPos[k + 1] = snowBox.y1;
      }
      snowGeo.attributes.position.needsUpdate = true;
    }
  };

  // ---------- idle life ----------
  // Small things that happen on their own while you look around: Babs hops a step along the sill
  // now and then, the sill plants sway in the air from the window (more in rain or wind, not at
  // all with the blind down), a message pops up on the laptop, and the PS5's light bar breathes
  // while it's asleep.
  const idle = furniture.interact.idle;
  const babs = furniture.interact.plushies.find((p) => p.name === "Babs")?.group ?? null;
  const babsHome = babs ? babs.position.clone() : new THREE.Vector3();
  let babsHop: { t: number; from: number; to: number } | null = null;
  let nextHop = 8 + Math.random() * 10;
  let nextPing = 18 + Math.random() * 20;
  let pingT = -1;
  const updateIdle = (dt: number, time: number) => {
    if (reducedMotion) return;
    // Babs: a quick little parabola, a hair of tilt, never off her patch of sill
    if (babs) {
      nextHop -= dt;
      if (!babsHop && nextHop <= 0 && !lifts.has(babs) && !bounces.has(babs)) {
        const from = babs.position.x;
        let to = from + (Math.random() < 0.5 ? -1 : 1) * 0.03;
        if (Math.abs(to - babsHome.x) > 0.045) to = from - (to - from);
        babsHop = { t: 0, from, to };
        nextHop = 10 + Math.random() * 16;
      }
      if (babsHop) {
        babsHop.t = Math.min(1, babsHop.t + dt / 0.42);
        const k = babsHop.t;
        babs.position.x = THREE.MathUtils.lerp(babsHop.from, babsHop.to, k);
        babs.position.y = babsHome.y + Math.sin(k * Math.PI) * 0.028;
        babs.rotation.z = Math.sin(k * Math.PI) * 0.12 * Math.sign(babsHop.from - babsHop.to);
        if (k >= 1) {
          babs.position.y = babsHome.y;
          babs.rotation.z = 0;
          babsHop = null;
        }
      }
    }
    // plants: a slow sway with a quicker flutter on top, stronger when it's wet or windy outside
    const gust = weatherLook === "storm" ? 2.6 : weatherLook === "rain" || weatherLook === "snow" ? 1.6 : 1;
    const air = 0.028 * gust * Math.max(0, 1 - blindLevel * 1.05);
    idle.plants.forEach((p, i) => {
      p.rotation.z = (Math.sin(time * 1.1 + i * 1.9) * 0.7 + Math.sin(time * 3.7 + i) * 0.3) * air;
      p.rotation.x = Math.sin(time * 0.8 + i * 2.7) * air * 0.6;
    });
    // the laptop: a message slides in, sits for a few seconds, then slides away
    nextPing -= dt;
    if (pingT < 0 && nextPing <= 0) {
      pingT = 0;
      nextPing = 30 + Math.random() * 35;
    }
    if (pingT >= 0) {
      pingT += dt;
      const k = pingT < 0.3 ? pingT / 0.3 : pingT < 4 ? 1 : Math.max(0, 1 - (pingT - 4) / 0.4);
      idle.setLaptopPing(1 - (1 - k) ** 3);
      if (pingT > 4.4) {
        pingT = -1;
        idle.setLaptopPing(0);
      }
    }
    // the PS5's light bar breathes slowly while it's asleep
    idle.setPsBreath(0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time * 1.25)));
  };

  // gold sparkles that burst from whatever just gave up a piece of the portfolio, then drift down
  const SPARKS = 90;
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkVel = new Float32Array(SPARKS * 3);
  const sparkLife = new Float32Array(SPARKS);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({ map: dotTex, size: 0.03, color: new THREE.Color("#ffd27a").multiplyScalar(2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  sparks.visible = false;
  scene.add(sparks);
  const burst = (at: THREE.Vector3, count = 60) => {
    if (reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const k = i % SPARKS;
      sparkPos.set([at.x, at.y, at.z], k * 3);
      // an even spray over a sphere, biased upward
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const sp = 0.5 + Math.random() * 0.9;
      sparkVel.set([r * Math.cos(a) * sp, Math.abs(u) * sp * 1.1 + 0.3, r * Math.sin(a) * sp], k * 3);
      sparkLife[k] = 0.8 + Math.random() * 0.6;
    }
    sparks.visible = true;
  };

  // dust motes turning slowly in the lamp's light
  const DUST = 140;
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = new Float32Array(DUST * 3);
  const lampAt = furniture.lamp.bulb;
  for (let i = 0; i < DUST; i++) {
    dustSeed.set([Math.random() * Math.PI * 2, Math.random(), 0.15 + Math.random() * 0.45], i * 3);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({ map: dotTex, size: 0.008, color: "#ffe2b8", transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);

  // now and then a shooting star crosses the sky outside the window
  const starGeo = new THREE.PlaneGeometry(0.9, 0.012);
  starGeo.translate(-0.45, 0, 0); // the head leads, the tail trails behind
  const starMat = new THREE.MeshBasicMaterial({
    map: paintTexture(256, 8, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(255,255,255,1)");
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const star = new THREE.Mesh(starGeo, starMat);
  star.visible = false;
  scene.add(star);
  const starRun = { t: 1, next: 6, from: new THREE.Vector3(), dir: new THREE.Vector3() };

  // perfume mist: a pool of soft particles, puffed out of whichever bottle was pressed
  const MIST = 160;
  const mistPos = new Float32Array(MIST * 3);
  const mistVel = new Float32Array(MIST * 3);
  const mistLife = new Float32Array(MIST);
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute("position", new THREE.BufferAttribute(mistPos, 3));
  const mistTex = paintTexture(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  const mistMat = new THREE.PointsMaterial({ map: mistTex, size: 0.025, transparent: true, opacity: 0.5, depthWrite: false, color: "#fff4e8" });
  const mist = new THREE.Points(mistGeo, mistMat);
  mist.frustumCulled = false;
  scene.add(mist);
  let mistNext = 0;
  const spritz = (bottle: THREE.Group) => {
    const top = new THREE.Box3().setFromObject(bottle);
    const from = new THREE.Vector3((top.min.x + top.max.x) / 2, top.max.y, (top.min.z + top.max.z) / 2);
    for (let i = 0; i < 28; i++) {
      const k = mistNext++ % MIST;
      mistPos.set([from.x, from.y, from.z], k * 3);
      // a fan of mist forward and up, toward the room
      mistVel.set([(Math.random() - 0.5) * 0.25, 0.05 + Math.random() * 0.15, 0.25 + Math.random() * 0.35], k * 3);
      mistLife[k] = 1;
    }
    bounces.set(bottle, 0);
  };

  // a press that drags (orbiting, aiming) isn't a click
  let downAt: { x: number; y: number } | null = null;
  let dragFrom: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => (downAt = dragFrom = { x: e.clientX, y: e.clientY });
  const onUp = (e: PointerEvent) => {
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6) {
      const hit = pickTarget(e);
      const kind = hit?.kind;
      if (kind === "lamp") {
        audio.click("lamp");
        toggleLamp();
      } else if (kind === "binoculars") enterBinoculars();
      else if (kind === "ceiling" || kind === "sunset" || kind === "desk") {
        audio.click(kind === "ceiling" ? "switch" : "lamp");
        toggleLight(kind);
      } else if (kind === "switch") {
        audio.click("switch");
        options.onLightSwitch?.();
      } else if (kind === "radio") {
        if (options.onSpeaker) {
          audio.click("radio");
          options.onSpeaker();
        } else toggleRadio();
      }
      else if (kind === "console") enterConsole();
      else if (kind === "keyboard") options.onKeyboard?.();
      else if (kind === "candle") {
        candleTarget = candleTarget > 0.5 ? 0 : 1;
        audio.click("lamp");
        options.onCandle?.(candleTarget > 0.5);
      }
      else if (kind === "drawer") {
        drawerTarget = drawerTarget > 0.5 ? 0 : 1;
        audio.play("blind");
      } else if (kind === "blind") {
        blindTarget = blindTarget > 0.5 ? WINDOW.blindDown : 1;
        audio.play("blind");
      } else if (hit?.kind === "plushie") {
        bounces.set(hit.target.group, 0);
        audio.play("squeak");
      } else if (hit?.kind === "portfolio") {
        audio.play("chime");
        burst(lastHitPoint);
        options.onPortfolio?.(hit.id);
      } else if (hit?.kind === "perfume") {
        spritz(hit.target);
        burst(new THREE.Box3().setFromObject(hit.target).getCenter(new THREE.Vector3()).add(new THREE.Vector3(0, 0.06, 0)), 40);
        // the scent lingers a moment, then About Me opens
        window.setTimeout(() => options.onPortfolio?.("about"), reducedMotion ? 0 : 650);
        audio.play("spritz");
      }
    }
    downAt = dragFrom = null;
  };
  let hoverLabel: string | null = null;

  // ---------- hover: an outline traced around whatever can be clicked; small things also lift ----------
  // The outline is drawn in screen space around the object's silhouette: a crisp warm line with a
  // faint halo, which draws itself in over ~180 ms and then breathes very slowly while you stay.
  // The scene only goes through the composer while an outline is showing, so idle frames cost
  // nothing extra. Things you'd pick up (plushies, bottles, binoculars, the controller) also rise
  // on a slightly bouncy spring and settle back.
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const outline = new OutlinePass(new THREE.Vector2(container.clientWidth, container.clientHeight), scene, camera);
  outline.visibleEdgeColor.set("#fff0d4");
  outline.hiddenEdgeColor.set("#3d3226");
  outline.edgeThickness = 1;
  outline.edgeGlow = 0.35;
  outline.edgeStrength = 0;
  composer.addPass(outline);
  composer.addPass(new OutputPass());
  let outlineLevel = 0;
  let outlineTarget = 0;
  let outlineSince = 0;
  const outlineTargetsFor = (hit: Pick | null): THREE.Object3D[] => {
    if (!hit || !lastHitObject) return [];
    const o = lastHitObject;
    switch (hit.kind) {
      case "plushie":
        return [hit.target.group];
      case "perfume":
        return [hit.target];
      case "binoculars":
        return binos.parts;
      case "lamp":
        return furniture.lamp.parts;
      case "desk":
        return dk.parts;
      case "sunset":
        return sun.parts;
      case "ceiling":
        return ceilingParts;
      case "blind":
        return blindParts;
      case "drawer":
        return [...inter.drawer.parts, inter.drawer.paper];
      case "keyboard":
        return [inter.keyboard];
      case "candle":
        return inter.candle.parts;
      case "radio":
        return [inter.speaker];
      case "switch":
        return [inter.lightSwitch];
      case "console":
        return [isIn(o, inter.controller) ? inter.controller : isIn(o, inter.monitor) ? inter.monitor : inter.ps5];
      case "portfolio": {
        const spot = [...inter.spots, ...roomSpots].find((r) => isIn(o, r.root));
        return spot ? [spot.root] : [o];
      }
    }
  };
  const lifts = new Map<THREE.Object3D, { base: number; off: number; vel: number; target: number }>();
  let lifted: THREE.Object3D | null = null;
  const liftRootFor = (hit: Pick | null): THREE.Object3D | null => {
    if (!hit) return null;
    // Babs mid-hop isn't picked up (the hop owns her height until she lands)
    if (hit.kind === "plushie") return babsHop && hit.target.group === babs ? null : hit.target.group;
    if (hit.kind === "perfume") return hit.target;
    if (hit.kind === "binoculars") return binos.parts[0]?.parent ?? null;
    if (hit.kind === "console" && lastHitObject && isIn(lastHitObject, inter.controller)) return inter.controller;
    return null;
  };
  const setHover = (hit: Pick | null) => {
    const root = liftRootFor(hit);
    if (root !== lifted) {
      if (lifted) lifts.get(lifted)!.target = 0;
      if (root) {
        const l = lifts.get(root) ?? { base: root.position.y, off: 0, vel: 0, target: 0 };
        l.target = hit?.kind === "plushie" ? 0.018 : 0.012;
        lifts.set(root, l);
      }
      lifted = root;
    }
    const targets = outlineTargetsFor(hit);
    const same = targets.length === outline.selectedObjects.length && targets.every((t, i) => t === outline.selectedObjects[i]);
    if (targets.length) {
      if (!same) {
        outline.selectedObjects = targets;
        outlineLevel = 0; // a new object draws its outline in afresh
        outlineSince = clock.elapsedTime;
      }
      outlineTarget = 1;
    } else outlineTarget = 0;
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
    if (e.buttons) return;
    const hit = pickTarget(e);
    renderer.domElement.style.cursor = hit ? "pointer" : "";
    setHover(hit);
    const label = !hit ? null : hit.kind === "plushie" ? `${hit.target.name} · give it a squeeze` : hit.kind === "portfolio" ? `${PORTFOLIO_SPOTS[hit.id].object} · something's here` : LABELS[hit.kind];
    if (label !== hoverLabel) {
      hoverLabel = label;
      options.onHover?.(label);
    }
  };
  const onWheel = (e: WheelEvent) => {
    if (mode !== "binoculars") return;
    e.preventDefault();
    if (!zoom) scope.fovT = THREE.MathUtils.clamp(scope.fovT * Math.exp(e.deltaY * 0.0012), 2.5, 18);
  };
  // pinch to zoom the binoculars on touch screens (two fingers apart = closer)
  let pinchFrom = 0;
  const pinchGap = (e: TouchEvent) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  const onTouchStart = (e: TouchEvent) => {
    if (mode !== "binoculars" || e.touches.length !== 2) return;
    pinchFrom = pinchGap(e);
    dragFrom = null; // a pinch isn't a drag to aim
  };
  const onTouchMove = (e: TouchEvent) => {
    if (mode !== "binoculars" || e.touches.length !== 2 || !pinchFrom) return;
    e.preventDefault();
    const gap = pinchGap(e);
    if (!zoom) scope.fovT = THREE.MathUtils.clamp(scope.fovT * (pinchFrom / gap), 2.5, 18);
    pinchFrom = gap;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) pinchFrom = 0;
  };
  renderer.domElement.addEventListener("touchstart", onTouchStart, { passive: true });
  renderer.domElement.addEventListener("touchmove", onTouchMove, { passive: false });
  renderer.domElement.addEventListener("touchend", onTouchEnd);
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);
  renderer.domElement.addEventListener("pointermove", onMove);
  // leaving the canvas (onto a panel, or off the page) lets go of whatever was hovered
  const onLeave = () => {
    setHover(null);
    if (hoverLabel) {
      hoverLabel = null;
      options.onHover?.(null);
    }
  };
  renderer.domElement.addEventListener("pointerleave", onLeave);
  renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
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

  // ---------- the opening ----------
  // the camera drifts down from near the ceiling into the photo view while the lamp flickers on,
  // the way an old bulb catches. Skipped for reduced motion.
  let intro = reducedMotion ? 1 : 0;
  if (!reducedMotion) {
    camera.position.copy(VIEWS.photo.pos).add(new THREE.Vector3(0.1, 0.55, 0.02));
    controls.target.copy(VIEWS.photo.target).add(new THREE.Vector3(0, -0.35, 0));
    camera.lookAt(controls.target);
    tween = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), toPos: VIEWS.photo.pos.clone(), toTarget: VIEWS.photo.target.clone(), t: 0, dur: 3.2 };
  }
  // brightness over the first 1.8 s: two stutters, then it holds
  const flicker = (t: number) => (t < 0.25 ? 0 : t < 0.35 ? 0.7 : t < 0.5 ? 0.1 : t < 0.62 ? 0.9 : t < 0.72 ? 0.35 : Math.min(1, 0.6 + (t - 0.72) * 0.6));

  // adaptive resolution: if frames run long for a couple of seconds, draw fewer pixels; if there is
  // plenty of headroom, step back up. Changes are small and at most every 2 s, so it's not noticeable.
  let frameNo = 0;
  let perfTime = 0;
  let perfFrames = 0;
  let perfSlow = 0;
  const adaptResolution = (dt: number, paused: boolean) => {
    if (paused || dt <= 0 || dt >= 0.1 || document.hidden) return;
    perfTime += dt;
    perfFrames++;
    if (dt > 1 / 40) perfSlow++;
    if (perfTime < 2) return;
    const avg = perfTime / perfFrames;
    const slowShare = perfSlow / perfFrames;
    perfTime = perfFrames = perfSlow = 0;
    let next = pixelRatio;
    if (avg > 1 / 45 || slowShare > 0.25) next = Math.max(Math.min(1, window.devicePixelRatio), pixelRatio - 0.25);
    else if (avg < 1 / 57 && slowShare < 0.05) next = Math.min(maxPixelRatio, pixelRatio + 0.125);
    if (next !== pixelRatio) {
      pixelRatio = next;
      renderer.setPixelRatio(pixelRatio);
      onResize();
    }
  };

  let skyApplied = false;
  const NIGHT_EXPOSURE = 1.1;
  const applySky = () => {
    skyApplied = true;
    const { day, dusk } = skyNow;
    (skyGolden.material as THREE.MeshBasicMaterial).opacity = Math.min(1, day + dusk);
    (skyDay.material as THREE.MeshBasicMaterial).opacity = day * (1 - dusk * 0.85);
    skyNight.visible = day + dusk < 0.999;
    moon.color.copy(NIGHT_LIGHT).lerp(SUNSET_LIGHT, Math.min(1, dusk + day)).lerp(DAY_LIGHT, day * (1 - dusk * 0.7));
    if (!lightning) moon.intensity = windowLight() * (1 - blindLevel);
    renderer.toneMappingExposure = NIGHT_EXPOSURE - 0.08 * day;
    applyLamp();
  };
  const setSky = (mode: SkyMode) => {
    skyMode = mode;
    campusDay = -1;
    Object.assign(skyTarget, skyAt(mode === "live" ? clockHour() : PRESET_HOURS[mode]));
  };

  let firstFrameSent = false;
  const clock = new THREE.Clock();
  const toCamera = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    const time = clock.elapsedTime;
    if (intro < 1) {
      intro = Math.min(1, time / 1.8);
      lampLevel = (lampSettings.on ? lampSettings.brightness : 0) * flicker(time);
      applyLamp();
    }

    // lamp: level and colour chase their settings
    const lampTarget = lampSettings.on ? lampSettings.brightness : 0;
    const colorMoving = !lampColor.equals(lampColorTarget);
    if (intro >= 1 && (lampLevel !== lampTarget || colorMoving)) {
      const rate = lampTarget > lampLevel ? 18 : 9;
      lampLevel += (lampTarget - lampLevel) * (reducedMotion ? 1 : 1 - Math.exp(-rate * dt));
      if (Math.abs(lampTarget - lampLevel) < 0.002) lampLevel = lampTarget;
      lampColor.lerp(lampColorTarget, reducedMotion ? 1 : 1 - Math.exp(-6 * dt));
      const dc = Math.abs(lampColor.r - lampColorTarget.r) + Math.abs(lampColor.g - lampColorTarget.g) + Math.abs(lampColor.b - lampColorTarget.b);
      if (dc < 0.004) lampColor.copy(lampColorTarget);
      applyLamp();
    }

    // the ceiling light and the sunset lamp fade like the floor lamp
    // a new sunset style dips the lamp out, swaps the disc, and brings it back
    const swapping = lampSettings.sunsetStyle !== shownStyle;
    if (swapping && (sunsetLevel < 0.02 || !lampSettings.sunset)) {
      shownStyle = lampSettings.sunsetStyle;
      sunsetLight.map = sunsetDisc(shownStyle);
    }
    const ceilingTarget = lampSettings.ceiling ? 1 : 0;
    const sunsetTarget = lampSettings.sunset && lampSettings.sunsetStyle === shownStyle ? 1 : 0;
    const deskTarget = lampSettings.desk ? lampSettings.deskBrightness : 0;
    const deskColorMoving = !deskColor.equals(deskColorTarget) || !ceilingColor.equals(ceilingColorTarget);
    if (ceilingLevel !== ceilingTarget || sunsetLevel !== sunsetTarget || deskLevel !== deskTarget || deskColorMoving) {
      const step = (v: number, to: number, down = 8) => {
        const next = v + (to - v) * (reducedMotion ? 1 : 1 - Math.exp(-(to > v ? 14 : down) * dt));
        return Math.abs(to - next) < 0.002 ? to : next;
      };
      ceilingLevel = step(ceilingLevel, ceilingTarget);
      sunsetLevel = step(sunsetLevel, sunsetTarget, swapping ? 16 : 8);
      deskLevel = step(deskLevel, deskTarget);
      deskColor.lerp(deskColorTarget, reducedMotion ? 1 : 1 - Math.exp(-6 * dt));
      ceilingColor.lerp(ceilingColorTarget, reducedMotion ? 1 : 1 - Math.exp(-6 * dt));
      if (Math.abs(ceilingColor.r - ceilingColorTarget.r) + Math.abs(ceilingColor.g - ceilingColorTarget.g) + Math.abs(ceilingColor.b - ceilingColorTarget.b) < 0.004) ceilingColor.copy(ceilingColorTarget);
      if (Math.abs(deskColor.r - deskColorTarget.r) + Math.abs(deskColor.g - deskColorTarget.g) + Math.abs(deskColor.b - deskColorTarget.b) < 0.004) deskColor.copy(deskColorTarget);
      applyExtras();
      applyLamp();
    }

    // the PS5 screen and light bar, the blind, the plushies' bounce, the perfume mist and the speaker's pulse
    const consoleTarget = consoleOn ? 1 : 0;
    if (consoleLevel !== consoleTarget) {
      consoleLevel += (consoleTarget - consoleLevel) * (reducedMotion ? 1 : 1 - Math.exp(-5 * dt));
      if (Math.abs(consoleTarget - consoleLevel) < 0.003) consoleLevel = consoleTarget;
      inter.setConsole(consoleLevel);
    }
    if (blindLevel !== blindTarget) {
      // a roller blind moves at a steady pace, easing only at the ends
      const dir = Math.sign(blindTarget - blindLevel);
      blindLevel += dir * Math.min(Math.abs(blindTarget - blindLevel), dt * (reducedMotion ? 99 : 0.9) * (0.35 + Math.min(1, Math.abs(blindTarget - blindLevel) * 6)));
      setBlind(blindLevel);
      shadowsDirty = true;
      // light from outside follows how much window is showing
      moon.intensity = windowLight() * (1 - blindLevel);
    }
    // time of day: re-read the clock now and then, and ease toward it
    if (skyMode === "live" && frameNo % 1800 === 0) Object.assign(skyTarget, skyAt(clockHour()));
    if (Math.abs(skyNow.day - skyTarget.day) + Math.abs(skyNow.dusk - skyTarget.dusk) > 0.002 || !skyApplied) {
      const e = reducedMotion || !skyApplied ? 1 : 1 - Math.exp(-2.5 * dt);
      skyNow.day += (skyTarget.day - skyNow.day) * e;
      skyNow.dusk += (skyTarget.dusk - skyNow.dusk) * e;
      applySky();
    }
    // the monitor's project layer: dip out, swap the picture, come back in
    {
      const swapping = projectNext && projectNext !== projectShown;
      const target = projectWanted && !swapping ? 1 : 0;
      if (projectLevel !== target || swapping) {
        projectLevel += (target - projectLevel) * (reducedMotion ? 1 : 1 - Math.exp(-(target ? 9 : 16) * dt));
        if (Math.abs(target - projectLevel) < 0.01) projectLevel = target;
        if (swapping && projectLevel === 0) projectShown = projectNext;
        if (!projectWanted && projectLevel === 0) projectShown = null;
        inter.setMonitorImage(projectShown, projectLevel);
      }
    }
    // lightning: two quick flickers through the window, then gone
    if (lightning > 0) {
      lightning = Math.max(0, lightning - dt * 2.2);
      const strobe = reducedMotion ? 0.4 : lightning > 0.75 ? 1 : lightning > 0.62 ? 0.15 : lightning > 0.45 ? 0.8 : lightning * 0.6;
      moon.intensity = windowLight() * (1 - blindLevel) + strobe * 30 * (1 - blindLevel * 0.8);
      if (lightning === 0) moon.intensity = windowLight() * (1 - blindLevel);
    }
    updateWeather(dt, time);
    updateIdle(dt, time);
    // the candle: eases toward lit or out, and the flame flickers on a few unrelated waves
    candleLevel += (candleTarget - candleLevel) * (reducedMotion ? 1 : 1 - Math.exp(-(candleTarget ? 3 : 9) * dt));
    if (Math.abs(candleTarget - candleLevel) < 0.002) candleLevel = candleTarget;
    const candleFlicker = reducedMotion ? 1 : 1 + 0.09 * Math.sin(time * 9.3) + 0.06 * Math.sin(time * 23.7 + 1.3) + 0.05 * Math.sin(time * 4.1 + 2.1);
    inter.candle.setLit(candleLevel, candleFlicker, time);
    if (drawerLevel !== drawerTarget) {
      drawerLevel += (drawerTarget - drawerLevel) * (reducedMotion ? 1 : 1 - Math.exp(-7 * dt));
      if (Math.abs(drawerTarget - drawerLevel) < 0.002) drawerLevel = drawerTarget;
      inter.drawer.setOpen(drawerLevel);
      shadowsDirty = true;
    }
    // sparkles: fly, slow, fall, fade
    if (sparks.visible) {
      let alive = false;
      for (let i = 0; i < SPARKS; i++) {
        if (sparkLife[i] <= 0) continue;
        alive = true;
        sparkLife[i] -= dt;
        sparkVel[i * 3 + 1] -= 1.6 * dt;
        for (let a = 0; a < 3; a++) {
          sparkVel[i * 3 + a] *= 1 - 2.4 * dt;
          sparkPos[i * 3 + a] += sparkVel[i * 3 + a] * dt;
        }
        if (sparkLife[i] <= 0) sparkPos[i * 3 + 1] = -10;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparkMat.opacity = 1;
      sparks.visible = alive;
    }
    // dust: each mote circles slowly in the lamp's cone, brighter the brighter the lamp
    dust.visible = lampLevel > 0.05 && mode === "room";
    if (dust.visible) {
      for (let i = 0; i < DUST; i++) {
        const [ph, h, r] = [dustSeed[i * 3], dustSeed[i * 3 + 1], dustSeed[i * 3 + 2]];
        const a = ph + time * (0.05 + h * 0.06);
        const y = ((h + time * 0.012) % 1) * (lampAt.y - 0.05);
        const spread = r * (0.35 + (1 - y / lampAt.y) * 0.6);
        dustPos[i * 3] = lampAt.x - 0.2 + Math.cos(a) * spread;
        dustPos[i * 3 + 1] = y + Math.sin(time * 0.7 + ph) * 0.02;
        dustPos[i * 3 + 2] = lampAt.z + 0.25 + Math.sin(a) * spread;
      }
      dustGeo.attributes.position.needsUpdate = true;
      dustMat.opacity = 0.45 * Math.min(1, lampLevel);
    }
    // the shooting star, only while the sky is in view
    if (!reducedMotion && sky.visible && skyNow.day + skyNow.dusk < 0.3) {
      if (starRun.t >= 1) {
        starRun.next -= dt;
        star.visible = false;
        if (starRun.next <= 0) {
          starRun.t = 0;
          starRun.next = 9 + Math.random() * 14;
          starRun.from.set(sky.position.x + (Math.random() - 0.2) * 3, sky.position.y + 1.2 + Math.random() * 0.8, sky.position.z + 0.05);
          starRun.dir.set(-(0.7 + Math.random() * 0.4), -(0.35 + Math.random() * 0.3), 0).normalize();
          star.rotation.z = Math.atan2(starRun.dir.y, starRun.dir.x);
        }
      } else {
        starRun.t = Math.min(1, starRun.t + dt / 0.9);
        star.visible = true;
        star.position.copy(starRun.from).addScaledVector(starRun.dir, starRun.t * 3.2);
        starMat.opacity = Math.sin(starRun.t * Math.PI);
      }
    } else star.visible = false;
    // the plushies breathe, each at its own pace, unless one is mid-squeeze
    if (!reducedMotion)
      inter.plushies.forEach((p, i) => {
        if (bounces.has(p.group)) return;
        const b = Math.sin(time * (1.1 + i * 0.17) + i * 1.7) * 0.012;
        p.group.scale.set(1 - b * 0.4, 1 + b, 1 - b * 0.4);
      });
    if (bounces.size) shadowsDirty = true;
    for (const [g, age] of bounces) {
      const t2 = age + dt;
      // a quick squash, then a damped spring back to rest
      const s2 = reducedMotion ? 0 : Math.exp(-t2 * 6) * Math.sin(t2 * 22) * 0.22;
      g.scale.set(1 + s2 * 0.6, 1 - s2, 1 + s2 * 0.6);
      if (t2 > 1.2) {
        g.scale.set(1, 1, 1);
        bounces.delete(g);
      } else bounces.set(g, t2);
    }
    let mistAlive = false;
    for (let i = 0; i < MIST; i++) {
      if (mistLife[i] <= 0) continue;
      mistAlive = true;
      mistLife[i] -= dt * 0.8;
      for (let a = 0; a < 3; a++) {
        mistPos[i * 3 + a] += mistVel[i * 3 + a] * dt;
        mistVel[i * 3 + a] *= 1 - dt * 2.2; // drag: the cloud slows and hangs
      }
      mistVel[i * 3 + 1] += dt * 0.02;
      if (mistLife[i] <= 0) mistPos[i * 3 + 1] = -10;
    }
    if (mistAlive) mistGeo.attributes.position.needsUpdate = true;
    mist.visible = mistAlive;
    // the radio reports its kick drum; an outside player gets a steady 90 bpm beat instead
    // hover glow and lifts
    if (mode !== "room" && outlineTarget) setHover(null);
    // draw in fast (~180 ms to settle), fade out a little quicker; then a slow, faint breath
    outlineLevel = reducedMotion ? outlineTarget : outlineLevel + (outlineTarget - outlineLevel) * (1 - Math.exp(-(outlineTarget ? 16 : 22) * dt));
    if (outlineLevel < 0.01 && !outlineTarget) {
      outlineLevel = 0;
      outline.selectedObjects = [];
    }
    const breath = reducedMotion ? 1 : 1 + 0.12 * Math.sin((time - outlineSince) * 2.2);
    outline.edgeStrength = 3.2 * outlineLevel * breath;
    if (lifts.size) shadowsDirty = true;
    for (const [obj, l] of lifts) {
      if (reducedMotion) l.off = l.target;
      else {
        // a spring with a little give: stiffness 320, damping ratio about 0.55. Stepped in small
        // fixed slices (semi-implicit Euler), so a slow frame can't make it overshoot and blow up.
        const k = 320;
        const c = 2 * 0.55 * Math.sqrt(k);
        for (let left = dt; left > 0; left -= 1 / 240) {
          const h = Math.min(left, 1 / 240);
          l.vel += (k * (l.target - l.off) - c * l.vel) * h;
          l.off += l.vel * h;
        }
      }
      obj.position.y = l.base + l.off;
      if (l.target === 0 && Math.abs(l.off) < 0.0003 && Math.abs(l.vel) < 0.003) {
        obj.position.y = l.base;
        lifts.delete(obj);
      }
    }
    const pulse = Math.max(audio.radioPulse(), speakerPlaying && !reducedMotion ? Math.exp(-((time * 1.5) % 1) * 7) : 0);
    inter.speaker.scale.set(1 + pulse * 0.04, 1 + pulse * 0.07, 1 + pulse * 0.04);

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
      for (const w of walls) {
        const show = toCamera.subVectors(camera.position, w.point).dot(w.inward) > -0.05;
        if (show !== w.group.visible) shadowsDirty = true;
        w.group.visible = show;
      }
      const ceilingShown = camera.position.y < height;
      if (ceilingShown !== ceiling.visible) shadowsDirty = true;
      ceiling.visible = ceilingShown;
      const p = camera.position;
      sky.visible = p.x > left && p.x < right && p.z > back && p.z < front && p.y < height;
    }

    // behind the PlayStation screen the room is all but covered, so once the camera has arrived it
    // redraws only a few times a second and leaves the device to the game
    frameNo++;
    const behindConsole = mode === "console" && !tween && !fade;
    if (behindConsole && frameNo % 8 !== 0) return;
    adaptResolution(dt, behindConsole);
    updateShadows();
    updateGlows();
    steam.update(time, camera);
    if (outline.selectedObjects.length) composer.render(dt);
    else renderer.render(scene, camera);
    if (!firstFrameSent) {
      firstFrameSent = true;
      options.onFirstFrame?.();
    }
    if (maskMat.uniforms.uMask.value > 0 || maskMat.uniforms.uFade.value > 0) {
      renderer.autoClear = false;
      renderer.render(overlay, overlayCam);
      renderer.autoClear = true;
    }
  });

  return {
    setView,
    toggleLamp,
    toggleLight,
    toggleRadio,
    setMuted: (m) => audio.setMuted(m),
    setSound: applySound,
    chime: () => audio.play("chime"),
    showProject,
    focusMonitor,
    setSky,
    setSpeakerPlaying: (on) => (speakerPlaying = on),
    setLamp,
    dispose: () => {
      renderer.domElement.removeEventListener("touchstart", onTouchStart);
      renderer.domElement.removeEventListener("touchmove", onTouchMove);
      renderer.domElement.removeEventListener("touchend", onTouchEnd);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
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
      for (const t of sunsetDiscs.values()) t.dispose();
      env.dispose();
      composer.dispose();
      outline.dispose();
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      audio.dispose();
      overlayQuad.geometry.dispose();
      maskMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
