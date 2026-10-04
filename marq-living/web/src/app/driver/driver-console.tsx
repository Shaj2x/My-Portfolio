"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { cancelRun, delayRun, endRun, startRun, startUnscheduledRun, type ActionResult } from "@/lib/actions/shuttle";
import { Badge, Button, Card, Notice } from "@/components/ui";
import { formatTime } from "@/lib/format";
import { shouldSendFix, stopEtas, formatEta, type Fix, type StopPoint } from "@/lib/shuttle";

type RunRow = { id: string; route_id: string; scheduled_departure: string; status: string; delay_minutes: number | null; driver_id: string | null; started_at: string | null };
type RouteRow = { id: string; name: string; color: string };
type StopRow = StopPoint & { route_id: string };

export function DriverConsole({ userId, runs, routes, stops }: { userId: string; runs: RunRow[]; routes: RouteRow[]; stops: StopRow[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const active = runs.find((r) => r.status === "active" && (r.driver_id === userId || r.driver_id === null));
  const routeName = (id: string) => routes.find((r) => r.id === id)?.name ?? "Route";

  const run = (fn: () => Promise<ActionResult>, okText: string) =>
    start(async () => {
      const res = await fn();
      setMsg(res.error ? { tone: "bad", text: res.error } : { tone: "ok", text: okText });
    });

  return (
    <>
      <h1 className="text-2xl font-semibold">Shuttle</h1>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {active ? (
        <ActiveRun
          run={active}
          routeName={routeName(active.route_id)}
          stops={stops.filter((s) => s.route_id === active.route_id)}
          pending={pending}
          onEnd={() => run(() => endRun(active.id), "Run ended. Location sharing stopped.")}
          onDelay={(m, note) => run(() => delayRun(active.id, m, note), `Tenants told you're ${m} min late.`)}
          onCancel={(reason) => run(() => cancelRun(active.id, reason), "Run cancelled. Tenants notified.")}
        />
      ) : (
        <>
          <Card className="p-0">
            <h2 className="border-b border-line px-4 py-3 font-medium">Today&apos;s runs</h2>
            {runs.length === 0 ? <p className="px-4 py-3 text-sm text-ink-2">No more scheduled runs today.</p> : null}
            <ul className="divide-y divide-line">
              {runs.map((r) => (
                <li key={r.id} className="flex flex-col gap-3 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">{formatTime(r.scheduled_departure)}</span>
                    <span className="text-sm text-ink-2">{routeName(r.route_id)}</span>
                  </div>
                  {r.delay_minutes ? <Badge tone="warn">+{r.delay_minutes} min</Badge> : null}
                  <div className="grid grid-cols-3 gap-2">
                    <Button className="col-span-3 min-h-14 text-base" disabled={pending} onClick={() => run(() => startRun(r.id), "Run started. Sharing your location.")}>
                      Start run
                    </Button>
                    <DelayButton disabled={pending} onDelay={(m) => run(() => delayRun(r.id, m), `Tenants told the ${formatTime(r.scheduled_departure)} is ${m} min late.`)} />
                    <CancelButton disabled={pending} onCancel={(reason) => run(() => cancelRun(r.id, reason), "Run cancelled. Tenants notified.")} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          {routes.length ? (
            <Card className="flex flex-col gap-2">
              <p className="text-sm text-ink-2">Extra trip not on the timetable?</p>
              {routes.map((ro) => (
                <Button key={ro.id} variant="secondary" disabled={pending} onClick={() => run(() => startUnscheduledRun(ro.id), "Extra run started.")}>
                  Start extra run · {ro.name}
                </Button>
              ))}
            </Card>
          ) : null}
        </>
      )}
    </>
  );
}

function ActiveRun({
  run, routeName, stops, pending, onEnd, onDelay, onCancel,
}: {
  run: RunRow; routeName: string; stops: StopRow[]; pending: boolean;
  onEnd: () => void; onDelay: (m: number, note?: string) => void; onCancel: (reason: string) => void;
}) {
  const [status, setStatus] = useState<"starting" | "sharing" | "denied" | "unavailable">(() =>
    typeof navigator !== "undefined" && !("geolocation" in navigator) ? "unavailable" : "starting",
  );
  const [sent, setSent] = useState(0);
  const [trail, setTrail] = useState<Fix[]>([]);
  const last = useRef<Fix | null>(null);

  // Share GPS while the run is active: watchPosition, throttled to one post
  // every 5–10 s. Keep the screen awake so the browser doesn't suspend it.
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const supabase = createClient();
    let wake: { release: () => Promise<void> } | null = null;
    (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } })
      .wakeLock?.request("screen").then((w) => (wake = w)).catch(() => {});

    const watch = navigator.geolocation.watchPosition(
      async (pos) => {
        setStatus("sharing");
        const fix: Fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed_mps: pos.coords.speed,
          recorded_at: new Date(pos.timestamp).toISOString(),
        };
        if (!shouldSendFix(last.current, fix)) return;
        last.current = fix;
        setTrail((t) => [...t.slice(-60), fix]);
        const { error } = await supabase.from("shuttle_locations").insert({
          run_id: run.id,
          lat: fix.lat,
          lng: fix.lng,
          speed_mps: pos.coords.speed,
          heading: pos.coords.heading,
          accuracy_m: pos.coords.accuracy,
          recorded_at: fix.recorded_at,
        });
        if (!error) setSent((n) => n + 1);
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => {
      navigator.geolocation.clearWatch(watch);
      wake?.release().catch(() => {});
    };
  }, [run.id]);

  const etas = stopEtas(stops.sort((a, b) => a.sequence - b.sequence), trail);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-2">{routeName}</p>
          <p className="text-lg font-semibold">Run in progress</p>
        </div>
        <Badge tone={status === "sharing" ? "ok" : status === "starting" ? "neutral" : "bad"}>
          {status === "sharing" ? `Sharing · ${sent} sent` : status === "starting" ? "Finding GPS…" : "No location"}
        </Badge>
      </div>
      {status === "denied" ? <Notice tone="bad">Location is blocked. Allow location for this site in your browser settings so tenants can see the shuttle.</Notice> : null}
      {etas[0] ? <p className="text-sm">Next stop: <strong>{etas[0].stop.name}</strong> · {formatEta(etas[0].etaSeconds)}</p> : null}
      <Button variant="danger" className="min-h-14 text-base" disabled={pending} onClick={onEnd}>
        End run
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <DelayButton disabled={pending} onDelay={onDelay} />
        <CancelButton disabled={pending} onCancel={onCancel} />
      </div>
      <p className="text-xs text-ink-2">Your location is shared only until you end the run, then deleted.</p>
    </Card>
  );
}

function DelayButton({ disabled, onDelay }: { disabled: boolean; onDelay: (m: number, note?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(10);
  if (!open) return <Button variant="secondary" disabled={disabled} onClick={() => setOpen(true)}>Delayed</Button>;
  return (
    <div className="col-span-3 flex flex-wrap items-center gap-2">
      {[5, 10, 15, 30].map((m) => (
        <Button key={m} variant={m === minutes ? "primary" : "secondary"} onClick={() => setMinutes(m)}>
          {m} min
        </Button>
      ))}
      <Button disabled={disabled} onClick={() => { onDelay(minutes); setOpen(false); }}>Send</Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
    </div>
  );
}

function CancelButton({ disabled, onCancel }: { disabled: boolean; onCancel: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <Button variant="danger" disabled={disabled} onClick={() => setOpen(true)}>Cancel run</Button>;
  return (
    <div className="col-span-3 flex flex-col gap-2">
      <label htmlFor="cancel-reason" className="text-sm font-medium">Reason (shown to tenants)</label>
      <input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200}
        className="min-h-11 rounded-lg border border-line bg-surface px-3" placeholder="e.g. Vehicle issue" />
      <div className="flex gap-2">
        <Button variant="danger" disabled={disabled || !reason.trim()} onClick={() => { onCancel(reason); setOpen(false); }}>Cancel this run</Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Keep run</Button>
      </div>
    </div>
  );
}
