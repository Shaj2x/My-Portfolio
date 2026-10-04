import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card } from "@/components/ui";
import { TICKET_CATEGORY, TicketStatus } from "@/components/ticket-bits";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Tickets" };

const FILTERS = [["open", "Open"], ["in_progress", "In progress"], ["resolved", "Resolved"], ["all", "All"]] as const;

export default async function StaffTickets({ searchParams }: PageProps<"/staff/tickets">) {
  await requireRole("staff");
  const sp = await searchParams;
  const status = FILTERS.some(([k]) => k === sp.status) ? (sp.status as string) : "open";
  const supabase = await createClient();
  let q = supabase.from("tickets").select("id, subject, category, status, priority, unit, source, created_at, updated_at, assigned_to").order("updated_at", { ascending: false }).limit(200);
  if (status !== "all") q = q.eq("status", status as "open");
  const { data: tickets } = await q;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Tickets</h1>
      <nav className="flex gap-2" aria-label="Status">
        {FILTERS.map(([k, label]) => (
          <a key={k} href={`?status=${k}`} aria-current={k === status ? "page" : undefined}
            className="rounded-full border border-line px-3 py-1.5 text-sm aria-[current=page]:border-brand aria-[current=page]:bg-brand aria-[current=page]:text-brand-ink">{label}</a>
        ))}
      </nav>
      <Card className="p-0">
        <ul className="divide-y divide-line">
          {(tickets ?? []).map((t) => (
            <li key={t.id}>
              <Link href={`/staff/tickets/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                <span className="min-w-0">
                  <span className="block font-medium">{t.subject}</span>
                  <span className="text-xs text-ink-2">
                    {TICKET_CATEGORY[t.category]} · {t.unit ? `Unit ${t.unit}` : "Building"} · {formatDateTime(t.created_at)}
                  </span>
                </span>
                <span className="flex gap-1">
                  {t.source === "system" ? <Badge tone="brand">Auto</Badge> : null}
                  {t.priority === "high" || t.priority === "urgent" ? <Badge tone="bad">{t.priority}</Badge> : null}
                  <TicketStatus status={t.status} />
                </span>
              </Link>
            </li>
          ))}
          {!tickets?.length ? <li className="px-4 py-3 text-sm text-ink-2">Nothing here.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
