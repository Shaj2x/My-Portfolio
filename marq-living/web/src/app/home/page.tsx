import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { Badge, Card } from "@/components/ui";

export const metadata: Metadata = { title: "Home" };

// Features arrive stage by stage; each tile shows when it goes live.
const FEATURES = [
  { name: "Shuttle", desc: "Live map, ETA and delay alerts", stage: 2 },
  { name: "Announcements", desc: "News for your floor and building", stage: 3 },
  { name: "Front desk", desc: "Send a request and follow up", stage: 3 },
  { name: "Book a room", desc: "Theatre and game room", stage: 4 },
  { name: "Laundry", desc: "See which machines are free", stage: 6 },
  { name: "EV charging", desc: "Request a charge slot", stage: 8 },
] as const;

export default async function TenantHome() {
  const profile = await requireRole("tenant");
  const firstName = profile.full_name.split(" ")[0];
  return (
    <>
      <AppHeader profile={profile} homeHref="/home" />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-semibold">Hi {firstName}</h1>
        <p className="mt-1 text-sm text-ink-2">
          Unit {profile.unit}
          {profile.room_letter} · Floor {profile.floor}
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.name}>
              <Card className="flex h-full flex-col gap-2 p-4">
                <h2 className="font-medium">{f.name}</h2>
                <p className="text-sm text-ink-2">{f.desc}</p>
                <div className="mt-auto pt-1">
                  <Badge>Coming soon</Badge>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
