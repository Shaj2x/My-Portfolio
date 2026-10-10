import { useSyncExternalStore } from "react";

/*
 * Sound effects for the arcade games (Super S, Pong, Snake), all synthesised live with the Web
 * Audio API in a chiptune style: square and triangle waves with quick pitch sweeps, and a little
 * noise for thuds and sprays. Nothing to download.
 *
 * One switch turns them on and off for every game, remembered on this device. A host (the room's
 * console) can also mute them and set their level, following the room's own sound settings.
 */

export type GameSfx =
  // Super S
  | "jump"
  | "airJump"
  | "coin"
  | "gold"
  | "oneUp"
  | "bump"
  | "break"
  | "item"
  | "spritz"
  | "stomp"
  | "kick"
  | "grow"
  | "shrink"
  | "hurt"
  | "die"
  | "pound"
  | "spring"
  | "spray"
  | "checkpoint"
  | "flag"
  | "clear"
  | "gameOver"
  | "fanfare"
  | "start"
  | "blip"
  // Pong
  | "paddle"
  | "wall"
  | "point"
  | "miss"
  | "win"
  | "lose"
  // Snake
  | "eat"
  | "crash";

const KEY = "games:sound";

let on = (() => {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
})();
let hostMuted = false;
let hostVolume = 1;
const listeners = new Set<() => void>();

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noise: AudioBuffer | null = null;
const lastPlayed: Partial<Record<GameSfx, number>> = {};

const level = () => (on && !hostMuted ? 0.5 * hostVolume : 0);

const audio = () => {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = level();
    out.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
};

/** one note: a wave from `f0` sliding to `f1`, with a quick attack and a decay */
const note = (at: number, f0: number, dur: number, vol = 0.3, type: OscillatorType = "square", f1 = f0) => {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, at);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(out!);
  o.start(at);
  o.stop(at + dur + 0.02);
};

/** a burst of filtered noise: thuds, crumbles and sprays */
const hiss = (at: number, dur: number, freq: number, vol = 0.3, type: BiquadFilterType = "lowpass") => {
  const c = ctx!;
  const s = c.createBufferSource();
  s.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  s.connect(f).connect(g).connect(out!);
  s.start(at);
  s.stop(at + dur + 0.02);
};

/** notes one after another, `step` seconds apart */
const tune = (at: number, freqs: number[], step: number, vol = 0.22, type: OscillatorType = "square") =>
  freqs.forEach((f, i) => note(at + i * step, f, step * 1.6, vol, type));

// note frequencies
const N = { C4: 262, E4: 330, G4: 392, A4: 440, C5: 523, D5: 587, E5: 659, G5: 784, A5: 880, B5: 988, C6: 1047, E6: 1319, G6: 1568, C7: 2093 };

const SOUNDS: Record<GameSfx, (t: number) => void> = {
  jump: (t) => note(t, 260, 0.16, 0.2, "square", 620),
  airJump: (t) => note(t, 420, 0.14, 0.18, "square", 980),
  coin: (t) => {
    note(t, N.B5, 0.07, 0.18);
    note(t + 0.07, N.E6, 0.22, 0.18);
  },
  gold: (t) => tune(t, [N.C6, N.E6, N.G6, N.C7], 0.07, 0.18),
  oneUp: (t) => tune(t, [N.E5, N.G5, N.E6, N.C6, N.D5 * 2, N.G6], 0.08, 0.17),
  bump: (t) => note(t, 160, 0.08, 0.3, "triangle", 90),
  break: (t) => {
    hiss(t, 0.18, 1800, 0.28);
    note(t, 200, 0.1, 0.12, "square", 70);
  },
  item: (t) => tune(t, [N.C5, N.G5, N.C6, N.E5 * 2, N.G6], 0.05, 0.14),
  spritz: (t) => {
    hiss(t, 0.35, 5000, 0.12, "highpass");
    tune(t + 0.05, [N.C5, N.E5, N.G5, N.C6, N.E6], 0.06, 0.15);
  },
  stomp: (t) => {
    note(t, 420, 0.1, 0.22, "square", 140);
    hiss(t, 0.06, 900, 0.15);
  },
  kick: (t) => note(t, 900, 0.14, 0.2, "square", 220),
  grow: (t) => {
    for (let i = 0; i < 6; i++) note(t + i * 0.06, 110 * (1 + i * 0.35), 0.12, 0.18, "square", 140 * (1 + i * 0.35));
  },
  shrink: (t) => {
    for (let i = 0; i < 5; i++) note(t + i * 0.06, 700 - i * 100, 0.1, 0.16, "square", 600 - i * 100);
  },
  hurt: (t) => note(t, 600, 0.3, 0.2, "square", 160),
  die: (t) => tune(t + 0.1, [N.C5, N.G4, N.E4, N.A4, 247, N.A4, 233, 220], 0.11, 0.18),
  pound: (t) => {
    note(t, 110, 0.22, 0.4, "triangle", 40);
    hiss(t, 0.25, 600, 0.35);
  },
  spring: (t) => note(t, 180, 0.3, 0.22, "triangle", 1100),
  spray: (t) => hiss(t, 0.18, 4000, 0.18, "highpass"),
  checkpoint: (t) => {
    note(t, N.G5, 0.12, 0.16, "triangle");
    note(t + 0.1, N.C6, 0.3, 0.16, "triangle");
  },
  flag: (t) => note(t, 300, 0.9, 0.16, "square", 1200),
  clear: (t) => tune(t, [N.G4, N.C5, N.E5, N.G5, N.C6, N.E6, N.G6, N.E6], 0.09, 0.16),
  gameOver: (t) => tune(t, [N.C5, N.G4, N.E4, N.A4, 247, N.A4, 207, 233, 207, 196], 0.15, 0.16, "triangle"),
  fanfare: (t) => tune(t, [N.C5, N.C5, N.C5, N.C5, 415, 466, N.C5, 466, N.C5], 0.12, 0.17),
  start: (t) => tune(t, [N.E5, N.G5, N.C6], 0.06, 0.16),
  blip: (t) => note(t, 880, 0.05, 0.12),
  paddle: (t) => note(t, 460, 0.06, 0.22),
  wall: (t) => note(t, 230, 0.05, 0.2),
  point: (t) => tune(t, [N.E5, N.A5], 0.08, 0.16),
  miss: (t) => note(t, 300, 0.32, 0.18, "square", 110),
  win: (t) => tune(t, [N.C5, N.E5, N.G5, N.C6, N.G5, N.C6], 0.1, 0.17),
  lose: (t) => tune(t, [N.G4, 370, 349, 330], 0.18, 0.17, "triangle"),
  eat: (t) => note(t, 600, 0.08, 0.18, "square", 1100),
  crash: (t) => {
    note(t, 400, 0.45, 0.2, "square", 60);
    hiss(t, 0.3, 800, 0.2);
  },
};

/** the same sound no more than once every 45 ms, so a burst of events doesn't pile up */
export function sfx(name: GameSfx) {
  if (level() <= 0) return;
  const c = audio();
  if (!c || !out) return;
  const now = c.currentTime;
  if (now - (lastPlayed[name] ?? -1) < 0.045) return;
  lastPlayed[name] = now;
  SOUNDS[name](now + 0.005);
}

const apply = () => {
  if (ctx && out) out.gain.setTargetAtTime(level(), ctx.currentTime, 0.02);
  listeners.forEach((fn) => fn());
};

/** turn the game sound on or off, for every game, remembered on this device */
export function setGameSoundOn(next: boolean) {
  on = next;
  try {
    localStorage.setItem(KEY, next ? "on" : "off");
  } catch {
    /* storage unavailable: it lasts for this visit */
  }
  apply();
  if (next) sfx("blip");
}

/** a host's own sound settings on top: muted silences the games, volume (0..1) scales them */
export function setGameSoundHost(muted: boolean, volume = 1) {
  hostMuted = muted;
  hostVolume = Math.max(0, Math.min(1, volume));
  apply();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** whether game sound is switched on, and a way to switch it */
export function useGameSound(): [boolean, (on: boolean) => void] {
  const value = useSyncExternalStore(subscribe, () => on, () => on);
  return [value, setGameSoundOn];
}
