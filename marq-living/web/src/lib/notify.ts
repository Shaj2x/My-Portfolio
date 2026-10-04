import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Sends web push and email for notification rows that ask for them. Rows are
// created by database triggers and functions (see the stage 2–4 migrations);
// this only delivers. Safe to run concurrently: each row is claimed by
// stamping push_sent_at / email_sent_at before sending.

const BATCH = 200;

function pushConfigured() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:frontdesk@themarq.ca", pub, priv);
  return true;
}

export type DispatchResult = { pushed: number; pushFailed: number; emailed: number; skipped: number };

export async function dispatchNotifications(): Promise<DispatchResult> {
  const db = createAdminClient();
  const result: DispatchResult = { pushed: 0, pushFailed: 0, emailed: 0, skipped: 0 };
  const now = new Date().toISOString();

  // --- Push ---------------------------------------------------------------
  const { data: duePush, error: dueErr } = await db
    .from("notifications").select("id").eq("send_push", true).is("push_sent_at", null)
    .order("id").limit(BATCH);
  if (dueErr) throw new Error(`due push: ${dueErr.message}`);
  const { data: claimed, error } = duePush?.length
    ? await db.from("notifications").update({ push_sent_at: now })
        .in("id", duePush.map((n) => n.id)).is("push_sent_at", null)
        .select("id, user_id, title, body, url, urgent, kind")
    : { data: [], error: null };
  if (error) throw new Error(`claim push: ${error.message}`);

  if (claimed?.length) {
    if (!pushConfigured()) {
      result.skipped += claimed.length;
    } else {
      const users = [...new Set(claimed.map((n) => n.user_id))];
      const { data: subs } = await db
        .from("push_subscriptions")
        .select("id, user_id, endpoint, p256dh, auth")
        .in("user_id", users);
      const byUser = new Map<string, NonNullable<typeof subs>>();
      for (const s of subs ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
      const dead: string[] = [];

      await Promise.all(
        claimed.flatMap((n) =>
          (byUser.get(n.user_id) ?? []).map(async (s) => {
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                JSON.stringify({ title: n.title, body: n.body, url: n.url ?? "/", tag: `${n.kind}-${n.id}`, urgent: n.urgent }),
                { TTL: n.urgent ? 3600 : 86400, urgency: n.urgent ? "high" : "normal" },
              );
              result.pushed++;
            } catch (err) {
              const status = (err as { statusCode?: number }).statusCode;
              if (status === 404 || status === 410) dead.push(s.id);
              else result.pushFailed++;
            }
          }),
        ),
      );
      if (dead.length) await db.from("push_subscriptions").delete().in("id", dead);
      if (subs?.length) {
        await db.from("push_subscriptions").update({ last_used_at: now }).in("id", subs.map((s) => s.id).filter((id) => !dead.includes(id)));
      }
    }
  }

  // --- Email --------------------------------------------------------------
  const { data: dueMail } = await db
    .from("notifications").select("id").eq("send_email", true).is("email_sent_at", null)
    .order("id").limit(BATCH);
  const { data: mails, error: mailErr } = dueMail?.length
    ? await db.from("notifications").update({ email_sent_at: now })
        .in("id", dueMail.map((n) => n.id)).is("email_sent_at", null)
        .select("id, user_id, title, body, url")
    : { data: [], error: null };
  if (mailErr) throw new Error(`claim email: ${mailErr.message}`);

  if (mails?.length) {
    const { data: people } = await db.from("profiles").select("id, email, full_name").in("id", [...new Set(mails.map((m) => m.user_id))]);
    const who = new Map((people ?? []).map((p) => [p.id, p]));
    for (const m of mails) {
      const p = who.get(m.user_id);
      if (!p) continue;
      const sent = await sendEmail(p.email, m.title, emailHtml(p.full_name, m.title, m.body, m.url));
      if (sent) result.emailed++;
      else result.skipped++;
    }
  }

  return result;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function emailHtml(name: string, title: string, body: string, url: string | null) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const link = url ? `<p><a href="${escapeHtml(site + url)}">Open in Marq Living</a></p>` : "";
  return `<p>Hi ${escapeHtml(name.split(" ")[0])},</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p>${link}<p style="color:#666">The Marq · 75 Ann Street, London, Ontario</p>`;
}

/** Sends via Resend. Returns false (and logs) when email isn't configured. */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "The Marq <frontdesk@themarq.ca>", to, subject, html }),
  });
  if (!res.ok) console.error("resend failed", res.status, await res.text());
  return res.ok;
}
