import { describe, expect, it } from "vitest";
import { availableStarts, durationOptions, nextDay } from "./booking";
import { localToUtc } from "./format";

const theatre = { open_time: "10:00:00", close_time: "23:00:00", min_duration_minutes: 60, max_duration_minutes: 180, min_notice_minutes: 60, buffer_minutes: 15 };

describe("booking picker", () => {
  it("offers 30-minute duration steps within limits", () => {
    expect(durationOptions(theatre)).toEqual([60, 90, 120, 150, 180]);
    expect(durationOptions({ ...theatre, min_duration_minutes: 45, max_duration_minutes: 90 })).toEqual([45, 60, 90]);
  });

  it("keeps bookings inside opening hours", () => {
    const starts = availableStarts("2030-03-04", theatre, [], 120, new Date("2030-03-01T00:00:00Z"));
    expect(starts[0].toISOString()).toBe(localToUtc("2030-03-04", "10:00").toISOString());
    expect(starts.at(-1)!.toISOString()).toBe(localToUtc("2030-03-04", "21:00").toISOString());
  });

  it("respects other bookings plus buffer, and blackouts without buffer", () => {
    const busy = [
      { start: localToUtc("2030-03-04", "19:00"), end: localToUtc("2030-03-04", "21:00"), kind: "booking" },
      { start: localToUtc("2030-03-04", "10:00"), end: localToUtc("2030-03-04", "12:00"), kind: "blackout" },
    ];
    const starts = availableStarts("2030-03-04", theatre, busy, 60, new Date("2030-03-01T00:00:00Z")).map((d) => d.toISOString());
    expect(starts).not.toContain(localToUtc("2030-03-04", "11:00").toISOString());
    expect(starts).toContain(localToUtc("2030-03-04", "12:00").toISOString());
    expect(starts).toContain(localToUtc("2030-03-04", "17:45").toISOString());
    expect(starts).not.toContain(localToUtc("2030-03-04", "18:00").toISOString()); // ends 19:00, inside buffer
    expect(starts).not.toContain(localToUtc("2030-03-04", "21:00").toISOString()); // starts inside buffer
    expect(starts).toContain(localToUtc("2030-03-04", "21:15").toISOString());
  });

  it("applies the notice period", () => {
    const now = localToUtc("2030-03-04", "15:10");
    expect(availableStarts("2030-03-04", theatre, [], 60, now)[0].toISOString()).toBe(localToUtc("2030-03-04", "16:15").toISOString());
  });

  it("handles month ends", () => {
    expect(nextDay("2030-01-31")).toBe("2030-02-01");
  });
});
