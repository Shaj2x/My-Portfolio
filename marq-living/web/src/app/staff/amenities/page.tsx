import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button, Card } from "@/components/ui";
import { formatDay, formatTime, localDate, parseRange } from "@/lib/format";
import * as A from "@/lib/actions/amenities";
import { nowMs } from "@/lib/clock";

export const metadata: Metadata = { title: "Amenities" };
const input = "min-h-11 rounded-lg border border-line bg-surface px-2 text-sm";

export default async function StaffAmenities() {
  await requireRole("staff");
  const supabase = await createClient();
  const [{ data: amenities }, { data: blackouts }, { data: bookings }, { data: people }] = await Promise.all([
    supabase.from("amenities").select("*").order("name"),
    supabase.from("amenity_blackouts").select("*"),
    supabase.from("bookings").select("id, amenity_id, tenant_id, unit, period, status, energy_kwh").eq("status", "confirmed"),
    supabase.from("profiles").select("id, full_name").eq("role", "tenant"),
  ]);
  const now = nowMs();
  const name = (id: string) => people?.find((p) => p.id === id)?.full_name ?? "";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Amenities</h1>
      {(amenities ?? []).map((a) => {
        const upcoming = (bookings ?? []).filter((b) => b.amenity_id === a.id).map((b) => ({ ...b, ...parseRange(b.period) }))
          .filter((b) => b.end.getTime() > now).sort((x, y) => x.start.getTime() - y.start.getTime());
        const bl = (blackouts ?? []).filter((b) => b.amenity_id === a.id).map((b) => ({ ...b, ...parseRange(b.period) })).filter((b) => b.end.getTime() > now);
        return (
          <Card key={a.id} className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">{a.name}</h2>
            <form action={A.updateAmenityRules} className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <input type="hidden" name="id" value={a.id} />
              {([
                ["min_duration_minutes", "Min length (min)"], ["max_duration_minutes", "Max length (min)"],
                ["weekly_limit_per_unit", "Per unit / week"], ["booking_window_days", "Book ahead (days)"],
                ["min_notice_minutes", "Notice (min)"], ["buffer_minutes", "Gap between (min)"],
              ] as const).map(([k, label]) => (
                <label key={k} className="flex flex-col gap-1">{label}<input name={k} type="number" min={0} defaultValue={a[k]} className={input} /></label>
              ))}
              <label className="flex flex-col gap-1">Opens<input name="open_time" type="time" defaultValue={a.open_time.slice(0, 5)} className={input} /></label>
              <label className="flex flex-col gap-1">Closes<input name="close_time" type="time" defaultValue={a.close_time.slice(0, 5)} className={input} /></label>
              <label className="col-span-2 flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={a.active} /> Bookable</label>
              <Button type="submit" variant="secondary" className="col-span-2">Save rules</Button>
            </form>

            <section>
              <h3 className="mb-2 text-sm font-medium">Closures</h3>
              <ul className="mb-2 text-sm">
                {bl.map((b) => (
                  <li key={b.id} className="flex items-center justify-between py-1">
                    <span>{formatDay(b.start)} {formatTime(b.start)}–{formatTime(b.end)}{b.reason ? ` · ${b.reason}` : ""}</span>
                    <form action={A.deleteBlackout}><input type="hidden" name="id" value={b.id} /><Button type="submit" variant="ghost">Remove</Button></form>
                  </li>
                ))}
              </ul>
              <form action={A.addBlackout} className="flex flex-wrap gap-2">
                <input type="hidden" name="amenity_id" value={a.id} />
                <input name="date" type="date" required min={localDate()} aria-label="Date" className={input} />
                <input name="from" type="time" required aria-label="From" className={input} />
                <input name="to" type="time" required aria-label="To" className={input} />
                <input name="reason" placeholder="Reason" aria-label="Reason" className={`${input} flex-1`} />
                <Button type="submit" variant="secondary">Close room</Button>
              </form>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-medium">Upcoming bookings ({upcoming.length})</h3>
              <ul className="divide-y divide-line text-sm">
                {upcoming.slice(0, 30).map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 py-2">
                    <span>{formatDay(b.start)} {formatTime(b.start)}–{formatTime(b.end)} · Unit {b.unit} · {name(b.tenant_id)}</span>
                    <form action={A.staffCancelBooking}><input type="hidden" name="id" value={b.id} /><Button type="submit" variant="ghost">Cancel</Button></form>
                  </li>
                ))}
              </ul>
            </section>
          </Card>
        );
      })}
    </div>
  );
}
