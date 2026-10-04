"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toggleLaundryWatch } from "@/lib/actions/laundry";
import { Badge, Button, Card } from "@/components/ui";
import { relativeMinutes } from "@/lib/format";

type Machine = { id: string; label: string; kind: "washer" | "dryer"; state: string; state_since: string; est_done_at: string | null };

const STATE = {
  idle: { label: "Free", tone: "ok" },
  running: { label: "In use", tone: "neutral" },
  finishing: { label: "Finishing soon", tone: "warn" },
  fault: { label: "Out of service", tone: "bad" },
  offline: { label: "No data", tone: "neutral" },
} as const;

// Availability comes from each machine's live power draw (CT clamps), so it
// updates by itself over Realtime.
export function LaundryLive({ initial, watching }: { initial: Machine[]; watching: string[] }) {
  const [machines, setMachines] = useState(initial);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("laundry")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "laundry_machines" }, (p) =>
        setMachines((ms) => ms.map((m) => (m.id === (p.new as Machine).id ? { ...m, ...(p.new as Machine) } : m))))
      .subscribe();
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(t);
    };
  }, []);

  if (!machines.length) return <Card className="text-sm text-ink-2">Laundry machines aren&apos;t connected yet.</Card>;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">Laundry</h1>
      {(["washer", "dryer"] as const).map((kind) => {
        const list = machines.filter((m) => m.kind === kind);
        const free = list.filter((m) => m.state === "idle").length;
        const on = watching.includes(kind);
        return (
          <section key={kind} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{kind === "washer" ? "Washers" : "Dryers"} <span className="text-sm font-normal text-ink-2">· {free} of {list.length} free</span></h2>
              {free === 0 || on ? (
                <form action={toggleLaundryWatch}>
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="on" value={String(!on)} />
                  <Button type="submit" variant={on ? "secondary" : "primary"}>{on ? "Stop notifying" : `Notify me when a ${kind} is free`}</Button>
                </form>
              ) : null}
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {list.map((m) => {
                const s = STATE[m.state as keyof typeof STATE] ?? STATE.offline;
                return (
                  <li key={m.id}>
                    <Card className="flex flex-col gap-1 p-4">
                      <p className="font-medium">{m.label}</p>
                      <Badge tone={s.tone}>{s.label}</Badge>
                      {(m.state === "running" || m.state === "finishing") && m.est_done_at ? (
                        <p className="text-xs text-ink-2">Done {relativeMinutes(m.est_done_at, now)}</p>
                      ) : null}
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
