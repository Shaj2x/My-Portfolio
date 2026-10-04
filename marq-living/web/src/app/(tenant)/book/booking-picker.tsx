"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBooking } from "@/lib/actions/bookings";
import { availableStarts, durationOptions, type AmenityRules } from "@/lib/booking";
import { Button, Card, Notice } from "@/components/ui";
import { formatTime } from "@/lib/format";

type Amenity = AmenityRules & { id: string; name: string; capacity: number | null };

export function BookingPicker({ amenity, date, busy }: { amenity: Amenity; date: string; busy: { start: string; end: string; kind: string }[] }) {
  const router = useRouter();
  const durations = durationOptions(amenity);
  const [minutes, setMinutes] = useState(durations[Math.min(1, durations.length - 1)]);
  const [start, setStart] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [pending, run] = useTransition();
  const [now] = useState(() => new Date());

  const starts = useMemo(
    () => availableStarts(date, amenity, busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end), kind: b.kind })), minutes, now),
    [date, amenity, busy, minutes, now],
  );

  function book() {
    if (!start) return;
    run(async () => {
      const res = await createBooking({ amenityId: amenity.id, start, minutes });
      if (res.error) setMsg({ tone: "bad", text: res.error });
      else {
        setMsg({ tone: "ok", text: `Booked ${amenity.name}, ${formatTime(start)}. Confirmation sent.` });
        setStart(null);
        router.refresh();
      }
    });
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Length</span>
        {durations.map((d) => (
          <button key={d} type="button" onClick={() => { setMinutes(d); setStart(null); }} aria-pressed={d === minutes}
            className="min-h-11 rounded-lg border border-line px-3 text-sm aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-brand-ink">
            {d < 60 ? `${d} min` : `${d / 60} h`.replace(".5 h", "½ h")}
          </button>
        ))}
      </div>
      {starts.length ? (
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Start time">
          {starts.map((s) => {
            const iso = s.toISOString();
            return (
              <button key={iso} type="button" role="radio" aria-checked={start === iso} onClick={() => setStart(iso)}
                className="min-h-11 rounded-lg border border-line text-sm tabular-nums aria-checked:border-brand aria-checked:bg-brand aria-checked:text-brand-ink">
                {formatTime(s)}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-ink-2">Nothing free for that length on this day.</p>
      )}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Button disabled={!start || pending} onClick={book}>
        {pending ? "Booking…" : start ? `Book ${formatTime(start)}–${formatTime(new Date(new Date(start).getTime() + minutes * 60000))}` : "Pick a start time"}
      </Button>
    </Card>
  );
}
