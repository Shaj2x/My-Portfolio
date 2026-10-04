import { describe, expect, it } from "vitest";
import { formatEta, nextStopIndex, recentSpeed, shouldSendFix, stopEtas, type Fix, type StopPoint } from "./shuttle";

// Three stops ~816 m apart along a line of latitude.
const stops: StopPoint[] = [
  { id: "a", name: "The Marq", lat: 42.99, lng: -81.25, sequence: 0, dwell_seconds: 60 },
  { id: "b", name: "Midway", lat: 42.99, lng: -81.24, sequence: 1, dwell_seconds: 60 },
  { id: "c", name: "Campus", lat: 42.99, lng: -81.23, sequence: 2, dwell_seconds: 0 },
];
const at = (lng: number, s: number): Fix => ({ lat: 42.99, lng, recorded_at: new Date(1_700_000_000_000 + s * 1000).toISOString() });

describe("nextStopIndex", () => {
  it("is the first stop before departure", () => {
    expect(nextStopIndex(stops, [])).toBe(0);
  });
  it("advances as stops are reached", () => {
    expect(nextStopIndex(stops, [at(-81.25, 0)])).toBe(1);
    expect(nextStopIndex(stops, [at(-81.25, 0), at(-81.245, 60)])).toBe(1);
    expect(nextStopIndex(stops, [at(-81.25, 0), at(-81.24, 120)])).toBe(2);
  });
  it("is null after the last stop", () => {
    expect(nextStopIndex(stops, [at(-81.25, 0), at(-81.24, 100), at(-81.23, 200)])).toBeNull();
  });
  it("doesn't go backwards on a loop that returns to the start", () => {
    const loop = [...stops, { ...stops[0], id: "a2", sequence: 3 }];
    const trail = [at(-81.25, 0), at(-81.24, 100), at(-81.23, 200)];
    expect(nextStopIndex(loop, trail)).toBe(3);
  });
});

describe("speed and ETAs", () => {
  it("measures recent speed", () => {
    expect(recentSpeed([at(-81.25, 0), at(-81.24, 100)])).toBeCloseTo(8.16, 1);
  });
  it("estimates ETAs with road factor, dwell and a speed floor", () => {
    const trail = [at(-81.25, 0), at(-81.245, 100)]; // 408 m in 100 s → 4 m/s → floored to 6
    const etas = stopEtas(stops, trail);
    expect(etas.map((e) => e.stop.id)).toEqual(["b", "c"]);
    expect(etas[0].etaSeconds).toBeCloseTo((408 * 1.3) / 6, -1);
    expect(etas[1].etaSeconds - etas[0].etaSeconds).toBeCloseTo(60 + (816 * 1.3) / 6, -1);
  });
  it("formats ETAs", () => {
    expect(formatEta(30)).toBe("Arriving");
    expect(formatEta(299)).toBe("5 min");
    expect(formatEta(3900)).toBe("1 h 5 min");
  });
});

describe("shouldSendFix", () => {
  it("sends every 5–10 s while moving and at most every 10 s when parked", () => {
    expect(shouldSendFix(null, at(-81.25, 0))).toBe(true);
    expect(shouldSendFix(at(-81.25, 0), at(-81.25, 6))).toBe(false); // parked, 6 s
    expect(shouldSendFix(at(-81.25, 0), at(-81.25, 10))).toBe(true); // parked, 10 s
    expect(shouldSendFix(at(-81.25, 0), at(-81.2499, 6))).toBe(true); // moved 8 m in 6 s
    expect(shouldSendFix(at(-81.25, 0), at(-81.2499, 3))).toBe(false); // too soon
  });
});
