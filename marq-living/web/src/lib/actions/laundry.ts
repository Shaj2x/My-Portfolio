"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function toggleLaundryWatch(formData: FormData) {
  const me = await requireRole("tenant");
  const kind = z.enum(["washer", "dryer"]).parse(formData.get("kind"));
  const supabase = await createClient();
  if (formData.get("on") === "true") {
    await supabase.from("laundry_watchers").upsert({ user_id: me.id, kind }, { onConflict: "user_id,kind", ignoreDuplicates: true });
  } else {
    await supabase.from("laundry_watchers").delete().eq("user_id", me.id).eq("kind", kind);
  }
  revalidatePath("/laundry");
}
