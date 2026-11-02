/*
 * Sound effects from short audio files in public/sfx (see scripts/sounds/build.py for where each one
 * comes from). Each file is fetched and decoded once per audio context, the first time it's wanted or
 * when preloaded; until then `play` returns false so the caller can fall back to a synthesised sound.
 */

export interface PlayOptions {
  /** linear gain, 1 = as built */
  gain?: number;
  /** playback speed (and pitch), 1 = as built */
  rate?: number;
  /** a random +/- spread on the rate, so repeats aren't identical */
  vary?: number;
  /** when to start, in the context's time; now by default */
  at?: number;
}

export const createSamples = (base = "/sfx/") => {
  const buffers = new WeakMap<BaseAudioContext, Map<string, AudioBuffer | null>>();
  const pending = new WeakMap<BaseAudioContext, Map<string, Promise<void>>>();

  const load = (ctx: BaseAudioContext, name: string) => {
    let waits = pending.get(ctx);
    if (!waits) pending.set(ctx, (waits = new Map()));
    let done = buffers.get(ctx);
    if (!done) buffers.set(ctx, (done = new Map()));
    const have = waits.get(name);
    if (have) return have;
    const p = fetch(`${base}${name}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
      .then((bytes) => ctx.decodeAudioData(bytes))
      .then((buf) => void done!.set(name, buf))
      // offline or unsupported: remember the miss, and the synthesised fallback plays instead
      .catch(() => void done!.set(name, null));
    waits.set(name, p);
    return p;
  };

  return {
    preload: (ctx: BaseAudioContext, names: readonly string[]) => Promise.all(names.map((n) => load(ctx, n))),
    /** plays the sound if it has loaded; false (and starts loading it) if not */
    play: (ctx: BaseAudioContext, dest: AudioNode, name: string, o: PlayOptions = {}) => {
      const buf = buffers.get(ctx)?.get(name);
      if (!buf) {
        if (buf === undefined) void load(ctx, name);
        return false;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = (o.rate ?? 1) * (1 + (Math.random() * 2 - 1) * (o.vary ?? 0));
      const g = ctx.createGain();
      g.gain.value = o.gain ?? 1;
      src.connect(g).connect(dest);
      src.start(o.at ?? ctx.currentTime);
      return true;
    },
  };
};
