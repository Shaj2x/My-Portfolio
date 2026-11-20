import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/*
 * First-person arms for sitting at the desk: two hands in hoodie sleeves, reaching from just
 * below the camera to the desk. The right hand follows the cursor across the desk (it rides the
 * mouse), the left rests on the keyboard and drifts a little with it, and a click taps a finger.
 * Everything is placed in world space each frame from the camera, so the arms stay attached to
 * "you" as the head turns.
 */

export interface SeatedHands {
  /** the pointer in normalised device coordinates (-1..1, y up) */
  setPointer: (x: number, y: number) => void;
  /** a click: the index finger of the right hand taps */
  tap: () => void;
  update: (dt: number, time: number) => void;
  dispose: () => void;
}

export interface DeskArea {
  /** the height the palms rest at */
  y: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** where the left hand rests on the keyboard */
  keyboard: THREE.Vector3;
  /** where the right hand rests on the mouse */
  mouse: THREE.Vector3;
}

const SKIN = "#b98463";
const SLEEVE = "#26282e";

function buildHand(side: 1 | -1, skin: THREE.Material, sleeve: THREE.Material, geos: THREE.BufferGeometry[]) {
  const g = <T extends THREE.BufferGeometry>(geo: T) => {
    geos.push(geo);
    return geo;
  };
  // local frame: fingers point along +x, palm down (-y), the thumb on the inside (toward the body's middle)
  const hand = new THREE.Group();
  const palm = new THREE.Mesh(g(new RoundedBoxGeometry(0.088, 0.026, 0.078, 3, 0.012)), skin);
  hand.add(palm);
  const fingers: THREE.Group[] = [];
  const lengths = [0.05, 0.056, 0.053, 0.042];
  lengths.forEach((len, i) => {
    const pivot = new THREE.Group();
    // index nearest the thumb
    const z = (0.027 - i * 0.018) * -side;
    pivot.position.set(0.042, -0.002, z);
    const f = new THREE.Mesh(g(new THREE.CapsuleGeometry(0.0085, len - 0.017, 4, 8)), skin);
    f.rotation.z = -Math.PI / 2;
    f.position.x = len / 2;
    pivot.add(f);
    // a relaxed curl down onto the desk
    pivot.rotation.z = -0.32 - i * 0.03;
    hand.add(pivot);
    fingers.push(pivot);
  });
  const thumb = new THREE.Group();
  thumb.position.set(0.0, -0.004, 0.04 * -side);
  const tm = new THREE.Mesh(g(new THREE.CapsuleGeometry(0.0105, 0.03, 4, 8)), skin);
  tm.rotation.z = -Math.PI / 2;
  tm.position.x = 0.024;
  thumb.add(tm);
  thumb.rotation.y = 0.75 * side;
  thumb.rotation.z = -0.2;
  hand.add(thumb);
  // wrist and the cuff of the sleeve
  const wrist = new THREE.Mesh(g(new THREE.CylinderGeometry(0.026, 0.028, 0.05, 12)), skin);
  wrist.rotation.z = Math.PI / 2;
  wrist.position.x = -0.06;
  hand.add(wrist);
  const cuff = new THREE.Mesh(g(new THREE.CylinderGeometry(0.043, 0.04, 0.05, 14)), sleeve);
  cuff.rotation.z = Math.PI / 2;
  cuff.position.x = -0.1;
  hand.add(cuff);
  hand.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return { hand, fingers };
}

export function createSeatedHands(scene: THREE.Scene, camera: THREE.Camera, desk: DeskArea, reducedMotion: boolean): SeatedHands {
  const geos: THREE.BufferGeometry[] = [];
  const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.62 });
  const sleeve = new THREE.MeshStandardMaterial({ color: SLEEVE, roughness: 0.9 });
  const root = new THREE.Group();
  root.name = "seated-hands";
  scene.add(root);

  const sides = ([1, -1] as const).map((side) => {
    const { hand, fingers } = buildHand(side, skin, sleeve, geos);
    // the forearm in its sleeve: a unit-length cylinder stretched from the elbow to the cuff each frame
    const armGeo = new THREE.CylinderGeometry(0.05, 0.042, 1, 14, 1, true);
    armGeo.translate(0, 0.5, 0);
    geos.push(armGeo);
    const arm = new THREE.Mesh(armGeo, sleeve);
    arm.castShadow = true;
    root.add(hand, arm);
    const rest = side === 1 ? desk.mouse : desk.keyboard;
    return { side, hand, fingers, arm, pos: rest.clone(), target: rest.clone(), rest };
  });
  const [right, left] = sides;

  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -desk.y);
  const ndc = new THREE.Vector2(0.25, -0.35);
  const hit = new THREE.Vector3();
  let pointerSeen = false;
  let tapT = 1;

  const fwd = new THREE.Vector3();
  const rightDir = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const shoulder = new THREE.Vector3();
  const elbow = new THREE.Vector3();
  const cuffEnd = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  const clampToDesk = (v: THREE.Vector3) => {
    v.x = THREE.MathUtils.clamp(v.x, desk.minX, desk.maxX);
    v.z = THREE.MathUtils.clamp(v.z, desk.minZ, desk.maxZ);
    v.y = desk.y;
    return v;
  };

  return {
    setPointer: (x, y) => {
      ndc.set(x, y);
      pointerSeen = true;
    },
    tap: () => {
      tapT = 0;
    },
    update: (dt, time) => {
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      fwd.normalize();
      rightDir.crossVectors(fwd, up).normalize();

      // where the cursor points on the desk
      if (pointerSeen) {
        ray.setFromCamera(ndc, camera);
        if (ray.ray.intersectPlane(plane, hit)) {
          right.target.copy(clampToDesk(hit.clone()));
          // the left hand stays on the keyboard but leans a little toward where you're reaching
          left.target.copy(left.rest).addScaledVector(hit.clone().sub(right.rest), 0.12);
          clampToDesk(left.target);
        }
      }

      const follow = reducedMotion ? 1 : 1 - Math.exp(-dt * 9);
      tapT = Math.min(1, tapT + dt / 0.22);
      for (const s of sides) {
        s.pos.lerp(s.target, s === left ? follow * 0.5 : follow);
        const breathe = reducedMotion ? 0 : Math.sin(time * 1.6 + s.side) * 0.002;

        // the hand: palm on the desk, fingers pointing away from the shoulder
        shoulder.copy(camera.position).addScaledVector(rightDir, 0.2 * s.side).addScaledVector(up, -0.42).addScaledVector(fwd, -0.02);
        dir.subVectors(s.pos, shoulder);
        dir.y = 0;
        const yaw = Math.atan2(-dir.z, dir.x);
        s.hand.position.set(s.pos.x, s.pos.y + 0.014 + breathe, s.pos.z);
        s.hand.rotation.set(0, yaw, 0);
        // a slight roll outward, as hands rest
        s.hand.rotateX(0.18 * s.side);

        // the click: the right index finger lifts and taps
        if (s === right) {
          const lift = Math.sin(Math.min(1, tapT) * Math.PI);
          s.fingers[0].rotation.z = -0.32 + lift * 0.5;
        }

        // the forearm runs from the elbow (below and beside the shoulder) to the cuff behind the wrist
        cuffEnd.set(-0.12, 0, 0).applyQuaternion(s.hand.quaternion).add(s.hand.position);
        elbow.copy(shoulder).addScaledVector(rightDir, 0.06 * s.side).addScaledVector(up, -0.12).addScaledVector(fwd, 0.12);
        dir.subVectors(cuffEnd, elbow);
        const len = dir.length();
        s.arm.position.copy(elbow);
        s.arm.quaternion.setFromUnitVectors(yAxis, dir.normalize());
        s.arm.scale.set(1, len, 1);
      }
    },
    dispose: () => {
      scene.remove(root);
      geos.forEach((g) => g.dispose());
      skin.dispose();
      sleeve.dispose();
    },
  };
}
