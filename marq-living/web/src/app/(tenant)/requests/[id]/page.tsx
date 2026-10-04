import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { TICKET_CATEGORY, TicketStatus } from "@/components/ticket-bits";
import { TicketThread } from "@/components/ticket-thread";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Request" };

export default async function RequestPage({ params }: PageProps<"/requests/[id]">) {
  const me = await requireRole("tenant");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: t } = await supabase.from("tickets").select("*").eq("id", id).maybeSingle();
  if (!t) notFound();
  const photo = t.photo_path ? (await supabase.storage.from("ticket-photos").createSignedUrl(t.photo_path, 600)).data?.signedUrl : null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold">{t.subject}</h1>
          <TicketStatus status={t.status} />
        </div>
        <p className="mt-1 text-xs text-ink-2">{TICKET_CATEGORY[t.category]} · Opened {formatDateTime(t.created_at)}</p>
        {t.description ? <p className="mt-3 whitespace-pre-line text-sm">{t.description}</p> : null}
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
        {photo ? <img src={photo} alt="Photo attached to this request" className="mt-3 max-h-72 rounded-lg border border-line object-contain" /> : null}
      </Card>
      <TicketThread ticketId={t.id} viewerId={me.id} staff={false} closed={t.status === "resolved"} />
    </div>
  );
}
