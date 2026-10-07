/*
 * Every sound in the room is synthesised live with the Web Audio API: rain on the glass,
 * soft wind for snow, distant thunder, switch clicks, and a little lo-fi radio that composes
 * as it plays. Nothing is downloaded, so it works anywhere the page does.
 *
 * Browsers only allow audio after the visitor interacts, so nothing is created until
 * `unlock()` is called from a click or key press.
 */

export type Weather = "rain" | "snow" | "clear";

/** What the radio on the shelf is "tuned" to. Edit this to say what you actually listen to. */
export const RADIO_STATION = {
  name: "WSTN 94.9",
  show: "Late-night lo-fi · what I code to",
};

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

export interface RoomAudio {
  unlock: () => void;
  setMuted: (muted: boolean) => void;
  setWeather: (w: Weather) => void;
  /** 0..1 how loud the outside is (the telescope puts you "at" the window) */
  setOutside: (amount: number) => void;
  click: (kind: "lamp" | "switch" | "radio") => void;
  /** small sounds for things in the room: a plushie's squeak, a perfume spritz, the PS5 waking, the blind rolling */
  play: (kind: "squeak" | "spritz" | "chime" | "blind") => void;
  thunder: (delay: number) => void;
  setRadio: (on: boolean) => void;
  /** 0..1 envelope of the radio's kick drum, for making the dial pulse */
  radioPulse: () => number;
  dispose: () => void;
}

export function createAudio(): RoomAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode;
  let ambience: GainNode;
  let sfx: GainNode;
  let music: GainNode;
  let rainGain: GainNode;
  let windGain: GainNode;
  let roomToneGain: GainNode;
  let outsideFilter: BiquadFilterNode;
  let noise: AudioBuffer;
  let brown: AudioBuffer;
  let crackle: AudioBuffer;
  let muted = false;
  let weather: Weather = "rain";
  let radioOn = false;
  let pulse = 0;
  let pulseAt = 0;
  let dropTimer: number | undefined;
  let scheduler: number | undefined;
  const sources: AudioScheduledSourceNode[] = [];

  // ---------- noise buffers ----------
  const makeNoise = (c: AudioContext, seconds: number, kind: "white" | "pink" | "brown" | "crackle") => {
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "white") d[i] = w;
      else if (kind === "pink") {
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
      } else if (kind === "brown") {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else {
        // vinyl: soft hiss with sparse pops
        d[i] = w * 0.012 + (Math.random() < 0.0004 ? (Math.random() * 2 - 1) * 0.6 : 0);
      }
    }
    return buf;
  };

  const loop = (buf: AudioBuffer, dest: AudioNode) => {
    const s = ctx!.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.loopStart = Math.random() * (buf.duration - 1);
    s.connect(dest);
    s.start();
    sources.push(s);
    return s;
  };

  const filter = (type: BiquadFilterType, freq: number, q = 0.7) => {
    const f = ctx!.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  };
  const gain = (v: number) => {
    const g = ctx!.createGain();
    g.gain.value = v;
    return g;
  };

  // ---------- one-shots ----------
  const burst = (at: number, dur: number, type: BiquadFilterType, freq: number, level: number, dest: AudioNode, q = 0.8) => {
    const s = ctx!.createBufferSource();
    s.buffer = noise;
    const f = filter(type, freq, q);
    const g = gain(0);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(at, Math.random() * 1.5, dur + 0.05);
  };
  const tone = (at: number, freq: number, dur: number, level: number, dest: AudioNode, type: OscillatorType = "sine", endFreq?: number) => {
    const o = ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, at + dur * 0.6);
    const g = gain(0);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(dest);
    o.start(at);
    o.stop(at + dur + 0.05);
    return o;
  };

  // ---------- weather beds ----------
  const applyWeather = (fade = 2.5) => {
    if (!ctx) return;
    const now = ctx.currentTime;
    const set = (g: GainNode, v: number) => {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(v, now + fade);
    };
    set(rainGain, weather === "rain" ? 0.55 : 0);
    set(windGain, weather === "snow" ? 0.35 : weather === "clear" ? 0.06 : 0.08);
    set(roomToneGain, 0.12);
  };

  // individual drops ticking on the glass
  const scheduleDrops = () => {
    if (!ctx) return;
    if (weather === "rain") {
      const at = ctx.currentTime + 0.01;
      burst(at, 0.03 + Math.random() * 0.03, "bandpass", 2500 + Math.random() * 4000, 0.04 + Math.random() * 0.06, ambience, 3);
    }
    dropTimer = window.setTimeout(scheduleDrops, 25 + Math.random() * 110);
  };

  // ---------- lo-fi radio ----------
  // ii–V–I–VI in C with jazzy extensions, boom-bap drums, a lazy bass and the odd melody note
  const CHORDS = [
    { root: 38, notes: [50, 53, 57, 60, 64] }, // Dm9
    { root: 43, notes: [53, 59, 64, 69] }, // G13
    { root: 36, notes: [52, 55, 59, 62] }, // Cmaj9
    { root: 45, notes: [55, 61, 65, 67] }, // A7(b13)
  ];
  const PENTA = [72, 74, 76, 79, 81, 84];
  const BPM = 76;
  const STEP = 60 / BPM / 4; // sixteenth
  let step = 0;
  let nextStepAt = 0;
  let keysBus: GainNode;
  let drumBus: GainNode;
  let wobble: GainNode;

  const playStep = (s: number, at: number) => {
    const bar = Math.floor(s / 16) % CHORDS.length;
    const pos = s % 16;
    const chord = CHORDS[bar];
    const swing = pos % 2 === 1 ? STEP * 0.28 : 0;
    const t = at + swing + (Math.random() - 0.5) * 0.008;
    // keys: chord on the one, a softer restrike on the "and" of three
    if (pos === 0 || pos === 10) {
      const vel = pos === 0 ? 0.11 : 0.06;
      chord.notes.forEach((n, i) => {
        const nt = t + i * 0.012; // a slight roll
        for (const [type, lvl, det] of [["sine", 1, 0], ["triangle", 0.35, 7]] as const) {
          const o = ctx!.createOscillator();
          o.type = type;
          o.frequency.value = midiHz(n);
          o.detune.value = det;
          wobble.connect(o.detune);
          const g = gain(0);
          g.gain.setValueAtTime(0, nt);
          g.gain.linearRampToValueAtTime(vel * lvl, nt + 0.015);
          g.gain.exponentialRampToValueAtTime(0.0001, nt + (pos === 0 ? 2.6 : 1.2));
          o.connect(g).connect(keysBus);
          o.start(nt);
          o.stop(nt + 2.7);
          o.onended = () => wobble.disconnect(o.detune);
        }
      });
    }
    // sparse melody over the top
    if (pos % 4 === 2 && Math.random() < 0.22) {
      tone(t, midiHz(PENTA[Math.floor(Math.random() * PENTA.length)]), 0.9, 0.035, keysBus, "triangle");
    }
    // bass
    if (pos === 0 || pos === 11) tone(t, midiHz(chord.root), 0.7, 0.28, music, "sine");
    // drums
    if (pos === 0 || pos === 7 || pos === 10) {
      tone(t, 120, 0.32, pos === 0 ? 0.55 : 0.4, drumBus, "sine", 42);
      pulseAt = t;
    }
    if (pos === 4 || pos === 12) {
      burst(t, 0.2, "bandpass", 1900, 0.22, drumBus, 0.9);
      tone(t, 190, 0.08, 0.08, drumBus, "triangle");
    }
    if (pos % 2 === 0) burst(t, 0.035, "highpass", 7500, (pos % 4 === 0 ? 0.07 : 0.045) * (0.7 + Math.random() * 0.5), drumBus);
  };

  const runScheduler = () => {
    if (!ctx || !radioOn) return;
    while (nextStepAt < ctx.currentTime + 0.15) {
      playStep(step, nextStepAt);
      step++;
      nextStepAt += STEP;
    }
  };

  // ---------- setup ----------
  const unlock = () => {
    if (ctx) {
      if (ctx.state === "suspended") void ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    noise = makeNoise(ctx, 3, "white");
    brown = makeNoise(ctx, 6, "brown");
    crackle = makeNoise(ctx, 5, "crackle");
    const pink = makeNoise(ctx, 5, "pink");

    master = gain(muted ? 0 : 0.9);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);

    // the outside is heard through a window: muffled unless you're at the telescope
    outsideFilter = filter("lowpass", 1800);
    outsideFilter.connect(master);
    ambience = gain(1);
    ambience.connect(outsideFilter);
    sfx = gain(0.9);
    sfx.connect(master);

    // rain: a body of pink noise plus a brighter patter layer
    rainGain = gain(0);
    rainGain.connect(ambience);
    const body = filter("bandpass", 900, 0.5);
    loop(pink, body).playbackRate.value = 0.9;
    body.connect(gain(0.9)).connect(rainGain);
    const patter = filter("highpass", 3500);
    const patterLevel = gain(0.18);
    loop(noise, patter);
    patter.connect(patterLevel).connect(rainGain);
    // wind: slowly breathing low noise (snow nights, and a whisper otherwise)
    windGain = gain(0);
    windGain.connect(ambience);
    const wind = filter("lowpass", 380, 1.2);
    const windSwell = gain(0.6);
    loop(brown, wind);
    wind.connect(windSwell).connect(windGain);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoAmt = gain(160);
    lfo.connect(lfoAmt).connect(wind.frequency);
    const lfo2 = gain(0.35);
    lfo.connect(lfo2).connect(windSwell.gain);
    lfo.start();
    sources.push(lfo);
    // room tone: the faintest hum so silence never feels dead
    roomToneGain = gain(0);
    const tone60 = filter("lowpass", 160);
    loop(brown, tone60);
    tone60.connect(gain(0.15)).connect(roomToneGain);
    roomToneGain.connect(master);

    // radio: warm, band-limited "small speaker" chain with vinyl crackle
    music = gain(0);
    const speakerLo = filter("highpass", 90);
    const speakerHi = filter("lowpass", 3400);
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 1.6);
    }
    shaper.curve = curve;
    music.connect(speakerLo).connect(speakerHi).connect(shaper).connect(gain(0.8)).connect(master);
    keysBus = gain(1);
    keysBus.connect(filter("lowpass", 2200)).connect(music);
    drumBus = gain(0.9);
    drumBus.connect(music);
    loop(crackle, music);
    // tape wobble shared by every keys oscillator
    const wob = ctx.createOscillator();
    wob.frequency.value = 0.45;
    wobble = gain(9);
    wob.connect(wobble);
    wob.start();
    sources.push(wob);

    applyWeather(3);
    scheduleDrops();
    if (radioOn) startRadio();
  };

  const startRadio = () => {
    if (!ctx) return;
    const now = ctx.currentTime;
    // a quick burst of tuning static before the station comes in
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = filter("bandpass", 600, 2);
    f.frequency.setValueAtTime(400, now);
    f.frequency.exponentialRampToValueAtTime(3000, now + 0.45);
    const g = gain(0);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.05);
    g.gain.linearRampToValueAtTime(0, now + 0.5);
    s.connect(f).connect(g).connect(sfx);
    s.start(now, 0, 0.55);
    music.gain.cancelScheduledValues(now);
    music.gain.setValueAtTime(music.gain.value, now);
    music.gain.linearRampToValueAtTime(0.5, now + 1.4);
    step = 0;
    nextStepAt = now + 0.45;
    window.clearInterval(scheduler);
    scheduler = window.setInterval(runScheduler, 25);
  };
  const stopRadio = () => {
    if (!ctx) return;
    const now = ctx.currentTime;
    music.gain.cancelScheduledValues(now);
    music.gain.setValueAtTime(music.gain.value, now);
    music.gain.linearRampToValueAtTime(0, now + 0.25);
    window.clearInterval(scheduler);
  };

  return {
    unlock,
    setMuted: (m) => {
      muted = m;
      if (!ctx) return;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(m ? 0 : 0.9, now + 0.3);
    },
    setWeather: (w) => {
      weather = w;
      applyWeather();
    },
    setOutside: (amount) => {
      if (!ctx) return;
      outsideFilter.frequency.setTargetAtTime(1800 + amount * 9000, ctx.currentTime, 0.4);
    },
    click: (kind) => {
      if (!ctx) return;
      const at = ctx.currentTime + 0.005;
      if (kind === "lamp") {
        burst(at, 0.012, "highpass", 2500, 0.35, sfx);
        tone(at, 140, 0.03, 0.2, sfx);
      } else if (kind === "switch") {
        burst(at, 0.01, "highpass", 3500, 0.45, sfx);
        tone(at, 220, 0.025, 0.25, sfx);
        burst(at + 0.018, 0.008, "highpass", 4000, 0.15, sfx);
      } else {
        burst(at, 0.015, "bandpass", 1800, 0.3, sfx, 2);
        tone(at, 90, 0.05, 0.25, sfx);
      }
    },
    play: (kind) => {
      if (!ctx) return;
      const at = ctx.currentTime + 0.005;
      if (kind === "squeak") {
        // a soft squeeze: a rising then falling chirp, slightly different each time
        const base = 700 + Math.random() * 300;
        tone(at, base, 0.09, 0.12, sfx, "triangle", base * 1.6);
        tone(at + 0.09, base * 1.5, 0.12, 0.1, sfx, "triangle", base * 0.9);
        burst(at, 0.05, "bandpass", 1200, 0.05, sfx, 1.5);
      } else if (kind === "spritz") {
        // the pump's click, then a short hiss of mist
        burst(at, 0.01, "highpass", 3000, 0.25, sfx);
        burst(at + 0.02, 0.22, "highpass", 6000, 0.22, sfx, 0.6);
      } else if (kind === "chime") {
        // a gentle two-note console chime
        tone(at, midiHz(76), 0.5, 0.12, sfx, "sine");
        tone(at + 0.12, midiHz(83), 0.7, 0.1, sfx, "sine");
        tone(at + 0.12, midiHz(88), 0.7, 0.04, sfx, "sine");
      } else {
        // the blind's chain rattling over its roller
        for (let i = 0; i < 9; i++) burst(at + i * 0.07, 0.012, "bandpass", 2600 + Math.random() * 800, 0.08, sfx, 3);
        burst(at, 0.6, "lowpass", 300, 0.06, sfx);
      }
    },
    thunder: (delay) => {
      if (!ctx || weather !== "rain") return;
      const at = ctx.currentTime + delay;
      const s = ctx.createBufferSource();
      s.buffer = brown;
      s.playbackRate.value = 0.6 + Math.random() * 0.3;
      const f = filter("lowpass", 260);
      f.frequency.setValueAtTime(320, at);
      f.frequency.exponentialRampToValueAtTime(70, at + 5);
      const g = gain(0);
      const peak = 0.9 + Math.random() * 0.5;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(peak, at + 0.25);
      g.gain.linearRampToValueAtTime(peak * 0.55, at + 1.2);
      g.gain.linearRampToValueAtTime(peak * 0.7, at + 1.8); // a second roll
      g.gain.exponentialRampToValueAtTime(0.001, at + 6);
      s.connect(f).connect(g).connect(ambience);
      s.start(at, Math.random() * 2, 6.5);
    },
    setRadio: (on) => {
      radioOn = on;
      if (on) startRadio();
      else stopRadio();
    },
    radioPulse: () => {
      if (!ctx || !radioOn) return 0;
      const since = ctx.currentTime - pulseAt;
      pulse = since >= 0 ? Math.exp(-since * 7) : pulse * 0.95;
      return pulse;
    },
    dispose: () => {
      window.clearTimeout(dropTimer);
      window.clearInterval(scheduler);
      sources.forEach((s) => {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
      });
      void ctx?.close();
      ctx = null;
    },
  };
}
