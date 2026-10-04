import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LaundryLive } from "./laundry-live";

export const metadata: Metadata = { title: "Laundry" };

export default async function LaundryPage() {
  const me = await requireRole("tenant");
  const supabase = await createClient();
  const [{ data: machines }, { data: watches }] = await Promise.all([
    supabase.from("laundry_machines").select("id, label, kind, state, state_since, est_done_at").order("kind", { ascending: false }).order("label"),
    supabase.from("laundry_watchers").select("kind").eq("user_id", me.id),
  ]);
  return <LaundryLive initial={machines ?? []} watching={(watches ?? []).map((w) => w.kind)} />;
}
