"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type FormState } from "../actions";
import { Button, Field, Notice } from "@/components/ui";

export function ForgotForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, {});
  if (state.done) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="ok">
          If an account exists for <strong>{state.message}</strong>, a reset link is on its way.
        </Notice>
        <Link href="/login" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field label="Email" name="email" type="email" autoComplete="email" required error={state.errors?.email} />
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <Link href="/login" className="text-sm text-ink-2 underline-offset-4 hover:underline">
        Back to sign in
      </Link>
    </form>
  );
}
