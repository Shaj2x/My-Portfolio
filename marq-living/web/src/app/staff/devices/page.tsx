import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Button, Card } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { acknowledgeEvent, retireDevice } from "@/lib/actions/devices";
import { DeviceForm } from "./device-form";
import { nowMs } from "@/lib/clock";
import { AutoRefresh } from "@/components/auto-refresh";

export const metadata: Metadata = { title: "Devices" };

const TONE = { online: "ok", offline: "bad", fault: "bad", provisioning: "neutral", retired: "neutral" } as const;

function ago(iso: string | null, now: number) {
  if (!iso) return "never";
  const m = Math.round((now - new Date(iso).getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : formatDateTime(iso);
}

export default async function DevicesPage() {
  const me = await requireRole("staff");
  const admin = me.role === "admin";
  const supabase = await createClient();
  const [{ data: devices }, { data: rooms }, { data: events }, { data: health }] = await Promise.all([
    supabase.from("devices").select("*").neq("status", "retired").order("location").order("name"),
    supabase.from("rooms").select("id, name"),
    supabase.from("device_events").select("*").in("type", ["fault", "anomaly", "offline", "override"]).is("acknowledged_at", null).order("occurred_at", { ascending: false }).limit(20),
    supabase.rpc("device_health"),
  ]);
  const h = health?.[0];
  const now = nowMs();

  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh seconds={30} />
      <h1 className="text-2xl font-semibold">Devices</h1>
      {h ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[["Online", h.online, "ok"], ["Offline", h.offline, h.offline ? "bad" : "neutral"], ["Fault", h.fault, h.fault ? "bad" : "neutral"],
            ["Low battery", h.low_battery, h.low_battery ? "warn" : "neutral"], ["Old firmware", h.stale_firmware, h.stale_firmware ? "warn" : "neutral"]].map(([k, v, tone]) => (
            <Card key={String(k)} className="p-3">
              <p className="text-xs text-ink-2">{k}</p>
              <p className="text-2xl font-semibold tabular-nums">{v as number} <span className="text-sm">{tone === "bad" && Number(v) > 0 ? "⚠" : ""}</span></p>
            </Card>
          ))}
        </div>
      ) : null}

      {events?.length ? (
        <Card className="p-0">
          <h2 className="border-b border-line px-4 py-3 font-medium">Needs attention</h2>
          <ul className="divide-y divide-line text-sm">
            {events.map((e) => {
              const d = devices?.find((x) => x.id === e.device_id);
              const p = (e.payload ?? {}) as { message?: string };
              return (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                  <span><Badge tone={e.type === "override" ? "warn" : "bad"}>{e.type}</Badge> <strong>{d?.name}</strong> · {p.message ?? ""} <span className="text-xs text-ink-2">{formatDateTime(e.occurred_at)}</span></span>
                  <form action={acknowledgeEvent}><input type="hidden" name="id" value={e.id} /><Button type="submit" variant="ghost">Acknowledge</Button></form>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-ink-2"><tr><th className="px-4 py-2 text-left font-normal">Device</th><th className="text-left font-normal">Where</th><th className="text-left font-normal">Last check-in</th><th className="text-left font-normal">Firmware</th><th className="text-left font-normal">Signal / battery</th><th className="px-4 text-left font-normal">Status</th></tr></thead>
            <tbody>
              {(devices ?? []).map((d) => (
                <tr key={d.id} className="border-t border-line align-top">
                  <td className="px-4 py-2">
                    <span className="font-medium">{d.name}</span>{d.simulated ? <span className="ml-1 text-xs text-ink-2">(simulated)</span> : null}
                    <span className="block font-mono text-xs text-ink-2">{d.hardware_id} · {d.type}</span>
                    {admin ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-brand">Edit / calibrate</summary>
                        <div className="mt-2 w-[min(40rem,80vw)]"><DeviceForm device={d} rooms={rooms ?? []} /></div>
                        <form action={retireDevice} className="mt-2"><input type="hidden" name="id" value={d.id} /><Button type="submit" variant="danger">Retire</Button></form>
                      </details>
                    ) : null}
                  </td>
                  <td>{d.location}<span className="block text-xs text-ink-2">{d.circuit ?? ""}</span></td>
                  <td>{ago(d.last_seen, now)}</td>
                  <td className="font-mono text-xs">{d.firmware_version ?? "—"}</td>
                  <td className="text-xs">{d.rssi_dbm != null ? `${d.rssi_dbm} dBm` : "—"}{d.battery_pct != null ? ` · ${d.battery_pct}%` : ""}</td>
                  <td className="px-4"><Badge tone={TONE[d.status]}>{d.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {admin ? (
        <Card>
          <h2 className="mb-3 font-semibold">Register a device</h2>
          <DeviceForm rooms={rooms ?? []} />
        </Card>
      ) : null}
    </div>
  );
}
