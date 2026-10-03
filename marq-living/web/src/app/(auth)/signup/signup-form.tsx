"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp, type FormState } from "../actions";
import { Button, Field, Notice } from "@/components/ui";

export function SignupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, {});

  if (state.done) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="ok">
          Check <strong>{state.message}</strong> for a link to confirm your email.
        </Notice>
        <p className="text-sm text-ink-2">
          After you confirm, the front desk checks your unit against the lease and approves your account. You&apos;ll
          be able to sign in and see your approval status in the meantime.
        </p>
        <Link href="/login" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message ? <Notice tone="bad">{state.message}</Notice> : null}
      <Field label="Full name" name="fullName" autoComplete="name" required defaultValue={v.fullName} error={e.fullName} />
      <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={v.email} error={e.email} />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="At least 8 characters"
        error={e.password}
      />
      <fieldset className="grid grid-cols-3 gap-3">
        <legend className="mb-2 text-sm text-ink-2">Where you live at The Marq</legend>
        <Field
          label="Unit"
          name="unit"
          inputMode="numeric"
          placeholder="1204"
          required
          defaultValue={v.unit}
          error={e.unit}
        />
        <Field
          label="Room"
          name="roomLetter"
          placeholder="A"
          maxLength={1}
          autoCapitalize="characters"
          required
          defaultValue={v.roomLetter}
          error={e.roomLetter}
        />
        <Field
          label="Floor"
          name="floor"
          type="number"
          inputMode="numeric"
          min={1}
          max={40}
          required
          defaultValue={v.floor}
          error={e.floor}
        />
      </fieldset>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-sm text-ink-2">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
