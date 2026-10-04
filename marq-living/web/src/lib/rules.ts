// Automation rule schema, mirroring services/internal/automation/rules.go
// (ParseRule). The editor validates with this before saving so the engine
// never has to skip a rule.
import { z } from "zod";

export const TRIGGERS = {
  "booking.starting": "A booking is about to start",
  "booking.started": "A booking starts",
  "booking.ended": "A booking ends",
  "motion.detected": "Motion is detected",
  "room.vacant": "A room has been empty for a while",
  schedule: "At a set time",
  "device.fault": "A device reports a fault",
  "device.anomaly": "A device reports an abnormal reading",
} as const;

export const CONDITIONS = {
  no_motion_for: "No motion for N minutes",
  motion_within: "Motion within the last N minutes",
  no_active_booking: "No booking in progress (or starting within N min)",
  active_booking: "A booking is in progress (or starting within N min)",
  time_between: "Time is between",
  price_period: "Electricity price period is",
} as const;

export const ACTIONS = {
  set_lights: "Turn lights",
  set_hvac: "Set HVAC to",
  notify_staff: "Notify staff",
} as const;

const hhmm = z.string().regex(/^([01]?\d|2[0-4]):[0-5]\d$/, "Use HH:MM");

export const triggerSchema = z
  .object({
    type: z.enum(Object.keys(TRIGGERS) as [keyof typeof TRIGGERS, ...(keyof typeof TRIGGERS)[]]),
    room: z.string().optional(),
    minutes: z.number().int().min(0).max(24 * 60).optional(),
    at: hhmm.optional(),
    days: z.array(z.number().int().min(0).max(6)).optional(),
    wait_up_to_minutes: z.number().int().min(0).max(24 * 60).optional(),
    cooldown_minutes: z.number().int().min(0).max(7 * 24 * 60).optional(),
  })
  .refine((t) => t.type !== "schedule" || !!t.at, { message: "A schedule needs a time", path: ["at"] });

export const conditionSchema = z.object({
  type: z.enum(Object.keys(CONDITIONS) as [keyof typeof CONDITIONS, ...(keyof typeof CONDITIONS)[]]),
  room: z.string().optional(),
  minutes: z.number().int().min(0).max(24 * 60).optional(),
  from: hhmm.optional(),
  to: hhmm.optional(),
  in: z.array(z.enum(["ultra_low", "weekend_off_peak", "off_peak", "mid_peak", "on_peak"])).optional(),
});

export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_lights"), room: z.string().min(1, "Pick a room"), state: z.enum(["on", "off"]) }),
  z.object({ type: z.literal("set_hvac"), room: z.string().min(1, "Pick a room"), mode: z.enum(["comfort", "setback", "off"]) }),
  z.object({ type: z.literal("notify_staff"), title: z.string().trim().min(1, "Add a title").max(120), body: z.string().max(500).optional() }),
]);

export const ruleSchema = z.object({
  name: z.string().trim().min(1, "Name the rule").max(120),
  description: z.string().max(500).optional(),
  priority: z.number().int().min(0).max(1000),
  enabled: z.boolean(),
  trigger: triggerSchema,
  conditions: z.array(conditionSchema).max(10),
  actions: z.array(actionSchema).min(1, "Add at least one action").max(10),
});

export type RuleInput = z.infer<typeof ruleSchema>;

/** One-line English summary of a rule, for lists. */
export function describeRule(r: Pick<RuleInput, "trigger" | "conditions" | "actions">): string {
  const room = (x?: string) => (!x || x === "*" ? "any room" : x === "$room" ? "that room" : x);
  const t = r.trigger;
  const when =
    t.type === "booking.starting" ? `${t.minutes ?? 15} min before a booking in ${room(t.room)}`
      : t.type === "room.vacant" ? `${room(t.room)} has had no motion for ${t.minutes ?? 15} min`
        : t.type === "schedule" ? `at ${t.at}${t.days?.length && t.days.length < 7 ? ` on ${t.days.map((d) => "SMTWTFS"[d]).join("")}` : " daily"}`
          : `${TRIGGERS[t.type].toLowerCase()}${t.type.startsWith("device") ? "" : ` in ${room(t.room)}`}`;
  const cond = r.conditions.map((c) =>
    c.type === "no_motion_for" ? `no motion for ${c.minutes} min`
      : c.type === "motion_within" ? `motion in the last ${c.minutes} min`
        : c.type === "no_active_booking" ? "nothing is booked"
          : c.type === "active_booking" ? "it's booked"
            : c.type === "time_between" ? `between ${c.from} and ${c.to}`
              : `price is ${(c.in ?? []).join("/").replaceAll("_", " ")}`);
  const act = r.actions.map((a) =>
    a.type === "set_lights" ? `lights ${a.state}` : a.type === "set_hvac" ? `HVAC ${a.mode}` : `notify staff`);
  return `When ${when}${cond.length ? ` and ${cond.join(" and ")}` : ""}${t.wait_up_to_minutes ? ` (waiting up to ${t.wait_up_to_minutes} min)` : ""}: ${act.join(", ")}.`;
}
