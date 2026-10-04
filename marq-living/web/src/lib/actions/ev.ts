"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { analyticsPost } from "@/lib/analytics";
import { dispatchNotifications } from "@/lib/notify";
import { localToUtc } from "@/lib/format";
import type { FormState } from "@/app/(auth)/actions";

// Typical EV: ~18 kWh per 100 km in mixed driving.
const KWH_PER_KM = 0.18;

const schema = z.object({
  amount: z.coerce.number().positive("Enter an amount"),
  unit: z.enum(["km", "kwh"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time"),
  vehicle: z.string().trim().max(40).optional(),
});

export async function requestCharge(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole("tenant");
  const values = Object.fromEntries(["amount", "unit", "date", "time", "vehicle"].map((k) => [k, String(fd.get(k) ?? "")]));
  const v = schema.safeParse(values);
  if (!v.success) return { errors: Object.fromEntries(v.error.issues.map((i) => [String(i.path[0]), i.message])), values };
  const kwh = v.data.unit === "km" ? v.data.amount * KWH_PER_KM : v.data.amount;
  if (kwh > 120) return { errors: { amount: "That's more than a full battery (max 120 kWh)." }, values };
  const { error } = await (await createClient()).from("ev_sessions").insert({
    tenant_id: me.id,
    requested_kwh: Math.round(kwh * 10) / 10,
    departure_time: localToUtc(v.data.date, v.data.time).toISOString(),
    vehicle_label: v.data.vehicle || null,
  });
  if (error) return { message: error.code === "P0001" ? error.message : "Couldn't request a charge.", values };
  // Plan right away so the tenant sees an estimate.
  await analyticsPost("/ev/schedule", {});
  after(() => dispatchNotifications().catch(console.error));
  revalidatePath("/ev");
  return { done: true };
}

export async function cancelCharge(fd: FormData) {
  await requireRole("tenant");
  const id = z.string().uuid().parse(fd.get("id"));
  await (await createClient()).from("ev_sessions").update({ status: "cancelled" }).eq("id", id);
  await analyticsPost("/ev/schedule", {});
  revalidatePath("/ev");
}

export async function replanEv() {
  await requireRole("staff");
  await analyticsPost("/ev/schedule", {});
  revalidatePath("/staff/ev");
}

export async function runForecastNow() {
  await requireRole("staff");
  await analyticsPost("/forecast/run", {});
  revalidatePath("/staff/ev");
}
