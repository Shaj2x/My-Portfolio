"use client";

import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription } from "@/lib/actions/settings";
import { Button, Notice } from "@/components/ui";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = "loading" | "unsupported" | "blocked" | "off" | "on";

// Subscribes this browser to web push. On iPhone this works only after
// "Add to Home Screen" (iOS 16.4+).
export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: State;
      if (!key || !("serviceWorker" in navigator) || !("PushManager" in window)) next = "unsupported";
      else if (Notification.permission === "denied") next = "blocked";
      else {
        const reg = await navigator.serviceWorker.getRegistration();
        next = (await reg?.pushManager.getSubscription()) ? "on" : "off";
      }
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  async function enable() {
    setError(null);
    try {
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "blocked" : "off");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key!) });
      const res = await savePushSubscription(sub.toJSON(), navigator.userAgent);
      if (res.error) throw new Error(res.error);
      setState("on");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't turn on notifications.");
    }
  }

  async function disable() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await removePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
  }

  return (
    <div className="flex flex-col gap-2">
      {state === "unsupported" ? (
        <p className="text-sm text-ink-2">This browser can&apos;t receive notifications. On iPhone, add Marq Living to your Home Screen first.</p>
      ) : state === "blocked" ? (
        <Notice tone="warn">Notifications are blocked for this site. Allow them in your browser settings.</Notice>
      ) : state === "on" ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">Notifications are on for this device.</span>
          <Button variant="secondary" onClick={disable}>Turn off</Button>
        </div>
      ) : state === "off" ? (
        <Button onClick={enable}>Turn on notifications</Button>
      ) : null}
      {error ? <Notice tone="bad">{error}</Notice> : null}
    </div>
  );
}
