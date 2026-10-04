import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { analytics, type Live } from "@/lib/analytics";
import { Meter } from "@/components/charts";
import { Badge, Card } from "@/components/ui";
import { formatDateTime, formatTime, localDate } from "@/lib/format";
import { AutoRefresh } from "@/components/auto-refresh";
import { nowMs } from "@/lib/clock";

export const metadata: Metadata = { title: "Operations" };

type RoomState = { lights?: string; hvac_mode?: string; last_motion?: string };

export default async function StaffOverview() {
  const me = await requireRole("staff");
  const supabase = await createClient();
  const today = localDate();
  const [runs, tickets, ev, rooms, health, people, alerts, pending, live] = await Promise.all([
    supabase.from("runs").select("id, status, scheduled_departure, delay_minutes, late_flagged_at, driver_id, started_at").eq("service_date", today).order("scheduled_departure"),
    supabase.from("tickets").select("id, priority, source, status").neq("status", "resolved"),
    supabase.from("ev_sessions").select("id, status").in("status", ["scheduled", "charging", "paused", "requested"]),
    supabase.from("rooms").select("slug, name, state, override_mode").order("name"),
    supabase.rpc("device_health"),
    supabase.rpc("tenant_counts"),
    supabase.from("notifications").select("id, title, body, url, created_at").eq("user_id", me.id).is("read_at", null).order("created_at", { ascending: false }).limit(6),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
    analytics<Live>("/energy/live"),
  ]);
  const now = nowMs();
  const active = runs.data?.find((r) => r.status === "active");
  const next = runs.data?.find((r) => r.status === "scheduled" && new Date(r.scheduled_departure).getTime() > now - 10 * 60_000);
  const late = runs.data?.filter((r) => r.late_flagged_at && r.status === "scheduled") ?? [];
  const done = runs.data?.filter((r) => r.status === "completed") ?? [];
  const onTime = done.filter((r) => r.started_at && new Date(r.started_at).getTime() - new Date(r.scheduled_departure).getTime() <= 5 * 60_000).length;
  const open = tickets.data ?? [];
  const h = health.data?.[0];
  const tc = people.data?.[0];

  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh seconds={20} />
      <h1 className="text-2xl font-semibold">Operations</h1>

      {alerts.data?.length ? (
        <Card className="border-warn p-0">
          <h2 className="border-b border-line px-4 py-2 text-sm font-semibold">Alerts for you</h2>
          <ul className="divide-y divide-line text-sm">
            {alerts.data.map((a) => (
              <li key={a.id} className="px-4 py-2">
                {a.url ? <Link href={a.url} className="font-medium hover:underline">{a.title}</Link> : <span className="font-medium">{a.title}</span>}
                <span className="block text-xs text-ink-2">{a.body} · {formatDateTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="mb-2 text-sm text-ink-2">Shuttle</h2>
          {active ? (
            <p className="text-lg font-semibold">On the road · {formatTime(active.scheduled_departure)} run {active.delay_minutes ? <Badge tone="warn">+{active.delay_minutes} min</Badge> : <Badge tone="ok">live</Badge>}</p>
          ) : next ? (
            <p className="text-lg font-semibold">Next {formatTime(next.scheduled_departure)}</p>
          ) : <p className="text-lg font-semibold">No more runs today</p>}
          {late.length ? <p className="mt-1 text-sm text-bad">⚠ {late.length} run{late.length > 1 ? "s" : ""} not started on time</p> : null}
          <p className="mt-1 text-xs text-ink-2">{done.length} completed today · {done.length ? Math.round((100 * onTime) / done.length) : 0}% on time</p>
          <Link href="/staff/shuttle" className="mt-2 inline-block text-sm text-brand hover:underline">Shuttle board</Link>
        </Card>
        <Card>
          <h2 className="mb-2 text-sm text-ink-2">Front desk</h2>
          <p className="text-3xl font-semibold tabular-nums">{open.length} <span className="text-base font-normal text-ink-2">open requests</span></p>
          <p className="mt-1 text-xs text-ink-2">
            {open.filter((t) => t.priority === "high" || t.priority === "urgent").length} high priority · {open.filter((t) => t.source === "system").length} raised by devices
          </p>
          <p className="mt-1 text-xs text-ink-2">{pending.count ?? 0} accounts waiting for approval · {tc?.approved ?? 0} tenants</p>
          <Link href="/staff/tickets" className="mt-2 inline-block text-sm text-brand hover:underline">Tickets</Link>
        </Card>
        <Card>
          <h2 className="mb-2 text-sm text-ink-2">Building load</h2>
          {live ? <Meter value={live.total_kw} limit={live.peak_limit_kw} unit="kW" /> : <p className="text-sm text-ink-2">Analytics service not reachable.</p>}
          <p className="mt-1 text-xs text-ink-2">{ev.data?.filter((e) => e.status === "charging").length ?? 0} EVs charging · {ev.data?.length ?? 0} sessions active</p>
          <Link href="/staff/energy" className="mt-2 inline-block text-sm text-brand hover:underline">Energy</Link>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <Card className="p-0">
          <h2 className="border-b border-line px-4 py-3 font-medium">Rooms</h2>
          <ul className="divide-y divide-line text-sm">
            {(rooms.data ?? []).map((r) => {
              const st = (r.state ?? {}) as RoomState;
              const occ = st.last_motion && now - new Date(st.last_motion).getTime() < 10 * 60_000;
              return (
                <li key={r.slug} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                  <span className="font-medium">{r.name}</span>
                  <span className="flex flex-wrap gap-1">
                    <Badge tone={st.lights === "on" ? "ok" : "neutral"}>Lights {st.lights ?? "—"}</Badge>
                    <Badge>HVAC {st.hvac_mode ?? "—"}</Badge>
                    <Badge tone={occ ? "brand" : "neutral"}>{occ ? "Occupied" : "Empty"}</Badge>
                    {r.override_mode !== "auto" ? <Badge tone="warn">Manual</Badge> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-2 font-medium">Device health</h2>
          {h ? (
            <ul className="flex flex-col gap-1 text-sm">
              <li>{h.online} of {h.total} online</li>
              <li className={h.offline ? "text-bad" : ""}>{h.offline ? "⚠ " : ""}{h.offline} offline</li>
              <li className={h.fault ? "text-bad" : ""}>{h.fault ? "⚠ " : ""}{h.fault} in fault</li>
              <li>{h.low_battery} low battery · {h.stale_firmware} need firmware update</li>
            </ul>
          ) : null}
          <Link href="/staff/devices" className="mt-2 inline-block text-sm text-brand hover:underline">Devices</Link>
        </Card>
      </div>
    </div>
  );
}
