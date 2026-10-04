import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button, Card } from "@/components/ui";
import { TICKET_CATEGORY, TicketStatus } from "@/components/ticket-bits";
import { TicketThread } from "@/components/ticket-thread";
import { formatAddress, formatDateTime } from "@/lib/format";
import { updateTicket } from "@/lib/actions/tickets";

export const metadata: Metadata = { title: "Ticket" };
const input = "min-h-11 rounded-lg border border-line bg-surface px-2 text-sm";

export default async function StaffTicket({ params }: PageProps<"/staff/tickets/[id]">) {
  const me = await requireRole("staff");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: t } = await supabase.from("tickets").select("*").eq("id", id).maybeSingle();
  if (!t) notFound();
  const [{ data: tenant }, { data: team }, { data: device }] = await Promise.all([
    t.tenant_id ? supabase.from("profiles").select("full_name, email, phone, unit, room_letter, floor").eq("id", t.tenant_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("profiles").select("id, full_name").in("role", ["staff", "admin"]).eq("status", "approved"),
    t.device_id ? supabase.from("devices").select("name, location, circuit, hardware_id").eq("id", t.device_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const photo = t.photo_path ? (await supabase.storage.from("ticket-photos").createSignedUrl(t.photo_path, 600)).data?.signedUrl : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="flex flex-col gap-4">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-semibold">{t.subject}</h1>
            <TicketStatus status={t.status} />
          </div>
          <p className="mt-1 text-xs text-ink-2">{TICKET_CATEGORY[t.category]} · {t.source} · opened {formatDateTime(t.created_at)}{t.resolved_at ? ` · resolved ${formatDateTime(t.resolved_at)}` : ""}</p>
          {t.description ? <p className="mt-3 whitespace-pre-line text-sm">{t.description}</p> : null}
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
          {photo ? <img src={photo} alt="Attached photo" className="mt-3 max-h-80 rounded-lg border border-line object-contain" /> : null}
        </Card>
        <TicketThread ticketId={t.id} viewerId={me.id} staff closed={t.status === "resolved"} />
      </div>
      <div className="flex flex-col gap-4">
        <Card>
          <form action={updateTicket} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={t.id} />
            <label className="flex flex-col gap-1 text-sm">Status
              <select name="status" defaultValue={t.status} className={input}>
                <option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">Priority
              <select name="priority" defaultValue={t.priority} className={input}>
                <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">Assigned to
              <select name="assignedTo" defaultValue={t.assigned_to ?? ""} className={input}>
                <option value="">Unassigned</option>
                {(team ?? []).map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </label>
            <Button type="submit">Save</Button>
          </form>
        </Card>
        {tenant ? (
          <Card className="text-sm">
            <p className="font-medium">{tenant.full_name}</p>
            <p className="text-ink-2">{formatAddress(tenant)}</p>
            <p className="break-all text-ink-2">{tenant.email}{tenant.phone ? ` · ${tenant.phone}` : ""}</p>
          </Card>
        ) : null}
        {device ? (
          <Card className="text-sm">
            <p className="font-medium">{device.name}</p>
            <p className="text-ink-2">{device.location}{device.circuit ? ` · ${device.circuit}` : ""}</p>
            <p className="font-mono text-xs text-ink-2">{device.hardware_id}</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
