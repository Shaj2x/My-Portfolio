import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { homeFor } from "@/lib/roles";
import { signOut } from "@/app/(auth)/actions";
import { Button, Card, Logo, Notice } from "@/components/ui";

export const metadata: Metadata = { title: "Account status" };

const COPY = {
  pending: {
    tone: "warn",
    title: "Waiting for approval",
    body: "The front desk checks new accounts against the lease, usually within one business day. You'll get full access as soon as you're approved — just reopen the app.",
  },
  rejected: {
    tone: "bad",
    title: "We couldn't approve this account",
    body: "Your details didn't match our records. Visit or call the front desk and we'll sort it out.",
  },
  suspended: {
    tone: "bad",
    title: "Account suspended",
    body: "Access to Marq Living is paused for this account. Contact the front desk for details.",
  },
} as const;

export default async function PendingPage() {
  const profile = await requireUser();
  if (profile.status === "approved") redirect(homeFor(profile));

  const copy = COPY[profile.status];
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 py-10">
      <Logo className="text-2xl" />
      <Card className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">{copy.title}</h1>
        <Notice tone={copy.tone}>{copy.body}</Notice>
        {profile.review_note && profile.status !== "pending" ? (
          <p className="text-sm text-ink-2">Note from the front desk: {profile.review_note}</p>
        ) : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-ink-2">Name</dt>
          <dd>{profile.full_name}</dd>
          <dt className="text-ink-2">Email</dt>
          <dd className="break-all">{profile.email}</dd>
          {profile.unit ? (
            <>
              <dt className="text-ink-2">Unit</dt>
              <dd>
                {profile.unit}
                {profile.room_letter} · Floor {profile.floor}
              </dd>
            </>
          ) : null}
        </dl>
      </Card>
      <form action={signOut}>
        <Button type="submit" variant="secondary" className="w-full">
          Sign out
        </Button>
      </form>
    </main>
  );
}
