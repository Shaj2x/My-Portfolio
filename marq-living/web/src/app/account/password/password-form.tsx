"use client";

import { useActionState } from "react";
import { setPassword } from "./actions";
import type { FormState } from "@/app/(auth)/actions";
import { Button, Field, Notice } from "@/components/ui";

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(setPassword, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message ? <Notice tone="bad">{state.message}</Notice> : null}
      <Field label="New password" name="password" type="password" autoComplete="new-password" minLength={8} required error={state.errors?.password} />
      <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" required error={state.errors?.confirm} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
