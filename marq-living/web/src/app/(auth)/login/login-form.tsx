"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type FormState } from "../actions";
import { Button, Field, Notice } from "@/components/ui";

export function LoginForm({ next, linkError }: { next?: string; linkError?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {linkError && !state.message ? <Notice tone="bad">{linkError}</Notice> : null}
      {state.message ? <Notice tone="bad">{state.message}</Notice> : null}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.errors?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.errors?.password}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="text-ink-2 underline-offset-4 hover:underline">
          Forgot password?
        </Link>
        <Link href="/signup" className="font-medium text-brand underline-offset-4 hover:underline">
          New tenant? Sign up
        </Link>
      </div>
    </form>
  );
}
