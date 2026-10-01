import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { createFurniture, paintTexture } from "./createFurniture";
import { CLOSET, COLORS, DOOR, HERO, LAYOUT, ROOM, WINDOW } from "./roomLayout";

/**
 * A plain recreation of the real room: the shell, furniture and night lighting, with orbit
 * controls. Walls between the camera and the room hide themselves, so orbiting out gives a
 * dollhouse view. No effects, sound or animation beyond the camera.
 */

export type PlainRoomView = "photo" | "dollhouse" | "desk" | "door";

export interface PlainRoomHandle {
  setView: (view: PlainRoomView) => void;
  dispose: () => void;
}

const vec = (v: [number, number, number]) => new THREE.Vector3(...v);

// camera poses; the photo view keeps the hero framing but pivots about a point inside the room
const heroPos = vec(HERO.pos);
const heroDir = vec(HERO.target).sub(heroPos).normalize();
const VIEWS: Record<PlainRoomView, { pos: THREE.Vector3; target: THREE.Vector3 }> = {
  photo: { pos: heroPos, target: heroPos.clone().addScaledVector(heroDir, 2.2) },
  dollhouse: { pos: new THREE.Vector3(-3.4, 4.8, ROOM.midZ + 4.7), target: new THREE.Vector3(0.1, 0.5, ROOM.midZ) },
  // matches photo F: from the foot of the bed, looking into the corner with the lamp and the end of the desk
  desk: { pos: new THREE.Vector3(-0.15, 1.7, 0.6), target: new THREE.Vector3(1.0, 0.3, -1.2) },
  // matches photo E: from beside the desk, looking at the entry door and the closet
  door: { pos: new THREE.Vector3(0.35, 1.5, -0.45), target: new THREE.Vector3(0.0, 1.0, ROOM.front) },
};

export function createPlainRoom(container: HTMLElement): PlainRoomHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);
  RectAreaLightUniformsLib.init();

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
    // night outside the glass
    const night = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), new THREE.MeshBasicMaterial({ color: "#0b1018" }));
    night.position.set((x0 + x1) / 2, (y0 + y1) / 2, back - t + 0.005);
    backWall.add(night);
    // blind: cassette at the top, fabric down to the sill
    const blindH = (y1 - y0) * WINDOW.blindDown;
    slab(x1 - x0 - 0.02, 0.07, 0.07, new THREE.MeshStandardMaterial({ color: "#ecebe6", roughness: 0.5 }), (x0 + x1) / 2, y1 - 0.035, back - t + 0.09, backWall);
    const blind = slab(x1 - x0 - 0.05, blindH - 0.07, 0.004, new THREE.MeshStandardMaterial({ color: COLORS.blind, roughness: 0.9 }), (x0 + x1) / 2, y1 - 0.07 - (blindH - 0.07) / 2, back - t + 0.08, backWall);
    blind.castShadow = false;
    slab(x1 - x0 - 0.04, 0.012, 0.02, new THREE.MeshStandardMaterial({ color: "#b9b9b9", roughness: 0.4, metalness: 0.6 }), (x0 + x1) / 2, y1 - blindH, back - t + 0.08, backWall);
    slab(W, 0.1, 0.015, trim, 0, 0.05, back + 0.0075, backWall);
  }

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
    const steelMat = new THREE.MeshStandardMaterial({ color: "#b4b7bb", metalness: 0.3, roughness: 0.35 });
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

  const furniture = createFurniture();
  scene.add(furniture.group);

  // ---------- night lighting ----------
  scene.add(new THREE.HemisphereLight("#fff1dc", "#3b352e", 0.9));
  // light bouncing off the pale walls and ceiling: a soft, shadowless fill from above the room
  const bounce = new THREE.PointLight("#ffe2c0", 1.4, 0, 1.2);
  bounce.position.set(0.1, height - 0.3, ROOM.midZ);
  scene.add(bounce);

  // the floor lamp is the room's main light
  const lamp = new THREE.PointLight("#ffd6a0", 5.5, 0, 1.6);
  lamp.position.copy(furniture.lampBulb);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  lamp.shadow.bias = -0.002;
  lamp.shadow.radius = 4;
  lamp.shadow.camera.near = 0.05;
  scene.add(lamp);
  // the bright scallop the open shade throws up the corner
  const upLight = new THREE.SpotLight("#ffd9a8", 6, 2.2, 0.75, 0.8, 1.5);
  upLight.position.copy(furniture.lampBulb).add(new THREE.Vector3(0, 0.1, 0));
  upLight.target.position.copy(furniture.lampBulb).add(new THREE.Vector3(0, 2, 0));
  scene.add(upLight, upLight.target);

  for (const s of furniture.screens) {
    const area = new THREE.RectAreaLight(s.color, s.strength, s.w, s.h);
    area.position.copy(s.center);
    area.lookAt(s.center.clone().add(s.normal));
    scene.add(area);
  }

  // ---------- views ----------
  let tween: { fromPos: THREE.Vector3; fromTarget: THREE.Vector3; to: (typeof VIEWS)[PlainRoomView]; t: number } | null = null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const setView = (view: PlainRoomView) => {
    if (reducedMotion) {
      camera.position.copy(VIEWS[view].pos);
      controls.target.copy(VIEWS[view].target);
      return;
    }
    tween = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), to: VIEWS[view], t: 0 };
  };
  controls.addEventListener("start", () => (tween = null));

  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    // keep the room's width in frame on narrow screens
    camera.fov = w / h < 1 ? Math.min(90, HERO.fov * 1.35) : HERO.fov;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(onResize);
  ro.observe(container);
  onResize();

  const clock = new THREE.Clock();
  const toCamera = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / 1.4);
      const e = tween.t < 0.5 ? 4 * tween.t ** 3 : 1 - (-2 * tween.t + 2) ** 3 / 2;
      camera.position.lerpVectors(tween.fromPos, tween.to.pos, e);
      controls.target.lerpVectors(tween.fromTarget, tween.to.target, e);
      if (tween.t >= 1) tween = null;
    }
    controls.update();
    // dollhouse cutaway: hide any wall the camera is behind, and the ceiling from above
    for (const w of walls) w.group.visible = toCamera.subVectors(camera.position, w.point).dot(w.inward) > -0.05;
    ceiling.visible = camera.position.y < height;
    renderer.render(scene, camera);
  });

  return {
    setView,
    dispose: () => {
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
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
