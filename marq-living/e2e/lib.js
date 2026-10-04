// Shared helpers for the e2e scripts.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const BASE = `http://localhost:${process.env.APP_PORT || 3000}`;
const API = `http://localhost:${process.env.GATEWAY_PORT || 54321}`;
const MAIL = process.env.E2E_MAIL;
const SHOTS = process.env.E2E_SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

let passed = 0;
function ok(cond, label) {
  if (!cond) throw new Error("FAIL: " + label);
  passed++;
  console.log("ok -", label);
}
const count = () => passed;

const sql = (q) =>
  execSync(`psql -X -t -A -h 127.0.0.1 -p ${process.env.E2E_PG_PORT} -U postgres -d postgres`, { input: q }).toString().trim();

async function linkFor(to, since) {
  for (let i = 0; i < 50; i++) {
    const files = fs.readdirSync(MAIL).filter((f) => f.endsWith(`-${to}.eml`)).sort();
    const fresh = files.filter((f) => BigInt(f.split("-")[0]) > since);
    if (fresh.length) {
      let raw = fs.readFileSync(path.join(MAIL, fresh.at(-1)), "utf8");
      raw = raw.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      const m = raw.match(/href="([^"]*\/auth\/confirm[^"]*)"/);
      if (!m) throw new Error("no confirm link in email to " + to);
      return m[1].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("no email for " + to);
}
const now = () => BigInt(Date.now()) * 1000000n;

async function signIn(page, email, password, next) {
  await page.goto(BASE + "/login" + (next ? `?next=${encodeURIComponent(next)}` : ""));
  await page.fill("#f-email", email);
  await page.fill("#f-password", password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click("button[type=submit]")]);
}

/** Create a confirmed user through the Auth admin API, then set role/status in SQL. */
async function makeUser({ email, password = "marq-pass-1", name, unit, room = "A", floor, role = "tenant", status = "approved" }) {
  const meta = unit ? { full_name: name, unit, room_letter: room, floor: String(floor) } : { full_name: name, unit: "999", room_letter: "A", floor: "9" };
  const res = await fetch(`${API}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: process.env.SERVICE_KEY, Authorization: `Bearer ${process.env.SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: meta }),
  });
  if (!res.ok) throw new Error(`create ${email}: ${res.status} ${await res.text()}`);
  const { id } = await res.json();
  const unitSql = role === "tenant" ? "" : ", unit = null, room_letter = null, floor = null";
  sql(`update public.profiles set role = '${role}', status = '${status}'${unitSql} where id = '${id}'`);
  return { id, email, password };
}

async function launch() {
  const { chromium } = require("playwright");
  return chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
}
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 };
const timeLabel = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "numeric", minute: "2-digit" }).format(d);

module.exports = { BASE, API, MAIL, SHOTS, ok, count, sql, linkFor, now, signIn, makeUser, launch, mobile, timeLabel };

const sqlT = (q) =>
  execSync(`psql -X -t -A -h 127.0.0.1 -p ${process.env.E2E_PG_PORT} -U postgres -d telemetry`, { input: q }).toString().trim();

async function until(label, fn, timeoutMs = 60000, everyMs = 2000) {
  const end = Date.now() + timeoutMs;
  let last;
  while (Date.now() < end) {
    try {
      last = await fn();
      if (last) return last;
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, everyMs));
  }
  throw new Error(`timed out waiting for: ${label} (last: ${last})`);
}

module.exports.sqlT = sqlT;
module.exports.until = until;
