"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dispatchNotifications } from "@/lib/notify";
import { toRange } from "@/lib/format";

export type BookingResult = { error?: string; ok?: boolean };

const bookSchema = z.object({
  amenityId: z.string().uuid(),
  start: z.string().datetime(),
  minutes: z.coerce.number().int().min(15).max(24 * 60),
  guests: z.coerce.number().int().min(0).max(50).default(0),
});

export async function createBooking(input: { amenityId: string; start: string; minutes: number; guests?: number }): Promise<BookingResult> {
  const me = await requireRole("tenant");
  const v = bookSchema.safeParse(input);
  if (!v.success) return { error: "Pick a time and length." };
  const start = new Date(v.data.start);
  const end = new Date(start.getTime() + v.data.minutes * 60000);
  const { error } = await (await createClient()).from("bookings").insert({
    amenity_id: v.data.amenityId,
    tenant_id: me.id,
    unit: me.unit!,
    period: toRange(start, end),
    guests: v.data.guests,
  });
  if (error) {
    // Rule violations come back as friendly P0001 messages from validate_booking().
    if (error.code === "23P01") return { error: "Someone just booked that time. Pick another." };
    return { error: error.code === "P0001" ? error.message : "Couldn't book that time." };
  }
  after(() => dispatchNotifications().catch((e) => console.error(e)));
  revalidatePath("/book");
  return { ok: true };
}

export async function cancelBooking(formData: FormData) {
  await requireRole("tenant");
  const id = z.string().uuid().parse(formData.get("id"));
  await (await createClient()).from("bookings").update({ status: "cancelled" }).eq("id", id);
  revalidatePath("/book");
}
