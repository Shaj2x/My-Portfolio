import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { Button, Card } from "@/components/ui";

export const metadata: Metadata = { title: "Driver" };

export default async function DriverPage() {
  const profile = await requireRole("driver");
  return (
    <>
      <AppHeader profile={profile} homeHref="/driver" />
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
        <h1 className="text-2xl font-semibold">Shuttle</h1>
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-ink-2">No run in progress.</p>
          <Button disabled className="min-h-14 text-base">
            Start run
          </Button>
          <p className="text-xs text-ink-2">Run controls and location sharing arrive in stage 2.</p>
        </Card>
      </main>
    </>
  );
}
