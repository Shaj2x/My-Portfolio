"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RouteMap } from "@/components/route-map";
import { Badge, Card, Notice } from "@/components/ui";
import { formatEta, stopEtas, type Fix, type StopPoint } from "@/lib/shuttle";
import { formatDay, formatTime, localDate, relativeMinutes } from "@/lib/format";
import type { LatLng } from "@/lib/geo";
import type { Json } from "@/lib/database.types";

type RouteRow = { id: string; name: string; color: string; path: Json | null };
type StopRow = StopPoint & { route_id: string; offset_minutes: number };
type ActiveRun = { id: string; route_id: string; started_at: string | null; delay_minutes: number | null; scheduled_departure: string };
type Departure = { run_id: string | null; route_id: string | null; route_name: string | null; departs_at: string | null; status: string | null; delay_minutes: number | null; cancel_reason: string | null };

function pathOf(route: RouteRow | undefined): LatLng[] | undefined {
  const p = route?.path as { type?: string; coordinates?: [number, number][] } | null;
  return p?.type === "LineString" && p.coordinates ? p.coordinates.map(([lng, lat]) => ({ lat, lng })) : undefined;
}

export function ShuttleLive({
  routes, stops, activeRun, initialTrail, departures,
}: { routes: RouteRow[]; stops: StopRow[]; activeRun: ActiveRun | null; initialTrail: Fix[]; departures: Departure[] }) {
  const router = useRouter();
  const [trail, setTrail] = useState<Fix[]>(initialTrail);
  const [now, setNow] = useState(() => Date.now());

  // Live position over Realtime; run start/end refreshes the page data.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("shuttle");
    if (activeRun) {
      channel.on("postgres_changes",
        { event: "INSERT", schema: "public", table: "shuttle_locations", filter: `run_id=eq.${activeRun.id}` },
        (payload) => setTrail((t) => [...t.slice(-119), payload.new as Fix]));
    }
    channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "runs" }, () => router.refresh());
    channel.subscribe();
    // Fallback if Realtime is blocked (some campus networks): refresh every 15 s.
    const poll = setInterval(() => router.refresh(), 15000);
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [activeRun, router]);

  // New server data (after a refresh) replaces the live trail.
  const [seed, setSeed] = useState(initialTrail);
  if (seed !== initialTrail) {
    setSeed(initialTrail);
    setTrail(initialTrail);
  }

  const route = routes.find((r) => r.id === (activeRun?.route_id ?? departures[0]?.route_id)) ?? routes[0];
  const routeStops = useMemo(() => stops.filter((s) => s.route_id === route?.id).sort((a, b) => a.sequence - b.sequence), [stops, route]);
  const etas = activeRun ? stopEtas(routeStops, trail) : [];
  const here = trail.at(-1) ?? null;
  const stale = here ? now - new Date(here.recorded_at).getTime() > 60_000 : false;

  if (!route) {
    return <Card className="text-sm text-ink-2">The shuttle schedule hasn&apos;t been set up yet.</Card>;
  }

  const nextDep = departures.find((d) => d.status === "scheduled");
  const cancelled = departures.filter((d) => d.status === "cancelled");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Shuttle</h1>
        {activeRun ? <Badge tone={activeRun.delay_minutes ? "warn" : "ok"}>{activeRun.delay_minutes ? `${activeRun.delay_minutes} min late` : "Live"}</Badge> : <Badge>Not running</Badge>}
      </div>

      <RouteMap
        stops={routeStops.map((s) => ({ ...s, next: etas[0]?.stop.id === s.id }))}
        path={pathOf(route)}
        shuttle={activeRun && here ? here : null}
        color={route.color}
      />

      {activeRun ? (
        <Card className="p-0">
          <h2 className="border-b border-line px-4 py-3 font-medium">{route.name}</h2>
          {stale ? <div className="px-4 pt-3"><Notice tone="warn">Location hasn&apos;t updated for a minute — the driver may be out of signal.</Notice></div> : null}
          {here ? null : <p className="px-4 py-3 text-sm text-ink-2">Waiting for the shuttle&apos;s first location…</p>}
          <ol className="divide-y divide-line">
            {etas.map((e, i) => (
              <li key={e.stop.id} className="flex items-center justify-between px-4 py-3">
                <span className={i === 0 ? "font-semibold" : ""}>{e.stop.name}</span>
                <span className="tabular-nums text-sm">{formatEta(e.etaSeconds)}</span>
              </li>
            ))}
          </ol>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-ink-2">No shuttle on the road right now.</p>
          {nextDep?.departs_at ? (
            <p className="mt-1 text-lg font-semibold">
              Next departure {formatTime(nextDep.departs_at)}{" "}
              <span className="text-sm font-normal text-ink-2">({relativeMinutes(nextDep.departs_at, now)})</span>
            </p>
          ) : (
            <p className="mt-1 font-medium">No more departures scheduled.</p>
          )}
          {nextDep?.delay_minutes ? <p className="mt-1 text-sm text-warn">Running {nextDep.delay_minutes} min late</p> : null}
        </Card>
      )}

      {cancelled.length ? (
        <Notice tone="bad">
          {cancelled.map((d) => `${formatTime(d.departs_at!)} cancelled${d.cancel_reason ? ` — ${d.cancel_reason}` : ""}`).join(" · ")}
        </Notice>
      ) : null}

      {departures.length ? (
        <Card className="p-0">
          <h2 className="border-b border-line px-4 py-3 font-medium">Upcoming departures</h2>
          <ul className="divide-y divide-line">
            {departures.map((d) => (
              <li key={d.run_id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium tabular-nums">
                    {localDate(d.departs_at!) === localDate(new Date(now)) ? "" : `${formatDay(d.departs_at!)} · `}
                    {formatTime(d.departs_at!)}
                  </span>
                  <span className="block truncate text-xs text-ink-2">{d.route_name}</span>
                </span>
                {d.status === "cancelled" ? <Badge tone="bad">Cancelled</Badge> : d.delay_minutes ? <Badge tone="warn">+{d.delay_minutes} min</Badge> : <span className="whitespace-nowrap"><Badge>On time</Badge></span>}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
