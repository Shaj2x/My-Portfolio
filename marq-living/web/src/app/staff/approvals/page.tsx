import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatAddress, formatDateTime } from "@/lib/format";
import { Button, Card } from "@/components/ui";
import { reviewAccount } from "../actions";

export const metadata: Metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  await requireRole("staff");
  const supabase = await createClient();
  const { data: pending, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, unit, room_letter, floor, phone, created_at")
    .eq("status", "pending")
    .eq("role", "tenant")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Approvals</h1>
        <p className="mt-1 text-sm text-ink-2">Check each sign-up against the lease before approving. Oldest first.</p>
      </div>
      {pending.length === 0 ? (
        <Card className="text-sm text-ink-2">No one is waiting. New sign-ups appear here.</Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((p) => (
            <li key={p.id}>
              <Card className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{p.full_name}</p>
                  <p className="text-sm text-ink-2 break-all">{p.email}</p>
                  <p className="mt-1 text-sm">
                    Unit <strong>{formatAddress(p)}</strong>
                  </p>
                  <p className="mt-1 text-xs text-ink-2">Signed up {formatDateTime(p.created_at)}</p>
                </div>
                <form action={reviewAccount} className="flex flex-col gap-2 sm:w-72">
                  <input type="hidden" name="id" value={p.id} />
                  <label className="sr-only" htmlFor={`note-${p.id}`}>
                    Note (shown to the tenant if rejected)
                  </label>
                  <input
                    id={`note-${p.id}`}
                    name="note"
                    placeholder="Note (optional)"
                    maxLength={500}
                    className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="submit" name="decision" value="rejected" variant="danger">
                      Reject
                    </Button>
                    <Button type="submit" name="decision" value="approved">
                      Approve
                    </Button>
                  </div>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
