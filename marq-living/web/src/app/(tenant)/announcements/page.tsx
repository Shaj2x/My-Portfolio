import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { MarkRead } from "./mark-read";

export const metadata: Metadata = { title: "Announcements" };

const CATEGORY: Record<string, { label: string; tone: "neutral" | "warn" | "bad" | "ok" }> = {
  maintenance: { label: "Maintenance", tone: "warn" },
  events: { label: "Event", tone: "ok" },
  safety: { label: "Safety", tone: "bad" },
  general: { label: "General", tone: "neutral" },
};

export default async function AnnouncementsPage({ searchParams }: PageProps<"/announcements">) {
  await requireRole("tenant");
  const { category } = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("announcements").select("id, title, body, category, urgent, publish_at, source, audience").order("publish_at", { ascending: false }).limit(50);
  if (typeof category === "string" && category in CATEGORY) q = q.eq("category", category as "maintenance");
  const [{ data: posts }, { data: reads }] = await Promise.all([q, supabase.from("announcement_reads").select("announcement_id")]);
  const read = new Set((reads ?? []).map((r) => r.announcement_id));
  const unreadIds = (posts ?? []).filter((p) => !read.has(p.id)).map((p) => p.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Announcements</h1>
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4" aria-label="Filter">
        {[["", "All"], ...Object.entries(CATEGORY).map(([k, v]) => [k, v.label])].map(([k, label]) => (
          <a key={k} href={k ? `?category=${k}` : "?"} aria-current={(category ?? "") === k ? "page" : undefined}
            className="whitespace-nowrap rounded-full border border-line px-3 py-1.5 text-sm aria-[current=page]:border-brand aria-[current=page]:bg-brand aria-[current=page]:text-brand-ink">
            {label}
          </a>
        ))}
      </nav>
      {posts?.length ? (
        <ul className="flex flex-col gap-3">
          {posts.map((p) => (
            <li key={p.id} id={p.id}>
              <Card className={p.urgent ? "border-bad" : ""}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={CATEGORY[p.category].tone}>{CATEGORY[p.category].label}</Badge>
                  {p.urgent ? <Badge tone="bad">Urgent</Badge> : null}
                  {!read.has(p.id) ? <Badge tone="brand">New</Badge> : null}
                  {p.audience !== "building" ? <span className="text-xs text-ink-2">For your {p.audience === "floors" ? "floor" : "unit"}</span> : null}
                </div>
                <h2 className="mt-2 text-lg font-semibold">{p.title}</h2>
                <p className="mt-1 whitespace-pre-line text-sm">{p.body}</p>
                <p className="mt-2 text-xs text-ink-2">
                  {formatDateTime(p.publish_at)}
                  {p.source === "system" ? " · Posted automatically" : ""}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="text-sm text-ink-2">No announcements yet.</Card>
      )}
      <MarkRead ids={unreadIds} />
    </div>
  );
}
