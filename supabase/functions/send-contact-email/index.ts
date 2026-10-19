import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/*
 * The contact form: stores a message and emails it to me. Hardened against abuse: only the
 * portfolio's own pages may call it from a browser, fields are checked and size-capped, an email
 * address has to look like one, and everything is HTML-escaped before it goes into the email so
 * nobody can inject links or markup into my inbox.
 */

const ALLOWED_ORIGINS = ["https://shajithsasikumar.com", "https://www.shajithsasikumar.com"];
const LIMITS = { name: 80, email: 200, message: 4000 };

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  Vary: "Origin",
});

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = { ...cors(origin), "Content-Type": "application/json" };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

  if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  // browsers send their origin: only the portfolio's pages may use this
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return reply(403, { error: "Not allowed" });

  try {
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!name || !email || !message) return reply(400, { error: "Missing fields" });
    if (name.length > LIMITS.name || email.length > LIMITS.email || message.length > LIMITS.message) return reply(413, { error: "Too long" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return reply(400, { error: "That email doesn't look right" });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await supabase.from("contact_submissions").insert({ name, email, message });

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return reply(500, { error: "Email service not configured" });

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Portfolio Contact <onboarding@resend.dev>",
        to: ["shajithskumar@gmail.com"],
        // no line breaks in a header, and nothing longer than it needs to be
        subject: `Portfolio Contact from ${name.replace(/[\r\n]+/g, " ").slice(0, 80)}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Message:</strong></p>
          <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
        `,
        reply_to: email,
      }),
    });

    if (!emailRes.ok) {
      console.error("Resend error:", await emailRes.text());
      return reply(500, { error: "Failed to send email" });
    }
    return reply(200, { success: true });
  } catch (err) {
    console.error("Edge function error:", err);
    return reply(500, { error: "Internal error" });
  }
});
