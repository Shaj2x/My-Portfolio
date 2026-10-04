import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { nowMs } from "@/lib/clock";
import { formatDay, formatTime, parseRange, relativeMinutes } from "@/lib/format";

export const metadata: Metadata = { title: "Home" };

export default async function TenantHome() {
  const profile = await requireRole("tenant");
  const supabase = await createClient();

  const [active, next, posts, reads, requests, booking, laundry] = await Promise.all([
    supabase.from("runs").select("id, delay_minutes").eq("status", "active").limit(1).maybeSingle(),
    supabase.rpc("next_departures", { p_limit: 1 }),
    supabase.from("announcements").select("id").order("publish_at", { ascending: false }).limit(50),
    supabase.from("announcement_reads").select("announcement_id"),
    supabase.from("tickets").select("id", { count: "exact", head: true }).neq("status", "resolved"),
    supabase.from("bookings").select("period, amenity_id").eq("status", "confirmed"),
    supabase.from("laundry_machines").select("kind, state"),
  ]);

  const readSet = new Set((reads.data ?? []).map((r) => r.announcement_id));
  const unread = (posts.data ?? []).filter((p) => !readSet.has(p.id)).length;
  const dep = next.data?.[0];
  const free = (kind: "washer" | "dryer") => (laundry.data ?? []).filter((m) => m.kind === kind && m.state === "idle").length;
  const upcoming = (booking.data ?? [])
    .map((b) => ({ ...b, ...parseRange(b.period) }))
    .filter((b) => b.end.getTime() > nowMs())
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
  const { data: amenityNames } = await supabase.from("amenities").select("id, name");
  const bookedName = upcoming ? amenityNames?.find((a) => a.id === upcoming.amenity_id)?.name : null;

  const tiles = [
    {
      href: "/shuttle",
      name: "Shuttle",
      value: active.data ? "On the road" : dep ? (dep.status === "cancelled" ? `${formatTime(dep.departs_at!)} cancelled` : `Next ${formatTime(dep.departs_at!)}`) : "No runs scheduled",
      hint: active.data ? (active.data.delay_minutes ? `${active.data.delay_minutes} min late` : "Track live") : dep?.departs_at ? relativeMinutes(dep.departs_at) : "",
    },
    { href: "/announcements", name: "Announcements", value: unread ? `${unread} new` : "All caught up", hint: "" },
    { href: "/requests", name: "Front desk", value: requests.count ? `${requests.count} open` : "No open requests", hint: "New request" },
    {
      href: "/book",
      name: "Book a room",
      value: upcoming ? bookedName ?? "Booking" : "Theatre · Game room",
      hint: upcoming ? `${formatDay(upcoming.start)} ${formatTime(upcoming.start)}` : "",
    },
    { href: "/laundry", name: "Laundry", value: laundry.data?.length ? `${free("washer")} washers · ${free("dryer")} dryers free` : "Not connected yet", hint: "" },
    { href: "/ev", name: "EV charging", value: "Request a charge", hint: "" },
  ];

  return (
    <>
      <h1 className="text-2xl font-semibold">Hi {profile.full_name.split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-ink-2">
        Unit {profile.unit}
        {profile.room_letter} · Floor {profile.floor}
      </p>
      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className="block h-full">
              <Card className="flex h-full flex-col gap-1 p-4 transition hover:border-brand">
                <h2 className="text-sm text-ink-2">{t.name}</h2>
                <p className="font-semibold leading-snug">{t.value}</p>
                {t.hint ? <p className="text-xs text-ink-2">{t.hint}</p> : null}
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm">
        <Link href="/settings" className="text-ink-2 underline underline-offset-4">
          Notification settings
        </Link>
      </p>
    </>
  );
}
