import { createClient } from "@/lib/supabase/server";
import { Badge, Card } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { ReplyForm } from "./reply-form";

// Shared by the tenant and staff ticket pages. RLS decides which messages
// (internal notes) each viewer gets.
export async function TicketThread({ ticketId, viewerId, staff, closed }: { ticketId: string; viewerId: string; staff: boolean; closed: boolean }) {
  const supabase = await createClient();
  const { data: messages } = await supabase
    .from("ticket_messages").select("id, author_id, body, internal, created_at").eq("ticket_id", ticketId).order("created_at");
  const authorIds = [...new Set((messages ?? []).map((m) => m.author_id).filter(Boolean))] as string[];
  const { data: authors } = staff && authorIds.length
    ? await supabase.from("profiles").select("id, full_name, role").in("id", authorIds)
    : { data: [] };
  const name = (id: string | null) => {
    if (!id) return "System";
    if (id === viewerId) return "You";
    const a = authors?.find((x) => x.id === id);
    return a ? a.full_name : "Front desk";
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {(messages ?? []).map((m) => (
          <li key={m.id} className={m.author_id === viewerId ? "ml-8" : "mr-8"}>
            <Card className={`p-3 ${m.internal ? "border-dashed bg-warn-bg" : ""}`}>
              <p className="flex items-center gap-2 text-xs text-ink-2">
                <span className="font-medium text-ink">{name(m.author_id)}</span> {formatDateTime(m.created_at)}
                {m.internal ? <Badge tone="warn">Internal</Badge> : null}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm">{m.body}</p>
            </Card>
          </li>
        ))}
      </ul>
      {closed && !staff ? (
        <p className="text-sm text-ink-2">This request is resolved. If it isn&apos;t fixed, open a new request.</p>
      ) : (
        <ReplyForm ticketId={ticketId} staff={staff} />
      )}
    </div>
  );
}
