import { distanceM, type LatLng } from "@/lib/geo";

export type StopPoint = LatLng & { id: string; name: string; sequence: number; dwell_seconds: number };
export type Fix = LatLng & { recorded_at: string; speed_mps?: number | null };

/** Within this distance of a stop counts as having reached it. */
export const STOP_RADIUS_M = 40;
/** Straight-line → road distance. */
export const ROAD_FACTOR = 1.3;
/** Speed assumed when the shuttle is stopped or speed is unknown (~22 km/h city average). */
export const FALLBACK_SPEED_MPS = 6;

/**
 * Index (into stops sorted by sequence) of the next stop, given the trail so
 * far. A stop is "passed" once any fix came within STOP_RADIUS_M of it; the
 * next stop is the one after the last passed stop. A loop that ends where it
 * started (last stop = first stop location) is handled by sequence order.
 */
export function nextStopIndex(stops: StopPoint[], trail: Fix[]): number | null {
  if (stops.length === 0) return null;
  let last = -1;
  for (const fix of trail) {
    // Only look forward from the last passed stop so a loop's shared start/end
    // point doesn't reset progress.
    for (let i = last + 1; i < stops.length; i++) {
      if (distanceM(fix, stops[i]) <= STOP_RADIUS_M) {
        last = i;
        break;
      }
    }
  }
  return last + 1 < stops.length ? last + 1 : null;
}

/** Recent average speed from the last few fixes (m/s), ignoring GPS jitter. */
export function recentSpeed(trail: Fix[], windowS = 120): number | null {
  if (trail.length < 2) return null;
  const end = new Date(trail[trail.length - 1].recorded_at).getTime();
  let dist = 0;
  let t0 = end;
  for (let i = trail.length - 1; i > 0; i--) {
    const t = new Date(trail[i - 1].recorded_at).getTime();
    if (end - t > windowS * 1000) break;
    dist += distanceM(trail[i - 1], trail[i]);
    t0 = t;
  }
  const secs = (end - t0) / 1000;
  return secs > 0 ? dist / secs : null;
}

export type StopEta = { stop: StopPoint; etaSeconds: number };

/**
 * ETAs to the next stop and every stop after it on this run. Uses recent
 * speed (never below a city fallback, since a shuttle waiting at a light
 * shouldn't push ETAs to infinity) and each stop's dwell time.
 */
export function stopEtas(stops: StopPoint[], trail: Fix[]): StopEta[] {
  const idx = nextStopIndex(stops, trail);
  if (idx === null || trail.length === 0) return [];
  const here = trail[trail.length - 1];
  const speed = Math.max(recentSpeed(trail) ?? 0, FALLBACK_SPEED_MPS);
  const out: StopEta[] = [];
  let t = (distanceM(here, stops[idx]) * ROAD_FACTOR) / speed;
  out.push({ stop: stops[idx], etaSeconds: Math.round(t) });
  for (let i = idx + 1; i < stops.length; i++) {
    t += stops[i - 1].dwell_seconds + (distanceM(stops[i - 1], stops[i]) * ROAD_FACTOR) / speed;
    out.push({ stop: stops[i], etaSeconds: Math.round(t) });
  }
  return out;
}

export function formatEta(seconds: number): string {
  if (seconds < 60) return "Arriving";
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** Throttle for the driver's location posts: 5–10 s apart, or sooner after a big move. */
export function shouldSendFix(prev: Fix | null, next: Fix, minS = 5, maxS = 10, moveM = 50): boolean {
  if (!prev) return true;
  const dt = (new Date(next.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 1000;
  if (dt >= maxS) return true;
  return dt >= minS && distanceM(prev, next) >= 5 ? true : distanceM(prev, next) >= moveM;
}
