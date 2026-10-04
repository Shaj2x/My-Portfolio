"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dispatchNotifications } from "@/lib/notify";

export type ActionResult = { error?: string; ok?: boolean };

const uuid = z.string().uuid();

// Delivery happens after the response so the driver isn't kept waiting.
function deliverSoon() {
  after(async () => {
    try {
      await dispatchNotifications();
    } catch (err) {
      console.error("dispatch after shuttle action failed", err);
    }
  });
}

function done(error: { message: string } | null): ActionResult {
  revalidatePath("/driver");
  revalidatePath("/staff/shuttle");
  revalidatePath("/shuttle");
  return error ? { error: error.message } : { ok: true };
}

export async function startRun(runId: string): Promise<ActionResult> {
  await requireRole("driver");
  const { error } = await (await createClient()).rpc("start_run", { p_run: uuid.parse(runId) });
  return done(error);
}

export async function startUnscheduledRun(routeId: string): Promise<ActionResult> {
  await requireRole("driver");
  const { error } = await (await createClient()).rpc("start_unscheduled_run", { p_route: uuid.parse(routeId) });
  return done(error);
}

export async function endRun(runId: string): Promise<ActionResult> {
  await requireRole("driver");
  const { error } = await (await createClient()).rpc("end_run", { p_run: uuid.parse(runId) });
  return done(error);
}

export async function delayRun(runId: string, minutes: number, note?: string): Promise<ActionResult> {
  await requireRole("driver");
  const m = z.coerce.number().int().min(1).max(240).safeParse(minutes);
  if (!m.success) return { error: "Delay must be 1–240 minutes." };
  const { error } = await (await createClient()).rpc("delay_run", { p_run: uuid.parse(runId), p_minutes: m.data, p_note: note?.slice(0, 200) });
  if (!error) deliverSoon();
  return done(error);
}

export async function cancelRun(runId: string, reason: string): Promise<ActionResult> {
  await requireRole("driver");
  if (!reason.trim()) return { error: "Give a reason so tenants know what happened." };
  const { error } = await (await createClient()).rpc("cancel_run", { p_run: uuid.parse(runId), p_reason: reason.slice(0, 200) });
  if (!error) deliverSoon();
  return done(error);
}
