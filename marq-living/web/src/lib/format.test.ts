import { describe, expect, it } from "vitest";
import { localDate, localToUtc } from "./format";

describe("localToUtc", () => {
  it("converts Eastern local time to UTC across DST", () => {
    expect(localToUtc("2026-01-15", "19:00").toISOString()).toBe("2026-01-16T00:00:00.000Z"); // EST −5
    expect(localToUtc("2026-07-15", "19:00").toISOString()).toBe("2026-07-15T23:00:00.000Z"); // EDT −4
  });
  it("round-trips the local date", () => {
    expect(localDate(localToUtc("2026-11-01", "23:30"))).toBe("2026-11-01");
  });
});

import { parseRange, toRange } from "./format";
describe("ranges", () => {
  it("parses Postgres tstzrange output", () => {
    const r = parseRange('["2026-10-04 19:00:00+00","2026-10-04 21:00:00+00")');
    expect(r.start.toISOString()).toBe("2026-10-04T19:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-10-04T21:00:00.000Z");
    expect(parseRange('["2026-10-04 19:15:00-04","2026-10-04 21:00:00-04")').start.toISOString()).toBe("2026-10-04T23:15:00.000Z");
  });
  it("round-trips", () => {
    const s = new Date("2026-10-04T19:00:00Z"), e = new Date("2026-10-04T20:00:00Z");
    expect(parseRange(toRange(s, e)).end.toISOString()).toBe(e.toISOString());
  });
});
