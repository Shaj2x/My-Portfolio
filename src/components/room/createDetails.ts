import * as THREE from "three";

/*
 * Small signs of life for the room: steam off the coffee, a cat asleep on
 * the bed, a phone that buzzes with notifications, and a wall clock that
 * keeps ticking from 2:47.
 */

type Track = <T extends { dispose: () => void }>(d: T) => T;

const easeOutBack = (x: number) => {
  const c1 = 2.2;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};

// ---------- steam ----------

/** Wisps of steam: a few camera-facing ribbons whose shape is drawn by noise in the shader. */
export function createSteam(track: Track) {
  const group = new THREE.Group();
  const material = track(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(1.0, 0.86, 0.72) } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
        }
        float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
        void main() {
          float y = vUv.y;
          // the column sways more the higher it rises
          float x = vUv.x - 0.5 + sin(y * 5.0 - uTime * 1.1) * 0.16 * y + (fbm(vec2(y * 2.0, uTime * 0.3)) - 0.5) * 0.3 * y;
          float width = mix(0.08, 0.34, y);
          float body = smoothstep(width, 0.0, abs(x));
          float wisps = fbm(vec2(x * 7.0, y * 3.2 - uTime * 0.55));
          float a = body * smoothstep(0.35, 0.8, wisps) * smoothstep(0.0, 0.12, y) * (1.0 - smoothstep(0.55, 1.0, y));
          gl_FragColor = vec4(uColor, a * 0.32);
        }`,
    }),
  );
  const geo = track(new THREE.PlaneGeometry(0.11, 0.3));
  geo.translate(0, 0.15, 0);
  const ribbons: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(geo, material);
    m.position.x = (i - 0.5) * 0.012;
    m.renderOrder = 2;
    group.add(m);
    ribbons.push(m);
  }
  const camPos = new THREE.Vector3();
  const here = new THREE.Vector3();
  const update = (t: number, camera: THREE.Camera) => {
    material.uniforms.uTime.value = t;
    // turn to face the camera around the vertical axis only, so the steam always rises
    camera.getWorldPosition(camPos);
    group.getWorldPosition(here);
    const yaw = Math.atan2(camPos.x - here.x, camPos.z - here.z);
    ribbons.forEach((r, i) => (r.rotation.y = yaw + (i ? 0.5 : -0.2)));
  };
  return { group, update };
}

// ---------- cat ----------

function furTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#b07a45";
  ctx.fillRect(0, 0, 256, 128);
  // tabby stripes
  for (let x = 0; x < 256; x += 22) {
    ctx.fillStyle = "rgba(70,38,18,0.55)";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 8, 40, x - 6, 80, x + 6, 128);
    ctx.lineTo(x + 12, 128);
    ctx.bezierCurveTo(x + 2, 80, x + 16, 40, x + 8, 0);
    ctx.fill();
  }
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? "255,220,180" : "40,20,10"},0.12)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 128, 1, 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** A ginger tabby curled up asleep. Breathes, flicks its tail, twitches an ear, and lifts its head when poked. */
export function createCat(track: Track) {
  const group = new THREE.Group();
  const fur = track(furTexture());
  const furMat = track(
    new THREE.MeshPhysicalMaterial({ color: "#ffffff", map: fur, roughness: 0.85, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color("#ffcf99") }),
  );
  const darkMat = track(new THREE.MeshStandardMaterial({ color: "#2a1a10", roughness: 0.7 }));
  const pinkMat = track(new THREE.MeshStandardMaterial({ color: "#c9867a", roughness: 0.6 }));
  const parts: THREE.Mesh[] = [];
  const part = (geo: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = group) => {
    const m = new THREE.Mesh(track(geo), material);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    parts.push(m);
    return m;
  };

  // body: a squashed, slightly bean-shaped curl
  const bodyGeo = new THREE.SphereGeometry(1, 40, 28);
  {
    const p = bodyGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      // curl: pull the ends of the long axis toward the front (-z)
      p.setZ(i, z - x * x * 0.35);
      p.setY(i, p.getY(i) * (p.getY(i) < 0 ? 0.55 : 1)); // flat underside
    }
    bodyGeo.computeVertexNormals();
  }
  const body = part(bodyGeo, furMat);
  body.scale.set(0.2, 0.1, 0.13);
  body.position.y = 0.06;

  const headPivot = new THREE.Group();
  headPivot.position.set(0.14, 0.07, -0.07);
  group.add(headPivot);
  const headMesh = part(new THREE.SphereGeometry(1, 28, 20), furMat, headPivot);
  headMesh.scale.set(0.065, 0.055, 0.06);
  headMesh.position.set(0.035, 0.0, -0.01);
  const muzzle = part(new THREE.SphereGeometry(1, 16, 12), furMat, headPivot);
  muzzle.scale.set(0.03, 0.022, 0.028);
  muzzle.position.set(0.085, -0.014, -0.02);
  const nose = part(new THREE.SphereGeometry(0.007, 8, 6), pinkMat, headPivot);
  nose.position.set(0.113, -0.008, -0.022);
  // closed eyes
  for (const s of [-1, 1]) {
    const eye = part(new THREE.CapsuleGeometry(0.0022, 0.012, 3, 6), darkMat, headPivot);
    eye.rotation.set(0, 0, Math.PI / 2 + 0.3);
    eye.position.set(0.086, 0.012, -0.02 + s * 0.024);
  }
  const ears: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(0.03, 0.045, -0.01 + s * 0.032);
    ear.rotation.set(s * 0.35, 0, -0.25);
    headPivot.add(ear);
    const outer = part(new THREE.ConeGeometry(0.02, 0.04, 4), furMat, ear);
    outer.position.y = 0.018;
    const inner = part(new THREE.ConeGeometry(0.012, 0.028, 4), pinkMat, ear);
    inner.position.set(0.006, 0.015, 0);
    ears.push(ear);
  }
  // front paws tucked under the chin
  for (const s of [-1, 1]) {
    const paw = part(new THREE.SphereGeometry(1, 14, 10), furMat);
    paw.scale.set(0.035, 0.018, 0.022);
    paw.position.set(0.19, 0.015, -0.1 + s * 0.03);
  }

  // tail: a chain of segments wrapping around the body; the last few flick
  const TAIL = 14;
  const tailSegs: THREE.Mesh[] = [];
  const segGeo = new THREE.SphereGeometry(1, 12, 8);
  for (let i = 0; i < TAIL; i++) {
    const seg = part(segGeo, furMat);
    const r = 0.024 - i * 0.0009;
    seg.scale.setScalar(r);
    tailSegs.push(seg);
  }
  const tailRest = (i: number, flick: number) => {
    // around the back of the curl and along the front, ending near the nose
    const u = i / (TAIL - 1);
    const a = -2.2 + u * 2.7;
    const tip = Math.max(0, (u - 0.6) / 0.4);
    const x = Math.cos(a) * 0.19;
    const z = Math.sin(a) * 0.13 - 0.02 + Math.sin(u * Math.PI) * -0.02;
    return new THREE.Vector3(x, 0.03 + tip * tip * 0.04 * flick, z + tip * tip * 0.05 * flick);
  };

  // state
  let flickStart = -10;
  let twitchStart = -10;
  let nextFlick = 4;
  let nextTwitch = 7;
  let stirStart = -10;
  let lastT = 0;
  const stir = () => (stirStart = lastT);

  const update = (t: number, still: boolean) => {
    lastT = t;
    const breath = Math.sin(t * 2.1);
    body.scale.set(0.2 + breath * 0.002, 0.1 + breath * 0.004, 0.13 + breath * 0.003);
    if (!still) {
      if (t > nextFlick) {
        flickStart = t;
        nextFlick = t + 5 + Math.random() * 7;
      }
      if (t > nextTwitch) {
        twitchStart = t;
        nextTwitch = t + 6 + Math.random() * 9;
      }
    }
    const fT = t - flickStart;
    const flick = fT < 1.4 ? Math.sin((fT / 1.4) * Math.PI * 3) * Math.sin((fT / 1.4) * Math.PI) : 0;
    tailSegs.forEach((s, i) => s.position.copy(tailRest(i, flick)));
    const eT = t - twitchStart;
    ears[0].rotation.z = -0.25 - (eT < 0.35 ? Math.sin((eT / 0.35) * Math.PI * 2) * 0.35 : 0);
    // poked: lift the head, look around a moment, settle back down
    const sT = t - stirStart;
    const lift = sT < 0 || sT > 3.2 ? 0 : sT < 0.6 ? easeOutBack(sT / 0.6) : sT < 2.4 ? 1 : 1 - (sT - 2.4) / 0.8;
    headPivot.rotation.set(Math.sin(sT * 2) * 0.25 * lift, 0, lift * 0.45);
    headPivot.position.y = 0.07 + lift * 0.035;
    ears[1].rotation.z = -0.25 - lift * 0.2;
  };
  return { group, parts, update, stir };
}

// ---------- phone ----------

const NOTIFICATIONS = [
  { app: "GitHub", text: "PR #214 approved — ready to merge" },
  { app: "Messages", text: "Mom: go to sleep!!" },
  { app: "Calendar", text: "Midterm tomorrow, 9:00 AM" },
  { app: "Slack", text: "Deploy finished · all checks green" },
  { app: "Spotify", text: "Now playing: lofi beats to code to" },
  { app: "Messages", text: "Sam: you still up?" },
];

/** Draws the phone's lock screen, optionally with a notification card. */
function drawPhone(ctx: CanvasRenderingContext2D, time: string, note: (typeof NOTIFICATIONS)[number] | null) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0e3a4a");
  g.addColorStop(1, "#0a1628");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.textAlign = "center";
  ctx.font = "600 64px system-ui, sans-serif";
  ctx.fillText(time, W / 2, 110);
  ctx.font = "400 18px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("Tuesday", W / 2, 140);
  if (note) {
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.beginPath();
    ctx.roundRect(14, 180, W - 28, 74, 14);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = "#555";
    ctx.font = "600 13px system-ui, sans-serif";
    ctx.fillText(note.app.toUpperCase(), 28, 202);
    ctx.fillStyle = "#111";
    ctx.font = "500 16px system-ui, sans-serif";
    const words = note.text.split(" ");
    let line = "";
    let y = 226;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > W - 56) {
        ctx.fillText(line, 28, y);
        line = w;
        y += 20;
      } else line = test;
    }
    ctx.fillText(line, 28, y);
  }
}

/**
 * Phone behaviour: every so often it buzzes (a quick double vibration), wakes with a notification,
 * then dims back down. `onBuzz` lets the person glance at it.
 */
export function createPhoneScreen(track: Track) {
  const canvas = document.createElement("canvas");
  canvas.width = 216;
  canvas.height = 460;
  const ctx = canvas.getContext("2d")!;
  const tex = track(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  let noteIndex = -1;
  let buzzStart = -10;
  let nextBuzz = 9;
  let shownTime = "";
  let shownNote = -2;

  const redraw = (time: string, note: number) => {
    if (time === shownTime && note === shownNote) return;
    shownTime = time;
    shownNote = note;
    drawPhone(ctx, time, note >= 0 ? NOTIFICATIONS[note] : null);
    tex.needsUpdate = true;
  };

  /** returns { brightness 0..1, jitter } and whether a buzz just started */
  const update = (t: number, time: string, still: boolean) => {
    let started = false;
    if (!still && t > nextBuzz) {
      buzzStart = t;
      nextBuzz = t + 14 + Math.random() * 14;
      noteIndex = (noteIndex + 1) % NOTIFICATIONS.length;
      started = true;
    }
    const b = t - buzzStart;
    const awake = b >= 0 && b < 6;
    redraw(time, awake ? noteIndex : -1);
    // two short vibration bursts
    const burst = (b > 0 && b < 0.35) || (b > 0.55 && b < 0.9);
    const jitter = burst ? Math.sin(t * 190) * 0.0025 : 0;
    const brightness = awake ? Math.min(1, b / 0.15) * (b > 5 ? 1 - (b - 5) : 1) : 0;
    return { brightness, jitter, started };
  };
  return { texture: tex, update };
}

// ---------- wall clock ----------

/** A round wall clock that starts at the scene's 2:47 and keeps real time, second hand ticking. */
export function createWallClock(track: Track, initialSeconds: number) {
  let startSeconds = initialSeconds;
  const group = new THREE.Group();
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#e9dfcc";
  ctx.beginPath();
  ctx.arc(128, 128, 126, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a2420";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "500 26px Georgia, serif";
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillText(String(i), 128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96);
  }
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const r0 = i % 5 === 0 ? 108 : 113;
    ctx.strokeStyle = "#3a322b";
    ctx.lineWidth = i % 5 === 0 ? 3 : 1;
    ctx.beginPath();
    ctx.moveTo(128 + Math.sin(a) * r0, 128 - Math.cos(a) * r0);
    ctx.lineTo(128 + Math.sin(a) * 119, 128 - Math.cos(a) * 119);
    ctx.stroke();
  }
  const faceTex = track(new THREE.CanvasTexture(c));
  faceTex.colorSpace = THREE.SRGBColorSpace;

  const R = 0.15;
  const rim = new THREE.Mesh(track(new THREE.TorusGeometry(R, 0.014, 12, 48)), track(new THREE.MeshStandardMaterial({ color: "#2b211a", roughness: 0.4, metalness: 0.3 })));
  const face = new THREE.Mesh(track(new THREE.CircleGeometry(R, 48)), track(new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.7 })));
  face.position.z = -0.004;
  const glass = new THREE.Mesh(
    track(new THREE.CircleGeometry(R, 48)),
    track(new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.08, roughness: 0.05, clearcoat: 1 })),
  );
  glass.position.z = 0.012;
  group.add(rim, face, glass);

  const handMat = track(new THREE.MeshStandardMaterial({ color: "#1c1714", roughness: 0.5 }));
  const secMat = track(new THREE.MeshStandardMaterial({ color: "#a33a2a", roughness: 0.5 }));
  const hand = (len: number, width: number, z: number, material: THREE.Material) => {
    const pivot = new THREE.Group();
    pivot.position.z = z;
    const m = new THREE.Mesh(track(new THREE.BoxGeometry(width, len, 0.003)), material);
    m.position.y = len / 2 - 0.012;
    m.castShadow = true;
    pivot.add(m);
    group.add(pivot);
    return pivot;
  };
  const hourHand = hand(0.075, 0.01, 0.002, handMat);
  const minuteHand = hand(0.115, 0.007, 0.005, handMat);
  const secondHand = hand(0.13, 0.003, 0.008, secMat);
  const hub = new THREE.Mesh(track(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 16)), secMat);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.008;
  group.add(hub);

  /** time in seconds since midnight for elapsed scene time t */
  const secondsAt = (t: number) => startSeconds + t;
  /** make the clock read `seconds` (since midnight) at scene time t */
  const sync = (t: number, seconds: number) => {
    startSeconds = seconds - t;
  };
  const update = (t: number) => {
    const s = secondsAt(t);
    const whole = Math.floor(s);
    // quartz tick: jump to the next second with a tiny overshoot
    const frac = s - whole;
    const tick = frac < 0.18 ? easeOutBack(frac / 0.18) : 1;
    const sec = (whole - 1 + tick) % 60;
    secondHand.rotation.z = -(sec / 60) * Math.PI * 2;
    minuteHand.rotation.z = -(((s / 60) % 60) / 60) * Math.PI * 2;
    hourHand.rotation.z = -(((s / 3600) % 12) / 12) * Math.PI * 2;
  };
  /** "2:47 AM" style label for elapsed scene time t */
  const label = (t: number) => {
    const s = secondsAt(t);
    const h24 = Math.floor(s / 3600) % 24;
    const m = Math.floor(s / 60) % 60;
    const h = h24 % 12 || 12;
    return { hm: `${h}:${String(m).padStart(2, "0")}`, full: `${h}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}` };
  };
  return { group, update, label, sync, secondsAt };
}

// ---------- radio ----------

/** A small wooden valve-style radio with a glowing dial. */
export function createRadio(track: Track) {
  const group = new THREE.Group();
  const wood = track(new THREE.MeshStandardMaterial({ color: "#6b4426", roughness: 0.45 }));
  const brass = track(new THREE.MeshStandardMaterial({ color: "#b58a48", metalness: 0.85, roughness: 0.3 }));
  const dark = track(new THREE.MeshStandardMaterial({ color: "#1a1512", roughness: 0.6 }));

  const grilleC = document.createElement("canvas");
  grilleC.width = grilleC.height = 128;
  const g = grilleC.getContext("2d")!;
  g.fillStyle = "#3b2a1c";
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "rgba(255,230,190,0.08)";
  for (let i = 0; i < 128; i += 3) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 128);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i);
    g.lineTo(128, i);
    g.stroke();
  }
  const grilleTex = track(new THREE.CanvasTexture(grilleC));
  grilleTex.colorSpace = THREE.SRGBColorSpace;

  const dialC = document.createElement("canvas");
  dialC.width = 256;
  dialC.height = 64;
  const d = dialC.getContext("2d")!;
  d.fillStyle = "#f3d9a0";
  d.fillRect(0, 0, 256, 64);
  d.fillStyle = "#3a2512";
  d.font = "600 13px Georgia, serif";
  d.textAlign = "center";
  [88, 92, 96, 100, 104, 108].forEach((f, i) => {
    const x = 22 + i * 42;
    d.fillText(String(f), x, 44);
    d.fillRect(x - 0.5, 12, 1, 14);
  });
  d.fillStyle = "#a3281c";
  d.fillRect(22 + ((94.9 - 88) / 20) * 210, 6, 2.5, 34); // the needle, on 94.9
  const dialTex = track(new THREE.CanvasTexture(dialC));
  dialTex.colorSpace = THREE.SRGBColorSpace;

  const add = (m: THREE.Mesh) => {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const W = 0.26;
  const H = 0.15;
  const D = 0.12;
  const bodyGeo = track(new THREE.BoxGeometry(W, H, D));
  const body = add(new THREE.Mesh(bodyGeo, wood));
  body.position.y = H / 2;
  const top = add(new THREE.Mesh(track(new THREE.CylinderGeometry(D / 2, D / 2, W, 24, 1, false, 0, Math.PI)), wood));
  // a half cylinder laid along the width makes the rounded top; flatten it into a gentle arch
  top.rotation.z = Math.PI / 2;
  top.scale.set(0.45, 1, 1);
  top.position.y = H;
  const grille = add(new THREE.Mesh(track(new THREE.PlaneGeometry(W * 0.52, H * 0.72)), track(new THREE.MeshStandardMaterial({ map: grilleTex, roughness: 0.9 }))));
  grille.position.set(-W * 0.19, H * 0.5, D / 2 + 0.001);
  const dialMat = track(new THREE.MeshStandardMaterial({ map: dialTex, emissive: "#ffb45a", emissiveMap: dialTex, emissiveIntensity: 0.05, roughness: 0.4 }));
  const dial = add(new THREE.Mesh(track(new THREE.PlaneGeometry(W * 0.36, H * 0.26)), dialMat));
  dial.position.set(W * 0.25, H * 0.66, D / 2 + 0.001);
  for (const x of [0.16, 0.34]) {
    const knob = add(new THREE.Mesh(track(new THREE.CylinderGeometry(0.014, 0.016, 0.014, 20)), brass));
    knob.rotation.x = Math.PI / 2;
    knob.position.set(W * x, H * 0.28, D / 2 + 0.007);
  }
  const antenna = add(new THREE.Mesh(track(new THREE.CylinderGeometry(0.0022, 0.003, 0.34, 6)), brass));
  antenna.position.set(W * 0.38, H + 0.02 + 0.15, -D * 0.2);
  antenna.rotation.z = -0.5;
  const feet = add(new THREE.Mesh(track(new THREE.BoxGeometry(W * 0.9, 0.008, D * 0.8)), dark));
  feet.position.y = 0.004;
  const glow = new THREE.PointLight("#ffab55", 0, 0.9, 2);
  glow.position.set(W * 0.25, H * 0.66, D / 2 + 0.05);
  group.add(glow);

  const parts: THREE.Object3D[] = [];
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) parts.push(o);
  });
  let level = 0;
  const update = (dt: number, on: boolean, pulse: number) => {
    level += ((on ? 1 : 0) - level) * (1 - Math.exp(-6 * dt));
    dialMat.emissiveIntensity = 0.05 + level * (1.2 + pulse * 0.6);
    glow.intensity = level * (0.25 + pulse * 0.2);
    body.scale.y = 1 + pulse * 0.008 * level; // the cabinet thumps with the kick
  };
  return { group, parts, update };
}
