/*
 * Ma's Garden's sounds, made in the browser (no audio files): a soft pop for each match that climbs
 * in pitch as a cascade goes on, a swish for a swap, a bump for a swap that doesn't work, chimes
 * for a new special, a whoosh for stripes, a thump for blasts, and a little tune for a win.
 */

let ctx: AudioContext | null = null;
let muted = false;

const audio = () => {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
};

export const setMuted = (m: boolean) => {
  muted = m;
};

const tone = (freq: number, at: number, dur: number, type: OscillatorType = "sine", vol = 0.18, slideTo?: number) => {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
};

const noise = (at: number, dur: number, vol: number, from: number, to: number) => {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
};

// a major pentatonic, so every cascade sounds happy
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98];

export const sfx = {
  swap: () => noise(0, 0.12, 0.12, 900, 2400),
  bump: () => tone(180, 0, 0.12, "triangle", 0.12, 120),
  pop: (cascade: number) => {
    const f = SCALE[Math.min(SCALE.length - 1, cascade - 1)];
    tone(f, 0, 0.16, "sine", 0.16, f * 1.5);
    tone(f * 2, 0.01, 0.08, "triangle", 0.05);
  },
  special: () => [0, 0.06, 0.12].forEach((at, i) => tone(SCALE[4 + i], at, 0.22, "triangle", 0.1)),
  stripe: () => noise(0, 0.35, 0.18, 400, 5000),
  blast: () => {
    tone(140, 0, 0.35, "sine", 0.3, 50);
    noise(0, 0.3, 0.15, 200, 800);
  },
  blossom: () => SCALE.forEach((f, i) => tone(f, i * 0.035, 0.25, "sine", 0.07)),
  acorn: () => [0, 0.08, 0.16].forEach((at, i) => tone(SCALE[2 + i * 2], at, 0.2, "triangle", 0.12)),
  win: () => [0, 4, 7, 12].forEach((st, i) => tone(523.25 * Math.pow(2, st / 12), i * 0.14, 0.4, "triangle", 0.14)),
  lose: () => [0, -3, -7].forEach((st, i) => tone(392 * Math.pow(2, st / 12), i * 0.18, 0.4, "sine", 0.12)),
  star: (i: number) => tone(SCALE[3 + i * 2], 0, 0.3, "triangle", 0.14),
  tap: () => tone(880, 0, 0.05, "sine", 0.06),
};
