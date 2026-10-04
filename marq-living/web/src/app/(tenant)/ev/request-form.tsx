"use client";

import { useActionState } from "react";
import { requestCharge } from "@/lib/actions/ev";
import type { FormState } from "@/app/(auth)/actions";
import { Button, Field, Notice } from "@/components/ui";

export function RequestForm({ defaultDate }: { defaultDate: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestCharge, {});
  const v = state.values ?? {};
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <h2 className="font-semibold">Request a charge</h2>
      {state.message ? <Notice tone="bad">{state.message}</Notice> : null}
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <Field label="How much?" name="amount" type="number" inputMode="decimal" min={1} defaultValue={v.amount || "150"} error={state.errors?.amount} />
        <select name="unit" defaultValue={v.unit || "km"} aria-label="Unit" className="min-h-11 rounded-lg border border-line bg-surface px-3">
          <option value="km">km of range</option>
          <option value="kwh">kWh</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Leaving on" name="date" type="date" defaultValue={v.date || defaultDate} error={state.errors?.date} />
        <Field label="At" name="time" type="time" defaultValue={v.time || "08:00"} error={state.errors?.time} />
      </div>
      <Field label="Vehicle (optional)" name="vehicle" placeholder="e.g. Blue Bolt" defaultValue={v.vehicle} />
      <Button type="submit" disabled={pending}>{pending ? "Scheduling…" : "Request charge"}</Button>
    </form>
  );
}
