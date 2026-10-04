import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { TICKET_CATEGORY, TicketStatus } from "@/components/ticket-bits";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Requests" };

export default async function RequestsPage() {
  await requireRole("tenant");
  const { data: tickets } = await (await createClient())
    .from("tickets").select("id, subject, category, status, updated_at").order("updated_at", { ascending: false }).limit(100);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Front desk</h1>
        <Link href="/requests/new" className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-ink">New request</Link>
      </div>
      {tickets?.length ? (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/requests/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{t.subject}</span>
                    <span className="text-xs text-ink-2">{TICKET_CATEGORY[t.category]} · {formatDateTime(t.updated_at)}</span>
                  </span>
                  <TicketStatus status={t.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="text-sm text-ink-2">No requests yet. Packages, maintenance, lockouts — send them here and keep a record.</Card>
      )}
    </div>
  );
}
