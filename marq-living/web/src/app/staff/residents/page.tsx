import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatAddress } from "@/lib/format";
import { Badge, Button, Card } from "@/components/ui";
import { reviewAccount } from "../actions";

export const metadata: Metadata = { title: "Residents" };

export default async function ResidentsPage({ searchParams }: PageProps<"/staff/residents">) {
  await requireRole("staff");
  const { q: rawQ, floor: rawFloor } = await searchParams;
  const q = typeof rawQ === "string" ? rawQ.trim() : "";
  const floor = typeof rawFloor === "string" && /^\d{1,2}$/.test(rawFloor) ? Number(rawFloor) : null;

  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, full_name, email, unit, room_letter, floor, status, review_note")
    .eq("role", "tenant")
    .in("status", ["approved", "suspended", "rejected"])
    .order("unit")
    .order("room_letter")
    .limit(200);
  if (floor) query = query.eq("floor", floor);
  if (q) {
    // Strip PostgREST filter syntax characters before building the or() filter.
    const safe = q.replace(/[%,().*\\]/g, " ").trim();
    if (safe) query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,unit.ilike.${safe}%`);
  }
  const { data: residents, error } = await query;
  if (error) throw new Error(error.message);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Residents</h1>
      <form className="flex flex-wrap gap-2" role="search">
        <label className="sr-only" htmlFor="q">
          Search
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Name, email or unit"
          className="min-h-11 flex-1 rounded-lg border border-line bg-surface px-3 text-sm"
        />
        <label className="sr-only" htmlFor="floor">
          Floor
        </label>
        <input
          id="floor"
          name="floor"
          type="number"
          min={1}
          max={40}
          defaultValue={floor ?? ""}
          placeholder="Floor"
          className="min-h-11 w-24 rounded-lg border border-line bg-surface px-3 text-sm"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {residents.length === 0 ? (
        <Card className="text-sm text-ink-2">No residents match.</Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {residents.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {r.full_name}{" "}
                    {r.status !== "approved" ? <Badge tone="bad">{r.status}</Badge> : null}
                  </p>
                  <p className="text-sm text-ink-2">
                    {formatAddress(r)} · <span className="break-all">{r.email}</span>
                  </p>
                </div>
                <form action={reviewAccount}>
                  <input type="hidden" name="id" value={r.id} />
                  {r.status === "approved" ? (
                    <Button type="submit" name="decision" value="suspended" variant="danger">
                      Suspend
                    </Button>
                  ) : (
                    <Button type="submit" name="decision" value="approved" variant="secondary">
                      {r.status === "rejected" ? "Approve" : "Reinstate"}
                    </Button>
                  )}
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
