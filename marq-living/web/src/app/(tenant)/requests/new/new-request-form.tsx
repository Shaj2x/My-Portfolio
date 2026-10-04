"use client";

import { useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createTicket } from "@/lib/actions/tickets";
import type { FormState } from "@/app/(auth)/actions";
import { Button, Field, Notice } from "@/components/ui";
import { TICKET_CATEGORY } from "@/components/ticket-bits";

const MAX_BYTES = 10 * 1024 * 1024;

export function NewRequestForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createTicket, {});
  const [photoPath, setPhotoPath] = useState<string>("");
  const [upload, setUpload] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const v = state.values ?? {};

  // Photos go straight to private storage under the tenant's own folder.
  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) return setUpload("error");
    setUpload("uploading");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await createClient().storage.from("ticket-photos").upload(path, file, { contentType: file.type });
    if (error) return setUpload("error");
    setPhotoPath(path);
    setUpload("done");
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message ? <Notice tone="bad">{state.message}</Notice> : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="category" className="text-sm font-medium">Category</label>
        <select id="category" name="category" defaultValue={v.category || ""} required className="min-h-11 rounded-lg border border-line bg-surface px-3">
          <option value="" disabled>Choose…</option>
          {Object.entries(TICKET_CATEGORY).filter(([k]) => k !== "device_fault").map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        {state.errors?.category ? <p className="text-sm text-bad">{state.errors.category}</p> : null}
      </div>
      <Field label="Summary" name="subject" maxLength={160} required defaultValue={v.subject} error={state.errors?.subject} placeholder="e.g. Kitchen tap is leaking" />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">Details</label>
        <textarea id="description" name="description" rows={5} maxLength={4000} defaultValue={v.description} className="rounded-lg border border-line bg-surface px-3 py-2" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="photo" className="text-sm font-medium">Photo (optional)</label>
        <input id="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" onChange={onPhoto} className="text-sm" />
        {upload === "uploading" ? <p className="text-sm text-ink-2">Uploading…</p> : null}
        {upload === "done" ? <p className="text-sm text-ok">Photo attached.</p> : null}
        {upload === "error" ? <p className="text-sm text-bad">Couldn&apos;t upload that photo (max 10 MB, JPEG/PNG/WebP/HEIC).</p> : null}
      </div>
      <input type="hidden" name="photoPath" value={photoPath} />
      <Button type="submit" disabled={pending || upload === "uploading"}>{pending ? "Sending…" : "Send to front desk"}</Button>
    </form>
  );
}
