"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/app/(auth)/actions";
import type { Json } from "@/lib/database.types";

const json = z.string().trim().transform((s, ctx) => {
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    if (typeof v !== "object" || Array.isArray(v) || v === null) throw new Error();
    return v as Record<string, Json>;
  } catch {
    ctx.addIssue({ code: "custom", message: "Must be a JSON object" });
    return z.NEVER;
  }
});

const deviceSchema = z.object({
  id: z.string().uuid().optional(),
  hardware_id: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,62}$/, "Lowercase letters, digits and dashes (it's the MQTT username)"),
  name: z.string().trim().min(1, "Name it").max(80),
  type: z.enum(["ct_node", "pir", "relay", "thermostat", "ev_charger", "shuttle_telematics", "gateway"]),
  location: z.string().trim().min(1, "Where is it?").max(80),
  circuit: z.string().trim().max(80).optional(),
  room_id: z.string().uuid().or(z.literal("")).optional(),
  calibration: json,
  config: json,
});

export async function saveDevice(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireRole("admin");
  const values = Object.fromEntries(["id", "hardware_id", "name", "type", "location", "circuit", "room_id", "calibration", "config"].map((k) => [k, String(fd.get(k) ?? "")]));
  const v = deviceSchema.safeParse({ ...values, id: values.id || undefined });
  if (!v.success) return { errors: Object.fromEntries(v.error.issues.map((i) => [String(i.path[0]), i.message])), values };
  const { id, room_id, circuit, ...rest } = v.data;
  const row = { ...rest, circuit: circuit || null, room_id: room_id || null };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("devices").update(row).eq("id", id) : await supabase.from("devices").insert(row);
  if (error) return { message: error.code === "23505" ? "That hardware ID is already registered." : error.message, values };
  // Keep the room's device list in sync for room automation.
  if (room_id) {
    const { data: dev } = await supabase.from("devices").select("id").eq("hardware_id", v.data.hardware_id).single();
    const { data: room } = await supabase.from("rooms").select("device_ids").eq("id", room_id).single();
    if (dev && room && !room.device_ids.includes(dev.id)) {
      await supabase.from("rooms").update({ device_ids: [...room.device_ids, dev.id] }).eq("id", room_id);
    }
  }
  revalidatePath("/staff/devices");
  return { done: true, message: id ? "Saved." : `Registered ${v.data.hardware_id}. Create its MQTT login with infra/mosquitto/make-passwords.sh.` };
}

export async function retireDevice(fd: FormData) {
  await requireRole("admin");
  const id = z.string().uuid().parse(fd.get("id"));
  await (await createClient()).from("devices").update({ status: "retired" }).eq("id", id);
  revalidatePath("/staff/devices");
}

export async function acknowledgeEvent(fd: FormData) {
  const me = await requireRole("staff");
  const id = z.coerce.number().int().parse(fd.get("id"));
  await (await createClient()).from("device_events").update({ acknowledged_by: me.id, acknowledged_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/staff/devices");
}
