export const TZ = "America/Toronto";

const dateTime = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" });
const time = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });
const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** Building-local (Eastern) date and time. */
export function formatDateTime(iso: string | Date): string {
  return dateTime.format(new Date(iso));
}
export function formatTime(iso: string | Date): string {
  return time.format(new Date(iso));
}
export function formatDay(iso: string | Date): string {
  return dayLabel.format(new Date(iso));
}
/** YYYY-MM-DD in building time. */
export function localDate(iso: string | Date = new Date()): string {
  return ymd.format(new Date(iso));
}

/** UTC instant for a building-local date + "HH:MM". Handles DST. */
export function localToUtc(date: string, hhmm: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  // Offset of the building zone at that instant, in minutes.
  const offset = (dt: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(dt)
      .reduce<Record<string, string>>((a, p) => ((a[p.type] = p.value), a), {});
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    return (asUtc - dt.getTime()) / 60000;
  };
  const first = new Date(guess.getTime() - offset(guess) * 60000);
  return new Date(guess.getTime() - offset(first) * 60000);
}

export function relativeMinutes(iso: string | Date, now = Date.now()): string {
  const m = Math.round((new Date(iso).getTime() - now) / 60000);
  if (m <= 0) return "now";
  if (m < 60) return `in ${m} min`;
  return `in ${Math.floor(m / 60)} h ${m % 60} min`;
}

export function formatAddress(p: { unit: string | null; room_letter: string | null; floor: number | null }): string {
  if (!p.unit) return "—";
  return `${p.unit}${p.room_letter ?? ""} · Floor ${p.floor ?? "?"}`;
}

/** Parse a Postgres tstzrange like ["2026-10-04 19:00:00+00","2026-10-04 21:00:00+00") */
export function parseRange(r: string): { start: Date; end: Date } {
  const m = r.match(/^[[(]"?([^",]+)"?,"?([^")\]]+)"?[)\]]$/);
  if (!m) throw new Error(`bad range: ${r}`);
  const iso = (s: string) => new Date(s.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));
  return { start: iso(m[1]), end: iso(m[2]) };
}

/** Postgres range literal for [start, end). */
export function toRange(start: Date, end: Date): string {
  return `[${start.toISOString()},${end.toISOString()})`;
}
