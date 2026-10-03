const dateTime = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  dateStyle: "medium",
  timeStyle: "short",
});

/** Building-local (Eastern) date and time. */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function formatAddress(p: { unit: string | null; room_letter: string | null; floor: number | null }): string {
  if (!p.unit) return "—";
  return `${p.unit}${p.room_letter ?? ""} · Floor ${p.floor ?? "?"}`;
}
