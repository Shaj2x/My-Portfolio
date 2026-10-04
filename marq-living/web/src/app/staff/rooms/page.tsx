import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Button, Card } from "@/components/ui";
import { formatDateTime, formatTime, relativeMinutes } from "@/lib/format";
import { setRoomOverride } from "@/lib/actions/rooms";
import { nowMs } from "@/lib/clock";
import { AutoRefresh } from "@/components/auto-refresh";

export const metadata: Metadata = { title: "Rooms" };

type RoomState = { lights?: string; hvac_mode?: string; occupied?: boolean; last_motion?: string; updated_at?: string };

const SOURCE: Record<string, string> = { user: "Staff", rule: "Rule", schedule: "Schedule", scheduler: "Scheduler", failsafe: "Fail-safe", system: "System" };

export default async function RoomsPage() {
  await requireRole("staff");
  const supabase = await createClient();
  const [{ data: rooms }, { data: commands }, { data: people }, { data: rules }, { data: devices }] = await Promise.all([
    supabase.from("rooms").select("*").order("name"),
    supabase.from("control_commands").select("*").order("id", { ascending: false }).limit(40),
    supabase.from("profiles").select("id, full_name").in("role", ["staff", "admin"]),
    supabase.from("automation_rules").select("id, name"),
    supabase.from("devices").select("id, name"),
  ]);
  const now = nowMs();
  const who = (c: { source: string; user_id: string | null; rule_id: string | null }) =>
    c.source === "user" ? people?.find((p) => p.id === c.user_id)?.full_name ?? "Staff"
      : c.source === "rule" ? rules?.find((r) => r.id === c.rule_id)?.name ?? "Rule" : SOURCE[c.source];

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh seconds={15} />
      <h1 className="text-2xl font-semibold">Rooms</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {(rooms ?? []).map((r) => {
          const st = (r.state ?? {}) as RoomState;
          const occupied = st.last_motion ? now - new Date(st.last_motion).getTime() < 10 * 60_000 : false;
          return (
            <Card key={r.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{r.name}</h2>
                {r.override_mode === "auto" ? <Badge tone="ok">Automatic</Badge> : (
                  <Badge tone="warn">Manual: {r.override_mode === "force_on" ? "on" : "off"}{r.override_until ? ` until ${formatTime(r.override_until)}` : ""}</Badge>
                )}
              </div>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-ink-2">Lights</dt><dd className="font-medium">{st.lights ?? "—"}</dd></div>
                <div><dt className="text-ink-2">HVAC</dt><dd className="font-medium">{st.hvac_mode ?? "—"}</dd></div>
                <div><dt className="text-ink-2">Occupancy</dt><dd className="font-medium">{occupied ? "Occupied" : "Empty"}</dd></div>
              </dl>
              <p className="text-xs text-ink-2">
                {st.last_motion ? `Last motion ${formatDateTime(st.last_motion)}` : "No motion recorded"} · Baseline {r.baseline_kw ?? "?"} kW always-on
              </p>
              <div className="flex flex-wrap gap-2">
                {([["force_on", "Force on (2 h)", "secondary"], ["force_off", "Force off (2 h)", "danger"]] as const).map(([mode, label, variant]) => (
                  <form key={mode} action={setRoomOverride}>
                    <input type="hidden" name="room" value={r.slug} />
                    <input type="hidden" name="mode" value={mode} />
                    <input type="hidden" name="minutes" value="120" />
                    <Button type="submit" variant={variant}>{label}</Button>
                  </form>
                ))}
                {r.override_mode !== "auto" ? (
                  <form action={setRoomOverride}>
                    <input type="hidden" name="room" value={r.slug} />
                    <input type="hidden" name="mode" value="auto" />
                    <Button type="submit">Back to automatic</Button>
                  </form>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-0">
        <h2 className="border-b border-line px-4 py-3 font-medium">Command log</h2>
        <p className="px-4 pt-2 text-xs text-ink-2">Every physical action, with who or what triggered it. If the system goes offline, room nodes return to lights on and HVAC normal.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-ink-2"><tr><th className="px-4 py-2 text-left font-normal">When</th><th className="text-left font-normal">Device</th><th className="text-left font-normal">Command</th><th className="text-left font-normal">By</th><th className="px-4 text-left font-normal">Status</th></tr></thead>
            <tbody>
              {(commands ?? []).map((c) => (
                <tr key={c.id} className="border-t border-line align-top">
                  <td className="whitespace-nowrap px-4 py-2">{relativeMinutes(c.created_at, now) === "now" ? formatTime(c.created_at) : formatDateTime(c.created_at)}</td>
                  <td>{devices?.find((d) => d.id === c.device_id)?.name ?? "—"}</td>
                  <td className="font-mono text-xs">{JSON.stringify(c.command)}</td>
                  <td>{who(c)}{c.reason ? <span className="block text-xs text-ink-2">{c.reason}</span> : null}</td>
                  <td className="px-4"><Badge tone={c.status === "acked" ? "ok" : c.status === "failed" || c.status === "expired" ? "bad" : "neutral"}>{c.status}</Badge>{c.error ? <span className="block text-xs text-bad">{c.error}</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
