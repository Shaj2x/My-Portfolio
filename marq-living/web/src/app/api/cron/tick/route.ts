import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchNotifications } from "@/lib/notify";
import { hasBearer } from "@/lib/internal-auth";

// Once a minute: time-based maintenance (on Supabase pg_cron also runs it,
// it's idempotent) and delivery of pending push/email notifications.
// Called by the automation engine's scheduler and by Vercel Cron.
export async function GET(request: Request) {
  if (!hasBearer(request, "CRON_SECRET")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = createAdminClient();
  const { data: maintenance, error } = await db.rpc("run_maintenance");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const delivery = await dispatchNotifications();
  return NextResponse.json({ maintenance, delivery });
}
