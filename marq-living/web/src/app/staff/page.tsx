import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffOverview() {
  await requireRole("staff");
  const supabase = await createClient();
  const count = async (status: "pending" | "approved", role?: "tenant") => {
    let q = supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", status);
    if (role) q = q.eq("role", role);
    const { count } = await q;
    return count ?? 0;
  };
  const [pending, tenants] = await Promise.all([count("pending"), count("approved", "tenant")]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-ink-2">Waiting for approval</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{pending}</p>
          {pending > 0 ? (
            <Link href="/staff/approvals" className="mt-2 inline-block text-sm font-medium text-brand hover:underline">
              Review now
            </Link>
          ) : null}
        </Card>
        <Card>
          <p className="text-sm text-ink-2">Approved tenants</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{tenants}</p>
        </Card>
      </div>
      <p className="text-sm text-ink-2">
        Shuttle, tickets, bookings and the live operations view are added here as each stage ships.
      </p>
    </div>
  );
}
