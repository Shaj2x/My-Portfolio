import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { Logo } from "@/components/ui";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Set password" };

// Reached from invite and password-reset emails (already signed in by the link).
export default async function SetPasswordPage() {
  const profile = await requireUser();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 py-10">
      <Logo className="text-2xl" />
      <div>
        <h1 className="text-2xl font-semibold">Set your password</h1>
        <p className="mt-1 text-sm text-ink-2">For {profile.email}</p>
      </div>
      <PasswordForm />
    </main>
  );
}
