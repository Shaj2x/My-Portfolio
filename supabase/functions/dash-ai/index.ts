// Digital Dash AI helper: breaks a task into steps, or plans the week around deadlines.
// Runs as a Supabase Edge Function so the Anthropic API key never reaches the browser.
// Callers must be signed in; each account gets DASH_AI_DAILY_LIMIT requests a day.
import Anthropic from "npm:@anthropic-ai/sdk@^0.129.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MODEL = "claude-opus-5-5";
const DAILY_LIMIT = Number(Deno.env.get("DASH_AI_DAILY_LIMIT") ?? "25");
const anthropic = new Anthropic(); // reads the ANTHROPIC_API_KEY secret

const STYLE =
  "Write in plain, friendly sentence case. Never use em dashes. Keep titles short and concrete, starting with a verb.";

const BREAKDOWN_SCHEMA = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          minutes: { type: "integer" },
          date: { type: "string" },
        },
        required: ["title", "minutes", "date"],
        additionalProperties: false,
      },
    },
    tip: { type: "string" },
  },
  required: ["steps", "tip"],
  additionalProperties: false,
};

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    blocks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string" },
          start: { type: "string" },
          minutes: { type: "integer" },
          task_id: { type: "string" },
          title: { type: "string" },
        },
        required: ["date", "start", "minutes", "task_id", "title"],
        additionalProperties: false,
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "blocks", "warnings"],
  additionalProperties: false,
};

const URG = ["critical", "high", "medium", "low"];
const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);

function breakdownRequest(b: any) {
  const t = b.task ?? {};
  const system = `You help a university student turn one task into a short, realistic list of steps they can each finish in a focused work session.
Return 3 to 8 steps in the order they should be done. For each step give a title (under 60 characters), an honest time estimate in minutes (15 to 180), and a date in YYYY-MM-DD.
Dates must fall between today and the due date, inclusive. Spread the work out instead of stacking it on the last day, and leave the final step or the last day for checking and submitting. If there is no due date, use an empty string for every date.
Also give one practical tip in a single sentence. ${STYLE}`;
  const user = [
    `Today: ${clip(b.today, 10)}`,
    `Task: ${clip(t.title, 200)}`,
    `Urgency: ${URG[Number(t.urg)] ?? "medium"}`,
    `Due: ${t.due ? `${clip(t.due, 10)}${t.dueTime ? " at " + clip(t.dueTime, 5) : ""}` : "no due date"}`,
    b.note ? `Extra context from the student: ${clip(b.note, 600)}` : "",
  ].filter(Boolean).join("\n");
  return { system, user, schema: BREAKDOWN_SCHEMA };
}

function planRequest(b: any) {
  const tasks = (Array.isArray(b.tasks) ? b.tasks : []).slice(0, 60).map((t: any) =>
    `- id ${clip(t.id, 40)}: ${clip(t.title, 160)} | ${URG[Number(t.urg)] ?? "medium"} | due ${t.due ? clip(t.due, 10) + (t.dueTime ? " " + clip(t.dueTime, 5) : "") : "none"}`
  );
  const events = (Array.isArray(b.events) ? b.events : []).slice(0, 120).map((e: any) =>
    `- ${clip(e.date, 10)} ${e.time ? clip(e.time, 5) : "all day"}${e.minutes ? ` for ${Number(e.minutes) || 60} min` : ""}: ${clip(e.title, 120)}`
  );
  const system = `You plan a university student's focus sessions for the next 7 days, starting today, around their deadlines and existing calendar.
Rules:
- Only schedule the open tasks listed. Use each task's exact id in task_id, and a short title for the session.
- Put the most urgent work and the nearest deadlines first. Finish every task before its due date and time.
- Never overlap an existing event. Treat events without a duration as one hour, and all-day events as busy only if they clearly are (exams, trips).
- Schedule between ${clip(b.dayStart || "09:00", 5)} and ${clip(b.dayEnd || "22:00", 5)}. For today, start after ${clip(b.now, 5)}.
- Sessions are 25 to 120 minutes, with breaks between them. Keep each day to about ${Number(b.dailyMinutes) || 240} minutes of focus or less.
- Dates are YYYY-MM-DD, start times are 24-hour HH:MM.
- If something can't fit before its deadline, schedule what you can and say so in warnings. Otherwise warnings is empty.
- summary is one or two sentences on how the week looks. ${STYLE}`;
  const user = [
    `Today: ${clip(b.today, 10)} (${clip(b.weekday, 10)}), now ${clip(b.now, 5)}`,
    `Open tasks:\n${tasks.join("\n") || "- none"}`,
    `Calendar for the next 7 days:\n${events.join("\n") || "- nothing scheduled"}`,
  ].join("\n\n");
  return { system, user, schema: PLAN_SCHEMA };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Sign in to use the AI helper." }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return json({ error: "Sign in to use the AI helper." }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  const build = body?.mode === "breakdown" ? breakdownRequest : body?.mode === "plan" ? planRequest : null;
  if (!build) return json({ error: "Unknown mode" }, 400);
  if (body.mode === "breakdown" && !body.task?.title) return json({ error: "Pick a task first." }, 400);

  const { data: allowed, error: quotaError } = await supabase.rpc("dash_ai_take", { p_limit: DAILY_LIMIT });
  if (quotaError) return json({ error: "The AI helper isn't set up yet." }, 500);
  if (!allowed) return json({ error: `You've used today's ${DAILY_LIMIT} AI requests. It resets tomorrow.` }, 429);

  const { system, user, schema } = build(body);
  try {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // if this model declines, the API retries on Anthropic's recommended fallback
      output_config: { effort: "medium", format: { type: "json_schema", schema } },
      system,
      messages: [{ role: "user", content: user }],
    });

    if (response.stop_reason === "refusal") {
      return json({ error: "The AI helper couldn't help with that one. Try rewording the task." }, 422);
    }
    if (response.stop_reason === "max_tokens") {
      return json({ error: "That was too much to plan at once. Try again with fewer tasks." }, 422);
    }
    const text = response.content.find((b: any) => b.type === "text") as { text: string } | undefined;
    if (!text) return json({ error: "No answer came back. Try again." }, 502);
    return json({ mode: body.mode, result: JSON.parse(text.text) });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "The AI helper is busy. Try again in a minute." }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "The AI helper isn't set up yet (API key)." }, 500);
    if (e instanceof Anthropic.APIError) return json({ error: "The AI service had a problem. Try again." }, 502);
    if (e instanceof SyntaxError) return json({ error: "The answer came back garbled. Try again." }, 502);
    return json({ error: "Something went wrong. Try again." }, 500);
  }
});
