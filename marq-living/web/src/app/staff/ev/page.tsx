import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { analytics, type Forecast } from "@/lib/analytics";
import { ForecastChart } from "@/components/charts";
import { Badge, Button, Card, Notice } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { replanEv, runForecastNow } from "@/lib/actions/ev";
import { AutoRefresh } from "@/components/auto-refresh";

export const metadata: Metadata = { title: "EV & peak" };

export default async function StaffEv() {
  await requireRole("staff");
  const supabase = await createClient();
  const [{ data: sessions }, { data: chargers }, { data: people }, forecast] = await Promise.all([
    supabase.from("ev_sessions").select("*").in("status", ["requested", "scheduled", "charging", "paused"]).order("departure_time"),
    supabase.from("ev_chargers").select("*").order("label"),
    supabase.from("profiles").select("id, full_name, unit").eq("role", "tenant"),
    analytics<Forecast>("/forecast"),
  ]);
  const who = (id: string | null) => (id ? people?.find((p) => p.id === id) : null);

  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh seconds={30} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">EV charging & peak demand</h1>
        <div className="flex gap-2">
          <form action={replanEv}><Button type="submit" variant="secondary">Re-plan EV charging</Button></form>
          <form action={runForecastNow}><Button type="submit" variant="secondary">Run forecast now</Button></form>
        </div>
      </div>

      <Card>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">Building load forecast (excluding EV charging)</h2>
          <p className="text-xs text-ink-2">
            {forecast?.model ? `Model ${forecast.model}` : ""}{forecast?.mape_pct != null ? ` · ${forecast.mape_pct}% average error so far` : ""}
          </p>
        </div>
        {forecast ? <ForecastChart points={forecast.points} limit={forecast.limit_kw} /> : <Notice tone="warn">Analytics service not reachable.</Notice>}
      </Card>

      {forecast?.recommendations.length ? (
        <Card>
          <h2 className="mb-2 font-medium">Peak management</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {forecast.recommendations.slice(0, 8).map((r) => (
              <li key={r.t}>
                <strong>{r.label}</strong>: up to {r.forecast_upper_kw} kW forecast (limit {r.limit_kw} kW). {r.actions.join(" · ")}
              </li>
            ))}
          </ul>
        </Card>
      ) : forecast ? <Notice tone="ok">No intervals forecast near the peak limit.</Notice> : null}

      <Card className="p-0">
        <h2 className="border-b border-line px-4 py-3 font-medium">Active sessions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-ink-2"><tr><th className="px-4 py-2 text-left font-normal">Vehicle</th><th className="text-left font-normal">Charger</th><th className="text-right font-normal">kWh</th><th className="text-left font-normal">Leaves</th><th className="text-left font-normal">Ready by</th><th className="px-4 text-left font-normal">Status</th></tr></thead>
            <tbody>
              {(sessions ?? []).map((s) => {
                const p = who(s.tenant_id);
                const plan = (s.plan ?? {}) as { shortfall_kwh?: number };
                return (
                  <tr key={s.id} className="border-t border-line">
                    <td className="px-4 py-2">{p ? `${p.full_name} · ${p.unit}` : s.vehicle_label}</td>
                    <td>{chargers?.find((c) => c.id === s.charger_id)?.label ?? "Unassigned"}</td>
                    <td className="text-right tabular-nums">{Number(s.delivered_kwh).toFixed(1)} / {Number(s.requested_kwh).toFixed(1)}</td>
                    <td>{formatDateTime(s.departure_time)}</td>
                    <td>{s.est_complete_at ? formatDateTime(s.est_complete_at) : "—"}{plan.shortfall_kwh && plan.shortfall_kwh > 0.5 ? <span className="block text-xs text-warn">{plan.shortfall_kwh} kWh short</span> : null}</td>
                    <td className="px-4"><Badge tone={s.status === "charging" ? "ok" : "neutral"}>{s.status}</Badge></td>
                  </tr>
                );
              })}
              {!sessions?.length ? <tr><td colSpan={6} className="px-4 py-3 text-ink-2">No active sessions.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-ink-2">Chargers: {(chargers ?? []).map((c) => `${c.label} (${c.max_kw} kW${c.fleet_only ? ", shuttle" : ""})`).join(" · ")}</p>
    </div>
  );
}
