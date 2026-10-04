import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { localDate } from "@/lib/format";
import { DriverConsole } from "./driver-console";

export const metadata: Metadata = { title: "Driver" };

export default async function DriverPage() {
  const profile = await requireRole("driver");
  const supabase = await createClient();
  const today = localDate();
  const [{ data: runs }, { data: routes }, { data: stops }] = await Promise.all([
    supabase.from("runs")
      .select("id, route_id, scheduled_departure, status, delay_minutes, driver_id, started_at")
      .in("status", ["scheduled", "active"])
      .gte("service_date", today)
      .lte("service_date", today)
      .order("scheduled_departure"),
    supabase.from("routes").select("id, name, color").eq("active", true).order("name"),
    supabase.from("stops").select("id, route_id, name, lat, lng, sequence, dwell_seconds").order("sequence"),
  ]);

  return (
    <>
      <AppHeader profile={profile} homeHref="/driver" />
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
        <DriverConsole userId={profile.id} runs={runs ?? []} routes={routes ?? []} stops={stops ?? []} />
      </main>
    </>
  );
}
