"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dispatchNotifications } from "@/lib/notify";

const id = z.string().uuid();
const time = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");

async function db() {
  await requireRole("staff");
  return createClient();
}
function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
  revalidatePath("/staff/shuttle");
}

export async function createRoute(fd: FormData) {
  const v = z.object({ name: z.string().trim().min(1).max(80), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) })
    .parse({ name: fd.get("name"), color: fd.get("color") || "#1b2a4a" });
  check((await (await db()).from("routes").insert(v)).error);
}

export async function setRouteActive(fd: FormData) {
  check((await (await db()).from("routes").update({ active: fd.get("active") === "true" }).eq("id", id.parse(fd.get("id")))).error);
}

export async function setRoutePath(fd: FormData) {
  const raw = String(fd.get("path") ?? "").trim();
  let path = null;
  if (raw) {
    const parsed = JSON.parse(raw);
    const geom = parsed.type === "Feature" ? parsed.geometry : parsed.type === "FeatureCollection" ? parsed.features?.[0]?.geometry : parsed;
    if (geom?.type !== "LineString" || !Array.isArray(geom.coordinates)) throw new Error("Paste a GeoJSON LineString");
    path = { type: "LineString", coordinates: geom.coordinates };
  }
  check((await (await db()).from("routes").update({ path }).eq("id", id.parse(fd.get("id")))).error);
}

export async function addStop(fd: FormData) {
  const v = z.object({
    route_id: id,
    name: z.string().trim().min(1).max(80),
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    sequence: z.coerce.number().int().min(0).max(200),
    offset_minutes: z.coerce.number().int().min(0).max(300),
    dwell_seconds: z.coerce.number().int().min(0).max(900).default(60),
  }).parse(Object.fromEntries(fd));
  check((await (await db()).from("stops").insert(v)).error);
}

export async function deleteStop(fd: FormData) {
  check((await (await db()).from("stops").delete().eq("id", id.parse(fd.get("id")))).error);
}

export async function addDepartures(fd: FormData) {
  const route_id = id.parse(fd.get("route_id"));
  const t = time.parse(fd.get("time"));
  const days = fd.getAll("day").map((d) => z.coerce.number().int().min(0).max(6).parse(d));
  if (!days.length) throw new Error("Pick at least one day");
  check((await (await db()).from("scheduled_runs").upsert(days.map((day_of_week) => ({ route_id, day_of_week, departure_time: t, active: true })),
    { onConflict: "route_id,day_of_week,departure_time" })).error);
}

export async function deleteDeparture(fd: FormData) {
  check((await (await db()).from("scheduled_runs").delete().eq("id", id.parse(fd.get("id")))).error);
}

export async function addException(fd: FormData) {
  const me = await requireRole("staff");
  const v = z.object({
    service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    kind: z.enum(["no_service", "cancel_run", "extra_run", "retime_run"]),
    route_id: id.optional(),
    scheduled_run_id: id.optional(),
    departure_time: time.optional(),
    note: z.string().max(200).optional(),
  }).parse(Object.fromEntries([...fd.entries()].filter(([, val]) => val !== "")));
  const supabase = await createClient();
  check((await supabase.from("schedule_exceptions").insert({ ...v, created_by: me.id })).error);
}

export async function deleteException(fd: FormData) {
  check((await (await db()).from("schedule_exceptions").delete().eq("id", id.parse(fd.get("id")))).error);
}

export async function staffDelayRun(fd: FormData) {
  const supabase = await db();
  const { error } = await supabase.rpc("delay_run", {
    p_run: id.parse(fd.get("id")),
    p_minutes: z.coerce.number().int().min(1).max(240).parse(fd.get("minutes")),
    p_note: String(fd.get("note") ?? "").slice(0, 200) || undefined,
  });
  if (!error) after(() => dispatchNotifications().catch(console.error));
  check(error);
}

export async function staffCancelRun(fd: FormData) {
  const supabase = await db();
  const { error } = await supabase.rpc("cancel_run", { p_run: id.parse(fd.get("id")), p_reason: z.string().trim().min(1).max(200).parse(fd.get("reason")) });
  if (!error) after(() => dispatchNotifications().catch(console.error));
  check(error);
}

export async function staffEndRun(fd: FormData) {
  check((await (await db()).rpc("end_run", { p_run: id.parse(fd.get("id")) })).error);
}
