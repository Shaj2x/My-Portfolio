import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Button, Card } from "@/components/ui";
import { formatDateTime, localDate } from "@/lib/format";
import { nextDay } from "@/lib/booking";
import { cancelCharge } from "@/lib/actions/ev";
import { RequestForm } from "./request-form";

export const metadata: Metadata = { title: "EV charging" };

const STATUS: Record<string, { label: string; tone: "neutral" | "ok" | "warn" | "bad" }> = {
  requested: { label: "Requested", tone: "neutral" }, scheduled: { label: "Scheduled", tone: "neutral" },
  charging: { label: "Charging", tone: "ok" }, paused: { label: "Waiting for cheaper power", tone: "neutral" },
  completed: { label: "Done", tone: "ok" }, cancelled: { label: "Cancelled", tone: "neutral" }, faulted: { label: "Charger fault", tone: "bad" },
};

export default async function EvPage() {
  await requireRole("tenant");
  const supabase = await createClient();
  const [{ data: sessions }, { data: chargers }] = await Promise.all([
    supabase.from("ev_sessions").select("*").order("created_at", { ascending: false }).limit(10),
    supabase.rpc("ev_charger_status"),
  ]);
  const active = (sessions ?? []).find((s) => ["requested", "scheduled", "charging", "paused"].includes(s.status));
  const plan = (active?.plan ?? null) as { slots?: { start: string; end: string; kw: number }[]; shortfall_kwh?: number } | null;
  const free = (chargers ?? []).filter((c) => !c.busy).length;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">EV charging</h1>
      <p className="text-sm text-ink-2">
        {free} of {chargers?.length ?? 0} parking-level chargers free. Charging is scheduled into the cheapest overnight hours
        while keeping the building under its power limit, and finishes before you leave.
      </p>
      {active ? (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">{active.vehicle_label || "Your car"}</h2>
            <Badge tone={STATUS[active.status].tone}>{STATUS[active.status].label}</Badge>
          </div>
          <div>
            <div className="flex justify-between text-sm"><span>{Number(active.delivered_kwh).toFixed(1)} of {Number(active.requested_kwh).toFixed(1)} kWh</span><span className="text-ink-2">Leaving {formatDateTime(active.departure_time)}</span></div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={Number(active.requested_kwh)} aria-valuenow={Number(active.delivered_kwh)}>
              <div className="h-full rounded-full bg-ok" style={{ width: `${Math.min(100, (Number(active.delivered_kwh) / Number(active.requested_kwh)) * 100)}%` }} />
            </div>
          </div>
          {active.est_complete_at ? (
            <p className="text-lg font-semibold">Ready by {formatDateTime(active.est_complete_at)}</p>
          ) : (
            <p className="text-sm text-ink-2">Working out the best charging time…</p>
          )}
          {plan?.slots?.length ? <p className="text-sm text-ink-2">Charging starts {formatDateTime(plan.slots[0].start)}.</p> : null}
          {plan?.shortfall_kwh && plan.shortfall_kwh > 0.5 ? (
            <p className="text-sm text-warn">The building is busy: we can add about {(Number(active.requested_kwh) - plan.shortfall_kwh).toFixed(0)} kWh before you leave.</p>
          ) : null}
          <form action={cancelCharge}>
            <input type="hidden" name="id" value={active.id} />
            <Button type="submit" variant="danger">Cancel request</Button>
          </form>
        </Card>
      ) : (
        <Card><RequestForm defaultDate={nextDay(localDate())} /></Card>
      )}
      {(sessions ?? []).filter((s) => s.id !== active?.id).length ? (
        <Card className="p-0">
          <h2 className="border-b border-line px-4 py-3 font-medium">Past sessions</h2>
          <ul className="divide-y divide-line text-sm">
            {(sessions ?? []).filter((s) => s.id !== active?.id).map((s) => (
              <li key={s.id} className="flex justify-between px-4 py-2">
                <span>{formatDateTime(s.created_at)}</span>
                <span className="tabular-nums">{Number(s.delivered_kwh).toFixed(1)} kWh · {STATUS[s.status].label}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
