import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Button, Card } from "@/components/ui";
import { describeRule, ruleSchema, type RuleInput } from "@/lib/rules";
import { deleteRule, toggleRule } from "@/lib/actions/rules";
import { RuleEditor } from "./rule-editor";
import { nowMs } from "@/lib/clock";

export const metadata: Metadata = { title: "Automation rules" };

export default async function RulesPage() {
  const me = await requireRole("staff");
  const admin = me.role === "admin";
  const supabase = await createClient();
  const [{ data: rules }, { data: rooms }, { data: fired }] = await Promise.all([
    supabase.from("automation_rules").select("*").order("priority"),
    supabase.from("rooms").select("slug, name").order("name"),
    supabase.from("control_commands").select("rule_id").eq("source", "rule").gte("created_at", new Date(nowMs() - 7 * 86400_000).toISOString()),
  ]);
  const counts = new Map<string, number>();
  for (const f of fired ?? []) if (f.rule_id) counts.set(f.rule_id, (counts.get(f.rule_id) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Automation rules</h1>
        <p className="mt-1 text-sm text-ink-2">Rules turn bookings, occupancy and the clock into lights and HVAC commands. Manual overrides in Rooms always win.{admin ? "" : " Only admins can edit rules."}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {(rules ?? []).map((r) => {
          const input = { name: r.name, description: r.description ?? undefined, priority: r.priority, enabled: r.enabled, trigger: r.trigger, conditions: r.conditions, actions: r.actions };
          const parsed = ruleSchema.safeParse(input);
          return (
            <li key={r.id}>
              <Card className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">{r.name}</h2>
                  <span className="flex gap-1">
                    {r.enabled ? <Badge tone="ok">On</Badge> : <Badge>Off</Badge>}
                    {!parsed.success ? <Badge tone="bad">Invalid</Badge> : null}
                    <Badge>{counts.get(r.id) ?? 0} commands this week</Badge>
                  </span>
                </div>
                <p className="text-sm">{parsed.success ? describeRule(parsed.data) : "This rule can't be read by the engine and is skipped."}</p>
                {r.description ? <p className="text-xs text-ink-2">{r.description}</p> : null}
                {admin ? (
                  <div className="flex flex-wrap gap-2">
                    <form action={toggleRule}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="enabled" value={String(!r.enabled)} /><Button type="submit" variant="secondary">{r.enabled ? "Turn off" : "Turn on"}</Button></form>
                    <form action={deleteRule}><input type="hidden" name="id" value={r.id} /><Button type="submit" variant="danger">Delete</Button></form>
                    {parsed.success ? (
                      <details className="w-full">
                        <summary className="cursor-pointer text-sm text-brand">Edit</summary>
                        <div className="mt-3"><RuleEditor id={r.id} initial={parsed.data as RuleInput} rooms={rooms ?? []} /></div>
                      </details>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
      {admin ? (
        <Card>
          <h2 className="mb-3 font-semibold">New rule</h2>
          <RuleEditor id={null} rooms={rooms ?? []} />
        </Card>
      ) : null}
    </div>
  );
}
