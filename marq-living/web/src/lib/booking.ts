import { localToUtc } from "@/lib/format";

export type Busy = { start: Date; end: Date };
export type AmenityRules = {
  open_time: string; close_time: string; min_duration_minutes: number; max_duration_minutes: number;
  min_notice_minutes: number; buffer_minutes: number;
};

/** Durations a tenant can pick, in 30-minute steps (plus the minimum). */
export function durationOptions(a: AmenityRules): number[] {
  const out = new Set<number>([a.min_duration_minutes]);
  for (let m = Math.ceil(a.min_duration_minutes / 30) * 30; m <= a.max_duration_minutes; m += 30) out.add(m);
  return [...out].filter((m) => m <= a.max_duration_minutes).sort((x, y) => x - y);
}

/**
 * Start times (every 15 min) on `date` where a booking of `minutes` fits:
 * inside opening hours, after the notice period, not overlapping busy periods
 * (bookings get the buffer on both sides). Mirrors validate_booking() so the
 * picker only offers times the database will accept.
 */
export function availableStarts(date: string, a: AmenityRules, busy: (Busy & { kind?: string })[], minutes: number, now = new Date()): Date[] {
  const open = localToUtc(date, a.open_time.slice(0, 5));
  const close = a.close_time.startsWith("00:00")
    ? localToUtc(nextDay(date), "00:00")
    : localToUtc(date, a.close_time.slice(0, 5));
  const earliest = new Date(now.getTime() + a.min_notice_minutes * 60000);
  const buf = a.buffer_minutes * 60000;
  const out: Date[] = [];
  for (let t = open.getTime(); t + minutes * 60000 <= close.getTime(); t += 15 * 60000) {
    const s = t, e = t + minutes * 60000;
    if (s < earliest.getTime()) continue;
    const clash = busy.some((b) => {
      const pad = b.kind === "blackout" ? 0 : buf;
      return s < b.end.getTime() + pad && e > b.start.getTime() - pad;
    });
    if (!clash) out.push(new Date(s));
  }
  return out;
}

export function nextDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
