// Digital Dash push reminders.
//   {action: "key"}   -> the public VAPID key the browser subscribes with (no sign-in needed)
//   {action: "test"}  -> sends "Reminders are on" to the signed-in user's devices
//   {action: "run"}   -> sends every reminder that is due; called each minute by pg_cron with x-cron-secret
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com), CRON_SECRET.
import webpush from "npm:web-push@3.6.7";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const env = (k: string) => Deno.env.get(k) ?? "";
webpush.setVapidDetails(env("VAPID_SUBJECT") || "mailto:hello@example.com", env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));

type Sub = { endpoint: string; p256dh: string; auth: string };
type Note = { title: string; body: string; tag?: string | null; url?: string | null; at?: number };

// Encrypt with web-push, deliver with fetch (Deno's fetch is more reliable than Node's https shim).
async function deliver(sub: Sub, note: Note): Promise<"ok" | "gone" | "error"> {
  try {
    const req = webpush.generateRequestDetails(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(note),
      { TTL: 4 * 3600, urgency: "high" },
    );
    const res = await fetch(req.endpoint, { method: req.method, headers: req.headers as Record<string, string>, body: req.body });
    await res.body?.cancel();
    if (res.status === 404 || res.status === 410) return "gone"; // the device unsubscribed or reinstalled
    return res.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

async function sendToUsers(admin: SupabaseClient, userIds: string[], notes: Map<string, Note[]>) {
  const { data: subs } = await admin.from("dash_push_subs").select("endpoint,user_id,p256dh,auth").in("user_id", userIds);
  const gone: string[] = [];
  let sent = 0;
  await Promise.all((subs ?? []).map(async (s: Sub & { user_id: string }) => {
    for (const n of notes.get(s.user_id) ?? []) {
      const r = await deliver(s, n);
      if (r === "gone") { gone.push(s.endpoint); break; }
      if (r === "ok") sent++;
    }
  }));
  if (gone.length) await admin.from("dash_push_subs").delete().in("endpoint", gone);
  return { sent, removed: gone.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  let body: any = {};
  try { body = await req.json(); } catch { /* empty body */ }

  if (body.action === "key") {
    if (!env("VAPID_PUBLIC_KEY")) return json({ error: "Reminders aren't set up on this site yet." }, 500);
    return json({ key: env("VAPID_PUBLIC_KEY") });
  }

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

  if (body.action === "run") {
    if (!env("CRON_SECRET") || req.headers.get("x-cron-secret") !== env("CRON_SECRET")) return json({ error: "Forbidden" }, 403);
    const now = Date.now();
    const { data: due, error } = await admin.from("dash_reminders")
      .select("id,user_id,at,title,body,tag,url")
      .is("sent_at", null)
      .lte("at", new Date(now + 30_000).toISOString())
      .gte("at", new Date(now - 30 * 60_000).toISOString()) // skip anything more than 30 minutes stale
      .order("at").limit(500);
    if (error) return json({ error: error.message }, 500);
    const byUser = new Map<string, Note[]>();
    for (const r of due ?? []) {
      const list = byUser.get(r.user_id) ?? [];
      list.push({ title: r.title, body: r.body, tag: r.tag, url: r.url, at: Date.parse(r.at) });
      byUser.set(r.user_id, list);
    }
    // Mark first so an overlapping run can't send twice (reminders are keyed by user and id).
    const idsByUser = new Map<string, string[]>();
    for (const r of due ?? []) idsByUser.set(r.user_id, [...(idsByUser.get(r.user_id) ?? []), r.id]);
    for (const [uid, ids] of idsByUser) {
      await admin.from("dash_reminders").update({ sent_at: new Date().toISOString() }).eq("user_id", uid).in("id", ids);
    }
    const result = byUser.size ? await sendToUsers(admin, [...byUser.keys()], byUser) : { sent: 0, removed: 0 };
    await admin.from("dash_reminders").delete().lt("at", new Date(now - 2 * 86400_000).toISOString());
    return json({ due: due?.length ?? 0, ...result });
  }

  if (body.action === "test") {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Sign in first." }, 401);
    const asUser = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: auth } } });
    const { data } = await asUser.auth.getUser();
    if (!data?.user) return json({ error: "Sign in first." }, 401);
    const note = { title: "Reminders are on", body: "This is how Digital Dash will nudge you.", tag: "test", url: "/digital-dash.html", at: Date.now() };
    const result = await sendToUsers(admin, [data.user.id], new Map([[data.user.id, [note]]]));
    if (!result.sent) return json({ error: "No device got it. Turn reminders off and on again on this device." }, 404);
    return json(result);
  }

  return json({ error: "Unknown action" }, 400);
});
