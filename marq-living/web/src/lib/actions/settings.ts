"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function setShuttleAlerts(formData: FormData) {
  const me = await requireUser();
  const on = formData.get("shuttle_alerts") === "on";
  await (await createClient()).from("profiles").update({ shuttle_alerts: on }).eq("id", me.id);
  revalidatePath("/settings");
}

const subSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(5).max(100) }),
});

export async function savePushSubscription(sub: unknown, userAgent: string): Promise<{ error?: string }> {
  const me = await requireUser();
  const parsed = subSchema.safeParse(sub);
  if (!parsed.success) return { error: "Invalid subscription" };
  const supabase = await createClient();
  // Endpoint is unique; replace any previous owner's row for this browser.
  await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: me.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    user_agent: userAgent.slice(0, 200),
  });
  return error ? { error: error.message } : {};
}

export async function removePushSubscription(endpoint: string) {
  await requireUser();
  await (await createClient()).from("push_subscriptions").delete().eq("endpoint", endpoint);
}
