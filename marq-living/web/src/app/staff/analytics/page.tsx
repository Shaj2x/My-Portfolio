import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { analytics, money, type Savings, type Summary } from "@/lib/analytics";
import { BarList } from "@/components/charts";
import { Card } from "@/components/ui";
import { TICKET_CATEGORY } from "@/components/ticket-bits";
import { nowMs } from "@/lib/clock";

export const metadata: Metadata = { title: "Analytics" };

const RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;
const monthFmt = new Intl.DateTimeFormat("en-CA", { month: "short", year: "numeric", timeZone: "America/Toronto" });

export default async function AnalyticsPage({ searchParams }: PageProps<"/staff/analytics">) {
  await requireRole("staff");
  const sp = await searchParams;
  const range = (typeof sp.range === "string" && sp.range in RANGES ? sp.range : "30d") as keyof typeof RANGES;
  const to = new Date(nowMs());
  const from = new Date(to.getTime() - RANGES[range] * 86400_000);
  const p = { p_from: from.toISOString(), p_to: to.toISOString() };
  const supabase = await createClient();

  // Last six calendar months for the cost/savings trend.
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(to.getFullYear(), to.getMonth() - 5 + i, 1);
    return { start: d, end: new Date(d.getFullYear(), d.getMonth() + 1, 1) };
  });

  const [tickets, shuttle, amenity, laundry, summary, savings, ...monthly] = await Promise.all([
    supabase.rpc("ticket_resolution_stats", p),
    supabase.rpc("shuttle_on_time_stats", p),
    supabase.rpc("amenity_usage", p),
    supabase.rpc("laundry_usage", p),
    analytics<Summary>("/energy/summary", { from: p.p_from, to: p.p_to }),
    analytics<Savings>("/energy/savings", { from: p.p_from, to: p.p_to }),
    ...months.map((m) => analytics<Summary>("/energy/summary", { from: m.start.toISOString(), to: (m.end < to ? m.end : to).toISOString() })),
  ]);
  const monthlySavings = await Promise.all(months.map((m) => analytics<Savings>("/energy/savings", { from: m.start.toISOString(), to: (m.end < to ? m.end : to).toISOString() })));
  const sh = shuttle.data?.[0];
  const t = tickets.data ?? [];
  const opened = t.reduce((a, r) => a + (r.opened ?? 0), 0);
  const resolved = t.reduce((a, r) => a + (r.resolved ?? 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <nav className="flex gap-2" aria-label="Range">
          {Object.keys(RANGES).map((r) => (
            <a key={r} href={`?range=${r}`} aria-current={r === range ? "page" : undefined}
              className="rounded-full border border-line px-3 py-1.5 text-sm aria-[current=page]:border-brand aria-[current=page]:bg-brand aria-[current=page]:text-brand-ink">Last {r}</a>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Shuttle on time", sh?.on_time_pct != null ? `${sh.on_time_pct}%` : "—", sh ? `${sh.on_time} of ${sh.scheduled} runs · ${sh.cancelled} cancelled` : ""],
          ["Requests resolved", `${resolved} of ${opened}`, t.length ? `median ${median(t.map((r) => Number(r.median_hours ?? 0)))} h to resolve` : ""],
          ["Energy cost", summary ? money(summary.total_cost) : "—", summary ? `${summary.total_kwh.toLocaleString("en-CA")} kWh · peak ${summary.peak_kw} kW` : "analytics offline"],
          ["Automation savings", savings ? money(savings.total_saved_cost) : "—", savings ? `${savings.total_saved_kwh} kWh · ${savings.carbon_avoided_kg} kg CO₂e avoided` : ""],
        ].map(([k, v, n]) => (
          <Card key={k} className="p-4"><p className="text-sm text-ink-2">{k}</p><p className="text-2xl font-semibold tabular-nums">{v}</p><p className="text-xs text-ink-2">{n}</p></Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-medium">Hours to resolve, by category (median)</h2>
          {t.length ? <BarList rows={t.map((r) => ({ label: TICKET_CATEGORY[r.category!] ?? r.category!, value: Number(r.median_hours ?? 0), note: `${r.resolved}/${r.opened}` }))} unit="h" /> : <p className="text-sm text-ink-2">No requests in this period.</p>}
        </Card>
        <Card>
          <h2 className="mb-3 font-medium">Amenity use</h2>
          {amenity.data?.length ? <BarList rows={amenity.data.map((a) => ({ label: a.amenity!, value: Number(a.hours ?? 0), note: `${a.bookings} bookings${Number(a.energy_kwh) ? ` · ${a.energy_kwh} kWh` : ""}` }))} unit="h" /> : null}
        </Card>
        <Card>
          <h2 className="mb-3 font-medium">Laundry cycles</h2>
          {laundry.data?.length ? <BarList rows={laundry.data.map((l) => ({ label: l.label!, value: l.cycles ?? 0 }))} unit="cycles" format={(v) => v.toFixed(0)} /> : <p className="text-sm text-ink-2">No laundry data.</p>}
        </Card>
        <Card>
          <h2 className="mb-3 font-medium">Energy by system</h2>
          {summary ? <BarList rows={summary.by_system.map((s) => ({ label: s.name, value: s.kwh, note: money(s.cost) }))} unit="kWh" /> : <p className="text-sm text-ink-2">Analytics service not reachable.</p>}
        </Card>
      </div>

      <Card className="p-0">
        <h2 className="border-b border-line px-4 py-3 font-medium">Monthly cost and savings</h2>
        <table className="w-full text-sm tabular-nums">
          <thead className="text-ink-2"><tr><th className="px-4 py-2 text-left font-normal">Month</th><th className="text-right font-normal">Energy</th><th className="text-right font-normal">Cost</th><th className="text-right font-normal">Peak</th><th className="text-right font-normal">Saved by automation</th><th className="px-4 text-right font-normal">Carbon</th></tr></thead>
          <tbody>
            {months.map((m, i) => {
              const s = monthly[i] as Summary | null;
              const sv = monthlySavings[i];
              return (
                <tr key={i} className="border-t border-line">
                  <td className="px-4 py-2">{monthFmt.format(m.start)}</td>
                  <td className="text-right">{s ? `${s.total_kwh.toLocaleString("en-CA")} kWh` : "—"}</td>
                  <td className="text-right">{s ? money(s.total_cost) : "—"}</td>
                  <td className="text-right">{s ? `${s.peak_kw} kW` : "—"}</td>
                  <td className="text-right">{sv ? money(sv.total_saved_cost) : "—"}</td>
                  <td className="px-4 text-right">{s ? `${s.carbon_kg} kg` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-4 py-3 text-xs text-ink-2">Costs use Ontario {summary?.plan?.toUpperCase() ?? "ULO"} energy prices (no delivery or regulatory charges). Carbon at 30 g CO₂e/kWh (Ontario grid average). Savings compare automated rooms with their old always-on draw.</p>
      </Card>
    </div>
  );
}

function median(xs: number[]) {
  const v = xs.filter((x) => x > 0).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)].toFixed(1) : "—";
}
