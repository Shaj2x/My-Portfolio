import * as THREE from "three";

/*
 * A seated person seen mostly from behind: sculpted from lofted and tapered
 * tube geometry rather than primitives, so the silhouette reads as a body
 * (shoulder blades, spine groove, sweater folds, curly hair) under the
 * grazing laptop light.
 *
 * Local space: y = 0 is the seat surface, -z is the direction they face.
 */

type Track = <T extends { dispose: () => void }>(d: T) => T;

export interface Figure {
  group: THREE.Group;
  torso: THREE.Mesh;
  head: THREE.Group;
  /** call every frame for breathing and small head movement */
  update: (t: number, still: boolean) => void;
  /** glance down at the phone shortly after time t (e.g. when it buzzes) */
  lookAtPhone: (t: number) => void;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const gauss = (d2: number, w: number) => Math.exp(-d2 / w);
const spow = (v: number, p: number) => Math.sign(v) * Math.abs(v) ** p;

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** Sample a key-framed profile (rows of numbers keyed by their first column) with Catmull-Rom. */
function sampleProfile(keys: number[][], y: number) {
  let i = 0;
  while (i < keys.length - 2 && y > keys[i + 1][0]) i++;
  const k0 = keys[Math.max(0, i - 1)];
  const k1 = keys[i];
  const k2 = keys[i + 1];
  const k3 = keys[Math.min(keys.length - 1, i + 2)];
  const t = Math.min(1, Math.max(0, (y - k1[0]) / (k2[0] - k1[0])));
  return k1.map((_, c) => catmull(k0[c], k1[c], k2[c], k3[c], t));
}

/** A tube along a smooth curve whose radius varies along its length. */
function limbGeometry(points: THREE.Vector3[], radii: number[], tubular = 48, radial = 20) {
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
  const geo = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const center = new THREE.Vector3();
  const v = new THREE.Vector3();
  const radiusAt = (u: number) => {
    const f = u * (radii.length - 1);
    const i = Math.min(radii.length - 2, Math.floor(f));
    return THREE.MathUtils.lerp(radii[i], radii[i + 1], smooth(0, 1, f - i));
  };
  for (let i = 0; i <= tubular; i++) {
    const u = i / tubular;
    curve.getPointAt(u, center);
    const r = radiusAt(u);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(center).multiplyScalar(r).add(center);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return { geo, curve, startR: radii[0], endR: radii[radii.length - 1] };
}

function knitTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, 256, 256);
  // vertical ribs made of small V-shaped stitches
  for (let x = 0; x < 256; x += 8) {
    for (let y = 0; y < 256; y += 6) {
      const g = ctx.createLinearGradient(x, 0, x + 8, 0);
      g.addColorStop(0, "#5a5a5a");
      g.addColorStop(0.5, "#b4b4b4");
      g.addColorStop(1, "#5a5a5a");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 4, y + 4);
      ctx.lineTo(x + 8, y);
      ctx.lineTo(x + 8, y + 3);
      ctx.lineTo(x + 4, y + 7);
      ctx.lineTo(x, y + 3);
      ctx.fill();
    }
  }
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? "255,255,255" : "0,0,0"},0.06)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function denimTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  for (let i = -128; i < 128; i += 3) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 128, 128);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createFigure(track: Track, rand: () => number): Figure {
  const rr = (a: number, b: number) => a + rand() * (b - a);
  const group = new THREE.Group();

  const knit = track(knitTexture());
  const knitMap = track(knit.clone());
  knitMap.colorSpace = THREE.SRGBColorSpace;
  knit.repeat.set(3, 3);
  knitMap.repeat.set(3, 3);
  const sweaterMat = track(
    new THREE.MeshPhysicalMaterial({
      color: "#1f2025",
      map: knitMap,
      bumpMap: knit,
      bumpScale: 1.4,
      roughness: 0.92,
      sheen: 0.5,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color("#4a403a"),
    }),
  );
  const denim = track(denimTexture());
  denim.repeat.set(4, 4);
  const pantsMat = track(new THREE.MeshStandardMaterial({ color: "#1f2533", bumpMap: denim, bumpScale: 0.6, roughness: 0.85 }));
  const skinMat = track(
    new THREE.MeshPhysicalMaterial({
      color: "#6a3f2b",
      roughness: 0.52,
      sheen: 0.35,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color("#ff9a70"),
    }),
  );
  const shoeMat = track(new THREE.MeshStandardMaterial({ color: "#1a1a1c", roughness: 0.6 }));
  const soleMat = track(new THREE.MeshStandardMaterial({ color: "#c9c3b8", roughness: 0.8 }));

  // everything above the hips hangs off this pivot so the body can lean as one piece
  const upper = new THREE.Group();
  group.add(upper);

  const add = (geo: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = upper) => {
    const m = new THREE.Mesh(track(geo), material);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const cap = (p: THREE.Vector3, r: number, material: THREE.Material, parent: THREE.Object3D = upper) => {
    const m = add(new THREE.SphereGeometry(r, 20, 14), material, parent);
    m.position.copy(p);
    return m;
  };
  const limb = (points: THREE.Vector3[], radii: number[], material: THREE.Material, caps = true, parent: THREE.Object3D = upper) => {
    const { geo, startR, endR } = limbGeometry(points, radii);
    const mesh = add(geo, material, parent);
    if (caps) {
      cap(points[0], startR, material, parent);
      cap(points[points.length - 1], endR, material, parent);
    }
    return mesh;
  };

  // ---------- torso: lofted superellipse sections ----------
  // columns: y, half-width, half-depth, z-centre (leans forward), squareness
  const TORSO = [
    [0.0, 0.165, 0.125, 0.03, 2.2],
    [0.1, 0.168, 0.128, 0.02, 2.2],
    [0.2, 0.15, 0.11, 0.0, 2.3],
    [0.32, 0.163, 0.117, -0.03, 2.4],
    [0.44, 0.188, 0.118, -0.06, 2.7],
    [0.52, 0.205, 0.104, -0.085, 3.0],
    [0.575, 0.168, 0.086, -0.1, 2.6],
    [0.61, 0.098, 0.066, -0.11, 2.2],
    [0.635, 0.058, 0.052, -0.115, 2.0],
  ];
  const RINGS = 60;
  const RADIAL = 56;
  const tPos: number[] = [];
  const tUv: number[] = [];
  const tIdx: number[] = [];
  for (let i = 0; i <= RINGS; i++) {
    const y = (i / RINGS) * 0.635;
    const [, a, b, zc, n] = sampleProfile(TORSO, y);
    for (let j = 0; j <= RADIAL; j++) {
      // start the seam at the front (-z), where it's never seen
      const th = -Math.PI / 2 + (j / RADIAL) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const x = a * spow(c, 2 / n);
      let z = zc + b * spow(s, 2 / n);
      let off = 0;
      if (s > 0) {
        // back: shoulder blades, spine groove, and loose folds at the waist
        off += 0.012 * gauss((Math.abs(x) - 0.075) ** 2 / 0.003 + (y - 0.43) ** 2 / 0.006, 1) * s;
        off -= 0.006 * gauss(x * x, 0.0007) * smooth(0.08, 0.2, y) * (1 - smooth(0.5, 0.58, y)) * s;
        off += 0.0045 * Math.sin(y * 95 + x * 14) * (1 - smooth(0.12, 0.26, y)) * s;
      }
      // sweater hem bunching over the hips
      off += 0.006 * gauss((y - 0.06) ** 2, 0.0006);
      const nx = x === 0 && z === zc ? 0 : x / Math.hypot(x, z - zc);
      const nz = (z - zc) / Math.max(1e-6, Math.hypot(x, z - zc));
      z += nz * off;
      tPos.push(x + nx * off, y, z);
      tUv.push((j / RADIAL) * 2, y * 2.2);
    }
  }
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < RADIAL; j++) {
      const a = i * (RADIAL + 1) + j;
      const b = a + RADIAL + 1;
      tIdx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const torsoGeo = new THREE.BufferGeometry();
  torsoGeo.setAttribute("position", new THREE.Float32BufferAttribute(tPos, 3));
  torsoGeo.setAttribute("uv", new THREE.Float32BufferAttribute(tUv, 2));
  torsoGeo.setIndex(tIdx);
  torsoGeo.computeVertexNormals();
  const torso = add(torsoGeo, sweaterMat);

  // ribbed crew-neck collar
  const collar = add(new THREE.TorusGeometry(0.056, 0.011, 10, 32), sweaterMat);
  collar.position.set(0, 0.628, -0.116);
  collar.rotation.x = Math.PI / 2 - 0.25;

  // ---------- neck and head ----------
  limb([new THREE.Vector3(0, 0.6, -0.113), new THREE.Vector3(0, 0.66, -0.125), new THREE.Vector3(0, 0.72, -0.142)], [0.047, 0.045, 0.043], skinMat, false);

  const head = new THREE.Group();
  head.position.set(0, 0.8, -0.155);
  const HEAD_BASE = new THREE.Euler(0.14, -0.3, 0.02);
  head.rotation.copy(HEAD_BASE);
  upper.add(head);

  const HX = 0.074;
  const HY = 0.098;
  const HZ = 0.092;
  const skull = (d: THREE.Vector3) => {
    // unit-sphere direction → head surface point (d.z > 0 is the back)
    let x = d.x;
    const y = d.y;
    let z = d.z;
    z *= 1 + 0.1 * Math.max(0, z) * (1 - Math.abs(y) * 0.5); // occipital bulge
    if (y < -0.15) {
      const k = (-y - 0.15) / 0.85;
      x *= 1 - 0.38 * k; // jaw narrows toward the chin
      if (z < 0) z -= 0.18 * k * -z; // chin forward
      if (z > 0) z *= 1 - 0.35 * k; // nape tucks in
    }
    if (z < 0 && y > -0.3 && y < 0.3) x *= 1 + 0.04 * (1 - Math.abs(y) / 0.3); // cheekbones
    return new THREE.Vector3(x * HX, y * HY, z * HZ);
  };
  const headGeo = new THREE.SphereGeometry(1, 56, 40);
  {
    const p = headGeo.attributes.position as THREE.BufferAttribute;
    const d = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      d.fromBufferAttribute(p, i).normalize();
      const s = skull(d);
      p.setXYZ(i, s.x, s.y, s.z);
    }
    headGeo.computeVertexNormals();
  }
  add(headGeo, skinMat, head);
  // ears
  for (const side of [-1, 1]) {
    const ear = add(new THREE.SphereGeometry(1, 16, 12), skinMat, head);
    ear.scale.set(0.011, 0.028, 0.019);
    ear.position.set(side * (HX - 0.002), -0.008, 0.008);
    ear.rotation.set(0, side * 0.35, side * -0.1);
  }
  // nose and brow, only glimpsed in profile
  const nose = add(new THREE.ConeGeometry(0.014, 0.036, 12), skinMat, head);
  nose.position.set(0, -0.012, -HZ - 0.008);
  nose.rotation.x = -Math.PI / 2 + 0.35;

  // ---------- curly hair ----------
  const hairMat = track(
    new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      roughness: 0.7,
      sheen: 0.45,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color("#3a2a20"),
    }),
  );
  const onScalp = (d: THREE.Vector3) => {
    if (d.z < -0.3 && d.y < 0.42) return false; // face and forehead
    if (Math.abs(d.x) > 0.75 && d.y < 0.1 && d.z < 0.35) return false; // around the ears
    if (d.y < -0.25 && !(d.z > 0.45 && d.y > -0.5)) return false; // below the nape line
    return true;
  };
  const dir = new THREE.Vector3();
  const o = new THREE.Object3D();
  const hairColor = new THREE.Color();
  const scatter = (count: number, geo: THREE.BufferGeometry, lift: [number, number], size: [number, number], squash: boolean) => {
    const inst = new THREE.InstancedMesh(track(geo), hairMat, count);
    let n = 0;
    while (n < count) {
      dir.set(rr(-1, 1), rr(-1, 1), rr(-1, 1));
      if (dir.lengthSq() > 1 || dir.lengthSq() < 0.01) continue;
      dir.normalize();
      if (!onScalp(dir)) continue;
      // hair is fuller on top and at the back
      const volume = 1 + 0.6 * Math.max(0, dir.y) + 0.25 * Math.max(0, dir.z);
      o.position.copy(skull(dir)).addScaledVector(dir, rr(lift[0], lift[1]) * volume);
      o.rotation.set(rr(0, Math.PI * 2), rr(0, Math.PI * 2), rr(0, Math.PI * 2));
      const s = rr(size[0], size[1]);
      if (squash) o.scale.set(s, s * rr(0.7, 1.1), s * rr(0.7, 1));
      else o.scale.setScalar(s);
      o.updateMatrix();
      inst.setMatrixAt(n, o.matrix);
      const l = rr(0.012, 0.032);
      inst.setColorAt(n, hairColor.setRGB(l * 1.25, l * 0.95, l * 0.75));
      n++;
    }
    inst.castShadow = true;
    inst.receiveShadow = true;
    head.add(inst);
  };
  // dense clumps forming the volume, then loose coils for a soft, curly silhouette
  scatter(560, new THREE.IcosahedronGeometry(1, 1), [0.004, 0.026], [0.016, 0.026], true);
  scatter(260, new THREE.TorusGeometry(1, 0.38, 6, 12), [0.022, 0.044], [0.009, 0.014], false);

  // ---------- arms ----------
  const R_SLEEVE = [0.06, 0.055, 0.049, 0.045, 0.041, 0.037, 0.04];
  const rightArm = [
    new THREE.Vector3(0.165, 0.545, -0.085),
    new THREE.Vector3(0.225, 0.43, -0.1),
    new THREE.Vector3(0.285, 0.31, -0.2),
    new THREE.Vector3(0.345, 0.27, -0.38),
    new THREE.Vector3(0.41, 0.262, -0.56),
  ];
  limb(rightArm, R_SLEEVE, sweaterMat);
  const leftArm = [
    new THREE.Vector3(-0.165, 0.545, -0.085),
    new THREE.Vector3(-0.225, 0.43, -0.16),
    new THREE.Vector3(-0.2, 0.31, -0.36),
    new THREE.Vector3(-0.155, 0.275, -0.45),
    new THREE.Vector3(-0.095, 0.43, -0.4),
    new THREE.Vector3(-0.035, 0.6, -0.315),
  ];
  limb(leftArm, R_SLEEVE, sweaterMat);

  // hands: a palm with four curled fingers and a thumb, oriented along the forearm
  const makeHand = (wrist: THREE.Vector3, forward: THREE.Vector3, up: THREE.Vector3, curl: number, mirror: number) => {
    const hand = new THREE.Group();
    hand.position.copy(wrist);
    // lookAt points local +z away from the target, so aiming at `forward` runs the fingers (-z) along it
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), forward, up);
    hand.quaternion.setFromRotationMatrix(m);
    upper.add(hand);
    const fingers: THREE.Group[] = [];
    const palm = add(new THREE.SphereGeometry(1, 20, 14), skinMat, hand);
    palm.scale.set(0.036, 0.015, 0.045);
    palm.position.z = -0.04;
    for (let f = 0; f < 4; f++) {
      const x = (f - 1.5) * 0.0175;
      const len = [0.042, 0.048, 0.046, 0.036][f];
      const pts = [];
      for (let k = 0; k <= 3; k++) {
        const a = (k / 3) * curl;
        pts.push(new THREE.Vector3(x, -Math.sin(a) * len * 0.6, -0.075 - Math.cos(a) * len * (k / 3)));
      }
      // each finger hinges at its knuckle so it can tap
      const knuckle = pts[0].clone();
      const finger = new THREE.Group();
      finger.position.copy(knuckle);
      hand.add(finger);
      fingers.push(finger);
      for (const pt of pts) pt.sub(knuckle);
      const { geo } = limbGeometry(pts, [0.0085, 0.0078, 0.007], 12, 10);
      add(geo, skinMat, finger);
      const tip = add(new THREE.SphereGeometry(0.007, 10, 8), skinMat, finger);
      tip.position.copy(pts[pts.length - 1]);
    }
    const thumb = limbGeometry(
      [new THREE.Vector3(mirror * 0.03, -0.004, -0.025), new THREE.Vector3(mirror * 0.048, -0.01, -0.055), new THREE.Vector3(mirror * 0.05, -0.016, -0.08)],
      [0.011, 0.0095, 0.008],
      12,
      10,
    );
    add(thumb.geo, skinMat, hand);
    return { hand, fingers };
  };
  const rWrist = rightArm[rightArm.length - 1];
  const rWristRest = rWrist.clone().add(new THREE.Vector3(0.004, -0.012, -0.012));
  const typingHand = makeHand(rWrist.clone().add(new THREE.Vector3(0.004, -0.012, -0.012)), new THREE.Vector3(0.28, -0.05, -1).normalize(), new THREE.Vector3(0, 1, 0), 0.5, -1);
  const lWrist = leftArm[leftArm.length - 1];
  // left hand cupped under the chin, palm facing the face
  makeHand(lWrist.clone().add(new THREE.Vector3(0.008, 0.02, 0.004)), new THREE.Vector3(0.35, 0.8, 0.1).normalize(), new THREE.Vector3(0, 0, -1), 1.1, 1);

  // ---------- legs ----------
  for (const side of [-1, 1]) {
    const x = side * 0.088;
    limb(
      [
        new THREE.Vector3(x, 0.07, 0.03),
        new THREE.Vector3(x * 1.05, 0.078, -0.18),
        new THREE.Vector3(x * 1.2, 0.085, -0.42),
        new THREE.Vector3(x * 1.25, -0.12, -0.47),
        new THREE.Vector3(x * 1.25, -0.44, -0.46),
      ],
      [0.086, 0.08, 0.062, 0.052, 0.046],
      pantsMat,
      true,
      group,
    );
    const shoe = add(new THREE.SphereGeometry(1, 24, 16), shoeMat, group);
    shoe.scale.set(0.048, 0.042, 0.13);
    shoe.position.set(x * 1.25, -0.49, -0.53);
    const sole = add(new THREE.CylinderGeometry(1, 1, 1, 24), soleMat, group);
    sole.scale.set(0.05, 0.018, 0.135);
    sole.position.set(x * 1.25, -0.52, -0.53);
  }

  // ---------- idle behaviour ----------
  // Head glances: every so often look down at the phone or out of the window, hold, and come back.
  const GLANCES = [
    { x: 0.32, y: -0.52, z: 0.0 }, // phone, down and to the right
    { x: -0.06, y: -0.62, z: -0.03 }, // window, up and further right
    { x: 0.05, y: 0.12, z: 0.04 }, // a moment of thought, looking away from the screen
  ];
  let glance = { x: 0, y: 0, z: 0 };
  let glanceStart = 7;
  let glanceHold = 2.4;
  const glanceMove = 0.9;
  const easeInOut = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
  // Typing comes in bursts with pauses to read
  const typingAt = (t: number) => {
    const cycle = t % 9;
    return smooth(0.3, 0.8, cycle) * (1 - smooth(4.6, 5.2, cycle));
  };
  const FINGER_PHASE = [0, 2.1, 4.3, 1.2];
  const FINGER_RATE = [11.3, 13.7, 12.1, 10.4];

  const update = (t: number, still: boolean) => {
    const b = Math.sin(t * 1.35);
    torso.scale.set(1 + b * 0.006, 1 + b * 0.004, 1 + b * 0.012);
    if (still) return;

    // slow lean toward the screen and back, with a slight weight shift
    const lean = Math.sin(t * 0.11) * 0.5 + Math.sin(t * 0.047 + 2) * 0.5;
    upper.rotation.set(0.025 + lean * 0.03 + b * 0.004, Math.sin(t * 0.07) * 0.012, Math.sin(t * 0.09 + 1) * 0.01);

    // head glance state
    if (t > glanceStart + glanceMove * 2 + glanceHold) {
      glance = GLANCES[Math.floor(rand() * GLANCES.length)];
      glanceStart = t + 6 + rand() * 9;
      glanceHold = 1.6 + rand() * 1.8;
    }
    const since = t - glanceStart;
    let g = 0;
    if (since > 0) {
      if (since < glanceMove) g = easeInOut(since / glanceMove);
      else if (since < glanceMove + glanceHold) g = 1;
      else g = 1 - easeInOut(Math.min(1, (since - glanceMove - glanceHold) / glanceMove));
    }
    head.rotation.set(
      HEAD_BASE.x + Math.sin(t * 0.45) * 0.018 + b * 0.004 + glance.x * g,
      HEAD_BASE.y + Math.sin(t * 0.21 + 1) * 0.035 + glance.y * g,
      HEAD_BASE.z + Math.sin(t * 0.33) * 0.01 + glance.z * g,
    );

    // typing: fingers tap in quick, uneven strokes; they rest while he looks away
    const typing = typingAt(t) * (1 - g);
    typingHand.fingers.forEach((f, i) => {
      const tap = Math.max(0, Math.sin(t * FINGER_RATE[i] + FINGER_PHASE[i])) ** 6;
      f.rotation.x = -0.05 - tap * 0.4 * typing;
    });
    typingHand.hand.position.x = rWristRest.x + Math.sin(t * 0.8) * 0.006 * typing;
  };

  const lookAtPhone = (t: number) => {
    glance = GLANCES[0];
    glanceStart = t + 0.35; // a beat of reaction time
    glanceHold = 2.4;
  };

  return { group, torso, head, update, lookAtPhone };
}
