import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ShuttleLive } from "./shuttle-live";

export const metadata: Metadata = { title: "Shuttle" };

export default async function ShuttlePage() {
  await requireRole("tenant");
  const supabase = await createClient();
  const [{ data: routes }, { data: stops }, { data: active }, { data: next }] = await Promise.all([
    supabase.from("routes").select("id, name, color, path").eq("active", true).order("name"),
    supabase.from("stops").select("id, route_id, name, lat, lng, sequence, dwell_seconds, offset_minutes").order("sequence"),
    supabase.from("runs").select("id, route_id, started_at, delay_minutes, scheduled_departure").eq("status", "active"),
    supabase.rpc("next_departures", { p_limit: 6 }),
  ]);

  const activeRun = active?.[0] ?? null;
  const { data: trail } = activeRun
    ? await supabase.from("shuttle_locations").select("lat, lng, heading, speed_mps, recorded_at")
        .eq("run_id", activeRun.id).order("recorded_at", { ascending: false }).limit(120)
    : { data: [] };

  return (
    <ShuttleLive
      routes={routes ?? []}
      stops={stops ?? []}
      activeRun={activeRun}
      initialTrail={(trail ?? []).reverse()}
      departures={next ?? []}
    />
  );
}
