import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Button, Card } from "@/components/ui";
import { formatDay, formatTime, localDate, localToUtc } from "@/lib/format";
import * as A from "@/lib/actions/shuttle-admin";
import { analytics, type Electrification } from "@/lib/analytics";

export const metadata: Metadata = { title: "Shuttle" };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const input = "min-h-11 rounded-lg border border-line bg-surface px-3 text-sm";

function interval(s: string | null) {
  if (!s) return "—";
  const [h, m, sec] = s.split(":").map(Number);
  return h ? `${h} h ${m} min` : `${m} min ${Math.round(sec)} s`;
}

export default async function StaffShuttlePage() {
  await requireRole("staff");
  const supabase = await createClient();
  const today = localDate();
  const [{ data: routes }, { data: stops }, { data: sched }, { data: exceptions }, { data: runs }, { data: metrics }, { data: drivers }] = await Promise.all([
    supabase.from("routes").select("*").order("name"),
    supabase.from("stops").select("*").order("sequence"),
    supabase.from("scheduled_runs").select("*").order("departure_time"),
    supabase.from("schedule_exceptions").select("*").gte("service_date", today).order("service_date"),
    supabase.from("runs").select("*").eq("service_date", today).order("scheduled_departure"),
    supabase.from("shuttle_run_metrics").select("*").order("created_at", { ascending: false }).limit(15),
    supabase.from("profiles").select("id, full_name").in("role", ["driver", "staff", "admin"]),
  ]);
  const ev = await analytics<Electrification>("/shuttle/electrification");
  const driverName = (pid: string | null) => drivers?.find((d) => d.id === pid)?.full_name ?? "—";
  const routeName = (rid: string | null) => routes?.find((r) => r.id === rid)?.name ?? "All routes";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Shuttle</h1>

      <Card className="p-0">
        <h2 className="border-b border-line px-4 py-3 font-medium">Today · {formatDay(localToUtc(today, "12:00"))}</h2>
        {!runs?.length ? <p className="px-4 py-3 text-sm text-ink-2">No runs today.</p> : null}
        <ul className="divide-y divide-line">
          {(runs ?? []).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <span className="font-semibold tabular-nums">{formatTime(r.scheduled_departure)}</span> · {routeName(r.route_id)}
                <span className="ml-2 inline-flex gap-1">
                  <Badge tone={r.status === "active" ? "ok" : r.status === "cancelled" ? "bad" : "neutral"}>{r.status}</Badge>
                  {r.delay_minutes ? <Badge tone="warn">+{r.delay_minutes} min</Badge> : null}
                  {r.late_flagged_at && r.status === "scheduled" ? <Badge tone="bad">Not started</Badge> : null}
                </span>
                <span className="block text-xs text-ink-2">Driver: {driverName(r.driver_id)}{r.cancel_reason ? ` · ${r.cancel_reason}` : ""}</span>
              </div>
              {r.status === "scheduled" || r.status === "active" ? (
                <div className="flex flex-wrap gap-2">
                  <form action={A.staffDelayRun} className="flex gap-1">
                    <input type="hidden" name="id" value={r.id} />
                    <input name="minutes" type="number" min={1} max={240} defaultValue={10} aria-label="Delay minutes" className={`${input} w-20`} />
                    <Button type="submit" variant="secondary">Delay</Button>
                  </form>
                  <form action={A.staffCancelRun} className="flex gap-1">
                    <input type="hidden" name="id" value={r.id} />
                    <input name="reason" required placeholder="Reason" aria-label="Cancel reason" className={`${input} w-36`} />
                    <Button type="submit" variant="danger">Cancel</Button>
                  </form>
                  {r.status === "active" ? (
                    <form action={A.staffEndRun}><input type="hidden" name="id" value={r.id} /><Button type="submit" variant="secondary">End</Button></form>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      {(routes ?? []).map((route) => {
        const rs = (stops ?? []).filter((s) => s.route_id === route.id);
        const deps = (sched ?? []).filter((s) => s.route_id === route.id);
        const times = [...new Set(deps.map((d) => d.departure_time.slice(0, 5)))].sort();
        return (
          <Card key={route.id} className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <span className="size-3 rounded-full" style={{ background: route.color }} /> {route.name}
                {!route.active ? <Badge>Inactive</Badge> : null}
              </h2>
              <form action={A.setRouteActive}>
                <input type="hidden" name="id" value={route.id} />
                <input type="hidden" name="active" value={String(!route.active)} />
                <Button type="submit" variant="ghost">{route.active ? "Deactivate" : "Activate"}</Button>
              </form>
            </div>

            <section>
              <h3 className="mb-2 text-sm font-medium">Stops</h3>
              <ol className="mb-2 divide-y divide-line rounded-lg border border-line text-sm">
                {rs.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>{s.sequence}. {s.name} <span className="text-xs text-ink-2">+{s.offset_minutes} min · {s.lat.toFixed(4)}, {s.lng.toFixed(4)}</span></span>
                    <form action={A.deleteStop}><input type="hidden" name="id" value={s.id} /><Button type="submit" variant="ghost" aria-label={`Remove ${s.name}`}>Remove</Button></form>
                  </li>
                ))}
              </ol>
              <form action={A.addStop} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                <input type="hidden" name="route_id" value={route.id} />
                <input name="name" required placeholder="Stop name" aria-label="Stop name" className={`${input} col-span-2`} />
                <input name="lat" required inputMode="decimal" placeholder="Lat" aria-label="Latitude" className={input} />
                <input name="lng" required inputMode="decimal" placeholder="Lng" aria-label="Longitude" className={input} />
                <input name="sequence" required type="number" min={0} defaultValue={rs.length} aria-label="Order" className={input} />
                <input name="offset_minutes" required type="number" min={0} placeholder="+min" aria-label="Minutes after departure" className={input} />
                <Button type="submit" variant="secondary" className="col-span-2 sm:col-span-6">Add stop</Button>
              </form>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-medium">Weekly timetable</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr><th className="text-left font-normal text-ink-2">Departs</th>{DAYS.map((d) => <th key={d} className="font-normal text-ink-2">{d}</th>)}</tr></thead>
                  <tbody>
                    {times.map((t) => (
                      <tr key={t} className="border-t border-line">
                        <td className="py-1 tabular-nums">{t}</td>
                        {DAYS.map((_, i) => {
                          const dep = deps.find((d) => d.day_of_week === i && d.departure_time.startsWith(t));
                          return (
                            <td key={i} className="text-center">
                              {dep ? (
                                <form action={A.deleteDeparture}><input type="hidden" name="id" value={dep.id} />
                                  <button type="submit" className="min-h-9 min-w-9 rounded text-ok hover:bg-bad-bg hover:text-bad" title="Remove">●</button>
                                </form>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <form action={A.addDepartures} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="route_id" value={route.id} />
                <input name="time" type="time" required aria-label="Departure time" className={input} />
                {DAYS.map((d, i) => (
                  <label key={d} className="flex items-center gap-1 text-sm"><input type="checkbox" name="day" value={i} defaultChecked={i >= 1 && i <= 5} />{d}</label>
                ))}
                <Button type="submit" variant="secondary">Add departure</Button>
              </form>
            </section>

            <details>
              <summary className="cursor-pointer text-sm font-medium">Route line (GeoJSON)</summary>
              <form action={A.setRoutePath} className="mt-2 flex flex-col gap-2">
                <input type="hidden" name="id" value={route.id} />
                <textarea name="path" rows={3} defaultValue={route.path ? JSON.stringify(route.path) : ""} className="rounded-lg border border-line bg-surface p-2 font-mono text-xs"
                  placeholder='{"type":"LineString","coordinates":[[-81.25,42.99],…]} — leave empty to draw straight lines between stops' />
                <Button type="submit" variant="secondary" className="self-start">Save line</Button>
              </form>
            </details>
          </Card>
        );
      })}

      <Card>
        <h2 className="mb-2 font-medium">New route</h2>
        <form action={A.createRoute} className="flex flex-wrap gap-2">
          <input name="name" required placeholder="Route name" aria-label="Route name" className={`${input} flex-1`} />
          <input name="color" type="color" defaultValue="#1b2a4a" aria-label="Colour" className="min-h-11 w-14 rounded-lg border border-line" />
          <Button type="submit" variant="secondary">Create</Button>
        </form>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-medium">Holidays and changes</h2>
        <ul className="divide-y divide-line text-sm">
          {(exceptions ?? []).map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 py-2">
              <span>
                <span className="font-medium">{formatDay(localToUtc(e.service_date, "12:00"))}</span> · {e.kind.replace("_", " ")} · {routeName(e.route_id)}
                {e.departure_time ? ` · ${e.departure_time.slice(0, 5)}` : ""}{e.note ? ` · ${e.note}` : ""}
              </span>
              <form action={A.deleteException}><input type="hidden" name="id" value={e.id} /><Button type="submit" variant="ghost">Remove</Button></form>
            </li>
          ))}
          {!exceptions?.length ? <li className="py-2 text-ink-2">No upcoming changes.</li> : null}
        </ul>
        <form action={A.addException} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <input name="service_date" type="date" required min={today} aria-label="Date" className={input} />
          <select name="kind" aria-label="Change" className={input} defaultValue="no_service">
            <option value="no_service">No service</option>
            <option value="extra_run">Extra run</option>
            <option value="cancel_run">Cancel a departure</option>
            <option value="retime_run">Retime a departure</option>
          </select>
          <select name="route_id" aria-label="Route" className={input} defaultValue="">
            <option value="">All routes</option>
            {(routes ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select name="scheduled_run_id" aria-label="Departure" className={input} defaultValue="">
            <option value="">(departure)</option>
            {(sched ?? []).map((s) => <option key={s.id} value={s.id}>{DAYS[s.day_of_week]} {s.departure_time.slice(0, 5)} · {routeName(s.route_id)}</option>)}
          </select>
          <input name="departure_time" type="time" aria-label="New time" className={input} />
          <input name="note" placeholder="Note, e.g. Thanksgiving" aria-label="Note" className={`${input} col-span-2 sm:col-span-4`} />
          <Button type="submit" variant="secondary">Add</Button>
        </form>
      </Card>

      {ev ? (
        <Card className="flex flex-col gap-3">
          <h2 className="font-medium">Electric shuttle readiness</h2>
          <p className="text-sm text-ink-2">
            From {ev.stats.runs} logged runs (p90: {ev.stats.distance_km_p90} km, {ev.stats.duration_min_p90} min, {ev.stats.idle_min_p90} min idle)
            and the current timetable.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Per run", `${ev.kwh_per_run} kWh`, `${ev.kwh_per_run_winter} kWh in winter`],
              ["Worst day", `${ev.daily_kwh_winter} kWh`, `${ev.worst_day}, winter`],
              ["Battery needed", `${ev.required_battery_kwh} kWh`, `→ ${ev.recommended_pack_kwh} kWh pack`],
              ["Lowest charge", `${ev.min_soc_pct}%`, ev.feasible ? "stays above reserve" : "below reserve"],
            ].map(([k, v, n]) => (
              <div key={k} className="rounded-lg bg-surface-2 p-3">
                <p className="text-xs text-ink-2">{k}</p><p className="text-lg font-semibold tabular-nums">{v}</p><p className="text-xs text-ink-2">{n}</p>
              </div>
            ))}
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer">Blocks and charge windows</summary>
            <ul className="mt-2 list-disc pl-5">
              {ev.blocks.map((b, i) => <li key={i}>Block {i + 1}: {b.departures.join(", ")} — {b.kwh_winter} kWh (winter)</li>)}
            </ul>
            <ul className="mt-2 list-disc pl-5">
              {ev.charge_windows.map((w, i) => <li key={i}>{String(w.from)} → {String(w.to)}{w.kwh_possible != null ? `: up to ${w.kwh_possible} kWh at ${ev.assumptions.charger_kw} kW, next block needs ${w.kwh_needed_for_next_block} kWh` : ` overnight: ${w.kwh_needed} kWh`}</li>)}
            </ul>
            <p className="mt-2 text-xs text-ink-2">Assumptions: {Object.entries(ev.assumptions).map(([k, v]) => `${k.replaceAll("_", " ")} ${v}`).join(" · ")}</p>
          </details>
          {ev.notes.map((n) => <p key={n} className="text-sm text-warn">{n}</p>)}
        </Card>
      ) : null}

      <Card className="p-0">
        <h2 className="border-b border-line px-4 py-3 font-medium">Recent run metrics</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-ink-2"><tr><th className="px-4 py-2 text-left font-normal">Run</th><th className="font-normal">Distance</th><th className="font-normal">Duration</th><th className="font-normal">Idle</th><th className="font-normal">Stops</th><th className="pr-4 font-normal">Est. kWh</th></tr></thead>
            <tbody>
              {(metrics ?? []).map((m) => (
                <tr key={m.run_id} className="border-t border-line text-center tabular-nums">
                  <td className="px-4 py-2 text-left">{formatDay(m.created_at)} {formatTime(m.created_at)}</td>
                  <td>{Number(m.distance_km).toFixed(1)} km</td><td>{interval(m.duration)}</td><td>{interval(m.idle_time)}</td><td>{m.stop_count}</td><td className="pr-4">{m.est_energy_kwh ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
