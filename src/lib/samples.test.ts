import { afterEach, describe, expect, it, vi } from "vitest";
import { createSamples } from "./samples";

/** just enough of an AudioContext to see what gets played */
const fakeContext = () => {
  const started: { buffer: unknown; rate: number; gain: number }[] = [];
  const ctx = {
    currentTime: 0,
    decodeAudioData: vi.fn(async () => ({ duration: 0.2 })),
    createBufferSource: () => {
      const src = { buffer: null as unknown, playbackRate: { value: 1 }, connect: (g: { gain: { value: number } }) => g, start: () => started.push({ buffer: src.buffer, rate: src.playbackRate.value, gain: lastGain!.gain.value }) };
      return src;
    },
    createGain: () => (lastGain = { gain: { value: 1 }, connect: (d: unknown) => d }),
  };
  let lastGain: { gain: { value: number }; connect: (d: unknown) => unknown } | null = null;
  return { ctx: ctx as unknown as BaseAudioContext, started };
};

afterEach(() => vi.unstubAllGlobals());

describe("recorded sound effects", () => {
  it("plays nothing until a sound has loaded, then plays it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));
    const s = createSamples("/sfx/");
    const { ctx, started } = fakeContext();
    const dest = {} as AudioNode;
    expect(s.play(ctx, dest, "room/lamp")).toBe(false);
    await s.preload(ctx, ["room/lamp"]);
    expect(fetch).toHaveBeenCalledWith("/sfx/room/lamp.mp3");
    expect(s.play(ctx, dest, "room/lamp", { gain: 0.5, rate: 1.2 })).toBe(true);
    expect(started).toHaveLength(1);
    expect(started[0].rate).toBeCloseTo(1.2);
    expect(started[0].gain).toBe(0.5);
  });

  it("falls back for good when a file can't be fetched, without retrying every time", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, statusText: "Not Found" })));
    const s = createSamples();
    const { ctx } = fakeContext();
    await s.preload(ctx, ["missing"]);
    expect(s.play(ctx, {} as AudioNode, "missing")).toBe(false);
    expect(s.play(ctx, {} as AudioNode, "missing")).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
