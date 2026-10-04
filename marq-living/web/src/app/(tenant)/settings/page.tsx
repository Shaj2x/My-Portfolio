import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { setShuttleAlerts } from "@/lib/actions/settings";
import { PushToggle } from "@/components/push-toggle";
import { Button, Card } from "@/components/ui";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await requireRole("tenant");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Notifications</h1>
      <Card className="flex flex-col gap-3">
        <h2 className="font-medium">This device</h2>
        <PushToggle />
      </Card>
      <Card>
        <form action={setShuttleAlerts} className="flex flex-col gap-3">
          <label className="flex items-start gap-3">
            <input type="checkbox" name="shuttle_alerts" defaultChecked={profile.shuttle_alerts} className="mt-1 size-5 accent-[var(--brand)]" />
            <span>
              <span className="font-medium">Shuttle delays and cancellations</span>
              <span className="block text-sm text-ink-2">Get an alert the moment a run is late or cancelled.</span>
            </span>
          </label>
          <Button type="submit" variant="secondary" className="self-start">Save</Button>
        </form>
      </Card>
      <p className="text-sm text-ink-2">Urgent building announcements, request updates and booking reminders are always sent.</p>
    </div>
  );
}
