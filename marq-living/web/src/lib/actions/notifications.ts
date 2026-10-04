"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export async function markNotificationsRead(ids?: number[]) {
  await requireUser();
  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read", ids?.length ? { p_ids: ids } : {});
}
