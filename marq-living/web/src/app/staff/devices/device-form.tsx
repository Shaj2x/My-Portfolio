"use client";

import { useActionState } from "react";
import { saveDevice } from "@/lib/actions/devices";
import type { FormState } from "@/app/(auth)/actions";
import { Button, Field, Notice } from "@/components/ui";

type Dev = { id?: string; hardware_id?: string; name?: string; type?: string; location?: string; circuit?: string | null; room_id?: string | null; calibration?: unknown; config?: unknown };
const TYPES = [["ct_node", "CT clamp node"], ["pir", "Occupancy (PIR)"], ["relay", "Relay / room controls"], ["thermostat", "Thermostat"], ["ev_charger", "EV charger"], ["shuttle_telematics", "Shuttle telematics"], ["gateway", "Gateway"]];

export function DeviceForm({ device, rooms }: { device?: Dev; rooms: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveDevice, {});
  const v = (k: keyof Dev, fallback = "") => state.values?.[k] ?? (typeof device?.[k] === "object" && device?.[k] ? JSON.stringify(device[k], null, 1) : String(device?.[k] ?? fallback));
  const e = state.errors ?? {};
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2" noValidate>
      {state.message ? <div className="sm:col-span-2"><Notice tone={state.done ? "ok" : "bad"}>{state.message}</Notice></div> : null}
      {device?.id ? <input type="hidden" name="id" value={device.id} /> : null}
      <Field label="Hardware ID" name="hardware_id" defaultValue={v("hardware_id")} error={e.hardware_id} hint="MQTT client ID, e.g. ct-laundry-01" readOnly={!!device?.id} />
      <Field label="Name" name="name" defaultValue={v("name")} error={e.name} />
      <label className="flex flex-col gap-1.5 text-sm font-medium">Type
        <select name="type" defaultValue={v("type", "ct_node")} className="min-h-11 rounded-lg border border-line bg-surface px-3">{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </label>
      <Field label="Location" name="location" defaultValue={v("location")} error={e.location} />
      <Field label="Circuit / panel" name="circuit" defaultValue={v("circuit")} hint="e.g. Panel B, breaker 14" />
      <label className="flex flex-col gap-1.5 text-sm font-medium">Room
        <select name="room_id" defaultValue={v("room_id")} className="min-h-11 rounded-lg border border-line bg-surface px-3"><option value="">None</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">Calibration (JSON)
        <textarea name="calibration" rows={3} defaultValue={v("calibration", "{}")} className="rounded-lg border border-line bg-surface p-2 font-mono text-xs"
          placeholder='{"channels":{"0":{"current_scale":1.0,"current_offset_a":0.02,"voltage":120,"power_factor":0.95}}}' />
        {e.calibration ? <span className="text-sm text-bad">{e.calibration}</span> : null}
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">Configuration (JSON)
        <textarea name="config" rows={3} defaultValue={v("config", "{}")} className="rounded-lg border border-line bg-surface p-2 font-mono text-xs"
          placeholder='{"interval_s":5,"system":"laundry","channels":{"0":{"label":"Washer 1","max_w":2200}}}' />
        {e.config ? <span className="text-sm text-bad">{e.config}</span> : null}
      </label>
      <Button type="submit" disabled={pending} className="sm:col-span-2 sm:justify-self-start">{pending ? "Saving…" : device?.id ? "Save" : "Register device"}</Button>
    </form>
  );
}
