"use client";

import { useActionState, useRef } from "react";
import { postTicketMessage } from "@/lib/actions/tickets";
import type { FormState } from "@/app/(auth)/actions";
import { Button, Notice } from "@/components/ui";

export function ReplyForm({ ticketId, staff }: { ticketId: string; staff: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const res = await postTicketMessage(prev, fd);
    if (res.done) form.current?.reset();
    return res;
  }, {});
  return (
    <form ref={form} action={action} className="flex flex-col gap-2">
      {state.message ? <Notice tone="bad">{state.message}</Notice> : null}
      <input type="hidden" name="ticketId" value={ticketId} />
      <label htmlFor="reply" className="sr-only">Message</label>
      <textarea id="reply" name="body" rows={3} maxLength={4000} required placeholder="Write a message…" className="rounded-lg border border-line bg-surface px-3 py-2" />
      {state.errors?.body ? <p className="text-sm text-bad">{state.errors.body}</p> : null}
      <div className="flex items-center justify-between gap-3">
        {staff ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="internal" className="size-4" /> Internal note (tenant won&apos;t see it)
          </label>
        ) : <span />}
        <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send"}</Button>
      </div>
    </form>
  );
}
