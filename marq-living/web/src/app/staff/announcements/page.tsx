import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Button, Card } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { deleteAnnouncement } from "@/lib/actions/announcements";
import { ComposeForm } from "./compose-form";
import { nowMs } from "@/lib/clock";

export const metadata: Metadata = { title: "Announcements" };

export default async function StaffAnnouncements() {
  await requireRole("staff");
  const supabase = await createClient();
  const [{ data: posts }, { data: stats }] = await Promise.all([
    supabase.from("announcements").select("*").order("publish_at", { ascending: false }).limit(50),
    supabase.rpc("announcement_stats"),
  ]);
  const stat = new Map((stats ?? []).map((s) => [s.announcement_id, s]));
  const now = nowMs();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Announcements</h1>
      <Card><ComposeForm /></Card>
      <ul className="flex flex-col gap-3">
        {(posts ?? []).map((p) => {
          const s = stat.get(p.id);
          const scheduled = new Date(p.publish_at).getTime() > now;
          const pct = s && s.audience_size ? Math.round((100 * (s.read_count ?? 0)) / s.audience_size) : 0;
          return (
            <li key={p.id}>
              <Card className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{p.category}</Badge>
                  {p.urgent ? <Badge tone="bad">Urgent</Badge> : null}
                  {scheduled ? <Badge tone="warn">Scheduled {formatDateTime(p.publish_at)}</Badge> : null}
                  {p.source === "system" ? <Badge tone="brand">Automatic</Badge> : null}
                  <span className="text-xs text-ink-2">
                    {p.audience === "building" ? "Whole building" : p.audience === "floors" ? `Floors ${p.target_floors.join(", ")}` : `Units ${p.target_units.join(", ")}`}
                  </span>
                </div>
                <h2 className="font-semibold">{p.title}</h2>
                <p className="line-clamp-2 text-sm text-ink-2">{p.body}</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-ink-2">
                    {formatDateTime(p.publish_at)} · Read by {s?.read_count ?? 0} of {s?.audience_size ?? 0} ({pct}%)
                  </span>
                  <form action={deleteAnnouncement}><input type="hidden" name="id" value={p.id} /><Button type="submit" variant="ghost">Delete</Button></form>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
