"use client";

import { useActionState, useRef, useState } from "react";
import { createAnnouncement } from "@/lib/actions/announcements";
import type { FormState } from "@/app/(auth)/actions";
import { Button, Field, Notice } from "@/components/ui";

const input = "min-h-11 rounded-lg border border-line bg-surface px-3 text-sm";

export function ComposeForm() {
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const res = await createAnnouncement(prev, fd);
    if (res.done) form.current?.reset();
    return res;
  }, {});
  const [audience, setAudience] = useState("building");
  const v = state.done ? {} : (state.values ?? {});
  const e = state.errors ?? {};
  return (
    <form ref={form} action={action} className="flex flex-col gap-3" noValidate>
      {state.message ? <Notice tone={state.done ? "ok" : "bad"}>{state.message}</Notice> : null}
      <Field label="Title" name="title" maxLength={160} required defaultValue={v.title} error={e.title} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="body" className="text-sm font-medium">Message</label>
        <textarea id="body" name="body" rows={4} required maxLength={5000} defaultValue={v.body} className="rounded-lg border border-line bg-surface px-3 py-2" />
        {e.body ? <p className="text-sm text-bad">{e.body}</p> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">Category
          <select name="category" defaultValue={v.category || "general"} className={input}>
            <option value="general">General</option><option value="maintenance">Maintenance</option>
            <option value="events">Events</option><option value="safety">Safety</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">Who sees it
          <select name="audience" value={audience} onChange={(ev) => setAudience(ev.target.value)} className={input}>
            <option value="building">Whole building</option><option value="floors">Specific floors</option><option value="units">Specific units</option>
          </select>
        </label>
      </div>
      {audience === "floors" ? <Field label="Floors" name="floors" placeholder="5, 7, 12" defaultValue={v.floors} error={e.floors} /> : null}
      {audience === "units" ? <Field label="Units" name="units" placeholder="502, 1204" defaultValue={v.units} error={e.units} /> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Publish on (optional)" name="publishDate" type="date" defaultValue={v.publishDate} />
        <Field label="At" name="publishTime" type="time" defaultValue={v.publishTime || "08:00"} />
        <Field label="Expires (optional)" name="expiresDate" type="date" defaultValue={v.expiresDate} error={e.expiresDate} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="urgent" className="size-4" /> Urgent — send a push notification
      </label>
      <Button type="submit" disabled={pending} className="self-start">{pending ? "Posting…" : "Post"}</Button>
    </form>
  );
}
