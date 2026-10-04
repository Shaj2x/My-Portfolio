"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function setRoomOverride(fd: FormData) {
  await requireRole("staff");
  const v = z.object({
    room: z.string().regex(/^[a-z0-9-]+$/),
    mode: z.enum(["auto", "force_on", "force_off"]),
    minutes: z.coerce.number().int().min(15).max(24 * 60).optional(),
  }).parse({ room: fd.get("room"), mode: fd.get("mode"), minutes: fd.get("minutes") || undefined });
  const { error } = await (await createClient()).rpc("set_room_override", { p_room: v.room, p_mode: v.mode, p_minutes: v.minutes });
  if (error) throw new Error(error.message);
  revalidatePath("/staff/rooms");
}
