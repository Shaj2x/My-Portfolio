"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { markNotificationsRead } from "@/lib/actions/notifications";

type Alert = { id: number; title: string; body: string; url: string | null; kind: string; created_at: string };

// Urgent, unread notifications (shuttle delays/cancellations, urgent posts)
// as a banner, updated live over Supabase Realtime.
export function AlertBanner({ userId, initial }: { userId: string; initial: Alert[] }) {
  const [alerts, setAlerts] = useState<Alert[]>(initial);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`alerts-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Alert & { urgent: boolean };
          if (n.urgent) setAlerts((prev) => [n, ...prev.filter((a) => a.id !== n.id)].slice(0, 5));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (alerts.length === 0) return null;
  const top = alerts[0];
  const dismiss = () => {
    setAlerts((prev) => prev.slice(1));
    startTransition(() => markNotificationsRead([top.id]));
  };

  const tone = top.kind === "shuttle_cancel" ? "bg-bad text-white" : "bg-warn-bg text-warn";
  return (
    <div role="alert" className={`${tone} border-b border-line`}>
      <div className="mx-auto flex max-w-3xl items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{top.title}</p>
          {top.body ? <p className="text-sm opacity-90">{top.body}</p> : null}
          {top.url ? (
            <Link href={top.url} className="text-sm font-medium underline underline-offset-2">
              Details
            </Link>
          ) : null}
        </div>
        <button type="button" onClick={dismiss} className="min-h-11 min-w-11 text-sm font-medium" aria-label="Dismiss alert">
          ✕{alerts.length > 1 ? <span className="sr-only"> ({alerts.length - 1} more)</span> : null}
        </button>
      </div>
    </div>
  );
}
