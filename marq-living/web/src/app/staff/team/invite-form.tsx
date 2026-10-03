"use client";

import { useActionState } from "react";
import { inviteMember } from "../actions";
import type { FormState } from "@/app/(auth)/actions";
import { Button, Field, Notice } from "@/components/ui";

export function InviteForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(inviteMember, {});
  const v = state.done ? {} : (state.values ?? {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end" noValidate>
      {state.message ? (
        <div className="sm:col-span-4">
          <Notice tone={state.done ? "ok" : "bad"}>{state.message}</Notice>
        </div>
      ) : null}
      <Field label="Name" name="fullName" required defaultValue={v.fullName} error={state.errors?.fullName} key={`n-${state.done}`} />
      <Field label="Email" name="email" type="email" required defaultValue={v.email} error={state.errors?.email} key={`e-${state.done}`} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="invite-role" className="text-sm font-medium">
          Role
        </label>
        <select
          id="invite-role"
          name="role"
          defaultValue={v.role || "staff"}
          className="min-h-11 rounded-lg border border-line bg-surface px-3 text-base"
        >
          <option value="staff">Staff</option>
          <option value="driver">Driver</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send invite"}
      </Button>
    </form>
  );
}
