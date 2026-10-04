import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button, Card } from "@/components/ui";
import { formatDay, formatTime, localDate, localToUtc, parseRange } from "@/lib/format";
import { nextDay } from "@/lib/booking";
import { cancelBooking } from "@/lib/actions/bookings";
import { BookingPicker } from "./booking-picker";
import { nowMs } from "@/lib/clock";

export const metadata: Metadata = { title: "Book a room" };

export default async function BookPage({ searchParams }: PageProps<"/book">) {
  await requireRole("tenant");
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: amenities } = await supabase.from("amenities").select("*").eq("active", true).order("name");
  if (!amenities?.length) return <Card className="text-sm text-ink-2">No rooms are bookable right now.</Card>;

  const amenity = amenities.find((a) => a.slug === sp.room) ?? amenities[0];
  const today = localDate();
  const days = Array.from({ length: amenity.booking_window_days + 1 }, (_, i) => {
    let d = today;
    for (let k = 0; k < i; k++) d = nextDay(d);
    return d;
  });
  const date = typeof sp.date === "string" && days.includes(sp.date) ? sp.date : today;

  const [{ data: busy }, { data: mine }] = await Promise.all([
    supabase.rpc("amenity_busy_periods", {
      p_amenity: amenity.id,
      p_from: localToUtc(date, "00:00").toISOString(),
      p_to: localToUtc(nextDay(date), "00:00").toISOString(),
    }),
    supabase.from("bookings").select("id, amenity_id, period, status").eq("status", "confirmed"),
  ]);
  const upcoming = (mine ?? [])
    .map((b) => ({ ...b, ...parseRange(b.period) }))
    .filter((b) => b.end.getTime() > nowMs())
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Book a room</h1>
      <nav className="grid grid-cols-2 gap-2" aria-label="Room">
        {amenities.map((a) => (
          <a key={a.id} href={`?room=${a.slug}&date=${date}`} aria-current={a.id === amenity.id ? "page" : undefined}
            className="rounded-lg border border-line px-3 py-2 text-center text-sm font-medium aria-[current=page]:border-brand aria-[current=page]:bg-brand aria-[current=page]:text-brand-ink">
            {a.name}
          </a>
        ))}
      </nav>
      {amenity.description ? <p className="text-sm text-ink-2">{amenity.description}</p> : null}
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Day">
        {days.map((d) => (
          <a key={d} href={`?room=${amenity.slug}&date=${d}`} aria-current={d === date ? "date" : undefined}
            className="whitespace-nowrap rounded-full border border-line px-3 py-1.5 text-sm aria-[current=date]:border-brand aria-[current=date]:bg-brand aria-[current=date]:text-brand-ink">
            {d === today ? "Today" : formatDay(localToUtc(d, "12:00"))}
          </a>
        ))}
      </nav>
      <BookingPicker
        key={`${amenity.id}-${date}`}
        amenity={amenity}
        date={date}
        busy={(busy ?? []).map((b) => ({ ...parseRange(b.period!), kind: b.kind ?? "booking" })).map((b) => ({ start: b.start.toISOString(), end: b.end.toISOString(), kind: b.kind }))}
      />
      <p className="text-xs text-ink-2">
        {amenity.min_duration_minutes}–{amenity.max_duration_minutes} min · up to {amenity.weekly_limit_per_unit} bookings per unit per week · book up to {amenity.booking_window_days} days ahead
      </p>
      {upcoming.length ? (
        <Card className="p-0">
          <h2 className="border-b border-line px-4 py-3 font-medium">Your bookings</h2>
          <ul className="divide-y divide-line">
            {upcoming.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{amenities.find((a) => a.id === b.amenity_id)?.name}</span>
                  <span className="block text-ink-2">{formatDay(b.start)} · {formatTime(b.start)}–{formatTime(b.end)}</span>
                </span>
                <form action={cancelBooking}>
                  <input type="hidden" name="id" value={b.id} />
                  <Button type="submit" variant="danger">Cancel</Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
