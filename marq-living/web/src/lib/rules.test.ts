import { describe, expect, it } from "vitest";
import { describeRule, ruleSchema } from "./rules";

const powerDown = {
  name: "Power down",
  priority: 20,
  enabled: true,
  trigger: { type: "booking.ended" as const, room: "*", wait_up_to_minutes: 90 },
  conditions: [{ type: "no_motion_for" as const, room: "$room", minutes: 10 }, { type: "no_active_booking" as const, room: "$room" }],
  actions: [{ type: "set_lights" as const, room: "$room", state: "off" as const }, { type: "set_hvac" as const, room: "$room", mode: "setback" as const }],
};

describe("ruleSchema", () => {
  it("accepts the default rules", () => {
    expect(ruleSchema.safeParse(powerDown).success).toBe(true);
  });

  // Same rejections as TestParseRuleRejects in the Go engine.
  it.each([
    ["unknown trigger", { trigger: { type: "teleport" } }],
    ["unknown condition", { conditions: [{ type: "astrology" }] }],
    ["no actions", { actions: [] }],
    ["bad light state", { actions: [{ type: "set_lights", room: "x", state: "dim" }] }],
    ["hvac without room", { actions: [{ type: "set_hvac", room: "", mode: "comfort" }] }],
    ["bad schedule time", { trigger: { type: "schedule", at: "25:99" } }],
    ["schedule without time", { trigger: { type: "schedule" } }],
    ["blank notification", { actions: [{ type: "notify_staff", title: " " }] }],
  ])("rejects %s", (_name, patch) => {
    expect(ruleSchema.safeParse({ ...powerDown, ...patch }).success).toBe(false);
  });

  it("describes rules in plain English", () => {
    expect(describeRule(powerDown)).toBe(
      "When a booking ends in any room and no motion for 10 min and nothing is booked (waiting up to 90 min): lights off, HVAC setback.",
    );
    expect(describeRule({ trigger: { type: "schedule", at: "23:30", days: [1, 2, 3, 4, 5] }, conditions: [], actions: [{ type: "notify_staff", title: "x" }] }))
      .toBe("When at 23:30 on MTWTF: notify staff.");
  });
});
