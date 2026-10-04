import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { analytics, money, PERIOD_LABEL, SYSTEM_ORDER, SYSTEM_SLOT, type Live, type Savings, type Series, type Summary } from "@/lib/analytics";
import { BarList, Meter, StackedArea } from "@/components/charts";
import { Card, Notice } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { nowMs } from "@/lib/clock";

export const metadata: Metadata = { title: "Energy" };

const RANGES = { "24h": 1, "7d": 7, "30d": 30 } as const;

export default async function EnergyPage({ searchParams }: PageProps<"/staff/energy">) {
  await requireRole("staff");
  const sp = await searchParams;
  const range = (typeof sp.range === "string" && sp.range in RANGES ? sp.range : "24h") as keyof typeof RANGES;
  const to = new Date(nowMs());
  const from = new Date(to.getTime() - RANGES[range] * 86400_000);
  const q = { from: from.toISOString(), to: to.toISOString() };
  const [live, series, summary, savings] = await Promise.all([
    analytics<Live>("/energy/live"),
    analytics<Series>("/energy/series", { from: new Date(to.getTime() - Math.min(RANGES[range], 7) * 86400_000).toISOString(), to: q.to }),
    analytics<Summary>("/energy/summary", q),
    analytics<Savings>("/energy/savings", q),
  ]);

  if (!live && !summary) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Energy</h1>
        <Notice tone="warn">The analytics service isn&apos;t reachable. Check ANALYTICS_URL and that the building stack is running (infra/docker-compose.yml).</Notice>
      </div>
    );
  }

  const systems = (series?.systems ?? []).sort((a, b) => SYSTEM_ORDER.indexOf(a.system) - SYSTEM_ORDER.indexOf(b.system))
    .map((s) => ({ key: s.system, name: s.name, color: SYSTEM_SLOT[s.system] ?? "var(--ink-2)" }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Energy</h1>
        <nav className="flex gap-2" aria-label="Range">
          {Object.keys(RANGES).map((r) => (
            <a key={r} href={`?range=${r}`} aria-current={r === range ? "page" : undefined}
              className="rounded-full border border-line px-3 py-1.5 text-sm aria-[current=page]:border-brand aria-[current=page]:bg-brand aria-[current=page]:text-brand-ink">
              Last {r}
            </a>
          ))}
        </nav>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <Card>
          <h2 className="mb-2 text-sm text-ink-2">Shared systems now</h2>
          {live ? <Meter value={live.total_kw} limit={live.peak_limit_kw} unit="kW" /> : <p className="text-sm text-ink-2">No live data.</p>}
          {live ? <p className="mt-2 text-xs text-ink-2">Updated {formatDateTime(live.as_of)}</p> : null}
        </Card>
        <Card>
          <h2 className="mb-3 text-sm text-ink-2">By system now</h2>
          {live?.systems.length ? (
            <BarList rows={live.systems.map((s) => ({ label: s.name, value: s.kw }))} unit="kW" format={(v) => v.toFixed(2)} />
          ) : <p className="text-sm text-ink-2">No devices reporting in the last 10 minutes.</p>}
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 font-medium">Load by system{range !== "24h" ? " (last 7 days)" : ""}</h2>
        <StackedArea points={series?.points ?? []} series={systems}
          limit={live?.peak_limit_kw ? { value: live.peak_limit_kw, label: `Peak limit ${live.peak_limit_kw} kW` } : null} />
      </Card>

      {summary ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["Energy", `${summary.total_kwh.toLocaleString("en-CA")} kWh`],
            ["Cost", money(summary.total_cost)],
            ["Peak demand", `${summary.peak_kw} kW`, summary.peak_at ? formatDateTime(summary.peak_at) : ""],
            ["Carbon", `${summary.carbon_kg.toLocaleString("en-CA")} kg CO₂e`],
          ].map(([label, value, note]) => (
            <Card key={label} className="p-4">
              <p className="text-sm text-ink-2">{label}</p>
              <p className="text-2xl font-semibold tabular-nums">{value}</p>
              {note ? <p className="text-xs text-ink-2">{note}</p> : null}
            </Card>
          ))}
        </div>
      ) : null}

      {summary ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h2 className="mb-3 font-medium">Energy by system</h2>
            <BarList rows={summary.by_system.map((s) => ({ label: s.name, value: s.kwh, note: money(s.cost) }))} unit="kWh" />
          </Card>
          <Card>
            <h2 className="mb-3 font-medium">Cost by price period ({summary.plan.toUpperCase()})</h2>
            <BarList rows={summary.by_period.map((p) => ({ label: PERIOD_LABEL[p.period] ?? p.period, value: p.cost, note: `${p.kwh} kWh @ ${p.cents_per_kwh}¢` }))}
              unit="" format={money} />
          </Card>
        </div>
      ) : null}

      {savings?.rooms.length ? (
        <Card className="p-0">
          <h2 className="border-b border-line px-4 py-3 font-medium">Room automation savings vs. always-on</h2>
          <table className="w-full text-sm tabular-nums">
            <thead className="text-ink-2"><tr><th className="px-4 py-2 text-left font-normal">Room</th><th className="text-right font-normal">Always-on</th><th className="text-right font-normal">Actual</th><th className="text-right font-normal">Saved</th><th className="px-4 text-right font-normal">Cost saved</th></tr></thead>
            <tbody>
              {savings.rooms.map((r) => (
                <tr key={r.room} className="border-t border-line">
                  <td className="px-4 py-2">{r.name}</td><td className="text-right">{r.baseline_kwh} kWh</td><td className="text-right">{r.actual_kwh} kWh</td>
                  <td className="text-right font-semibold">{r.saved_pct}%</td><td className="px-4 text-right">{money(r.saved_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-3 text-sm text-ink-2">
            {savings.total_saved_kwh} kWh and {money(savings.total_saved_cost)} saved · {savings.carbon_avoided_kg} kg CO₂e avoided
          </p>
        </Card>
      ) : null}

      {live?.channels.length ? (
        <Card className="p-0">
          <h2 className="border-b border-line px-4 py-3 font-medium">Circuits</h2>
          <ul className="divide-y divide-line text-sm">
            {live.channels.map((c) => (
              <li key={`${c.device_id}-${c.channel}`} className="flex justify-between gap-3 px-4 py-2">
                <span>{c.label} <span className="text-xs text-ink-2">· {c.device}</span></span>
                <span className="tabular-nums"><strong>{(c.kw * 1000).toFixed(0)} W</strong> <span className="text-ink-2">{c.current_a} A</span></span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
