"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { localToUtc, toRange } from "@/lib/format";

const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);

export async function updateAmenityRules(fd: FormData) {
  await requireRole("staff");
  const v = z.object({
    id: z.string().uuid(),
    max_duration_minutes: z.coerce.number().int().min(15).max(1440),
    min_duration_minutes: z.coerce.number().int().min(15).max(1440),
    weekly_limit_per_unit: z.coerce.number().int().min(0).max(50),
    booking_window_days: z.coerce.number().int().min(1).max(120),
    min_notice_minutes: z.coerce.number().int().min(0).max(10080),
    buffer_minutes: z.coerce.number().int().min(0).max(240),
    open_time: time,
    close_time: time,
    active: z.boolean(),
  }).refine((x) => x.min_duration_minutes <= x.max_duration_minutes, "Minimum must be ≤ maximum")
    .parse({ ...Object.fromEntries(fd), active: fd.get("active") === "on" });
  const { id, ...patch } = v;
  const { error } = await (await createClient()).from("amenities").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/staff/amenities");
}

export async function addBlackout(fd: FormData) {
  const me = await requireRole("staff");
  const v = z.object({
    amenity_id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    from: time, to: time,
    reason: z.string().max(200).optional(),
  }).parse(Object.fromEntries(fd));
  const start = localToUtc(v.date, v.from.slice(0, 5));
  const end = localToUtc(v.date, v.to.slice(0, 5));
  if (end <= start) throw new Error("End must be after start");
  const { error } = await (await createClient()).from("amenity_blackouts").insert({
    amenity_id: v.amenity_id, period: toRange(start, end), reason: v.reason || null, created_by: me.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/staff/amenities");
}

export async function deleteBlackout(fd: FormData) {
  await requireRole("staff");
  await (await createClient()).from("amenity_blackouts").delete().eq("id", z.string().uuid().parse(fd.get("id")));
  revalidatePath("/staff/amenities");
}

export async function staffCancelBooking(fd: FormData) {
  await requireRole("staff");
  await (await createClient()).from("bookings").update({ status: "cancelled" }).eq("id", z.string().uuid().parse(fd.get("id")));
  revalidatePath("/staff/amenities");
}
