// Stage 1 end-to-end (run via ./run.sh): sign-up, email confirm, pending gate, admin bootstrap,
// staff invite, approval, rejection, role routing, password reset.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const BASE = "http://localhost:3000";
const MAIL = process.env.E2E_MAIL;
const SHOTS = process.env.E2E_SHOTS;
fs.mkdirSync(SHOTS, { recursive: true });

let passed = 0;
function ok(cond, label) {
  if (!cond) throw new Error("FAIL: " + label);
  passed++;
  console.log("ok -", label);
}
const sql = (q) =>
  execSync(`psql -X -t -A -h 127.0.0.1 -p ${process.env.E2E_PG_PORT} -U postgres -d postgres -c "${q.replace(/"/g, '\\"')}"`).toString().trim();

// Latest email to `to` received after `since`; returns the first /auth/confirm link.
async function linkFor(to, since) {
  for (let i = 0; i < 50; i++) {
    const files = fs.readdirSync(MAIL).filter((f) => f.endsWith(`-${to}.eml`)).sort();
    const fresh = files.filter((f) => BigInt(f.split("-")[0]) > since);
    if (fresh.length) {
      let raw = fs.readFileSync(path.join(MAIL, fresh.at(-1)), "utf8");
      raw = raw.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      const m = raw.match(/href="([^"]*\/auth\/confirm[^"]*)"/);
      if (!m) throw new Error("no confirm link in email to " + to + ":\n" + raw);
      return m[1].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("no email for " + to);
}
const now = () => BigInt(Date.now()) * 1000000n;

async function signUp(page, { name, email, unit, room, floor }) {
  await page.goto(BASE + "/signup");
  await page.fill("#f-fullName", name);
  await page.fill("#f-email", email);
  await page.fill("#f-password", "marq-pass-1");
  await page.fill("#f-unit", unit);
  await page.fill("#f-roomLetter", room);
  await page.fill("#f-floor", floor);
  await page.click("button[type=submit]");
  await page.getByText("for a link to confirm your email").waitFor();
}

async function signIn(page, email, password = "marq-pass-1", next) {
  await page.goto(BASE + "/login" + (next ? `?next=${encodeURIComponent(next)}` : ""));
  await page.fill("#f-email", email);
  await page.fill("#f-password", password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click("button[type=submit]")]);
}

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 };
  const ctx = async () => browser.newContext(mobile);

  // --- Signed out --------------------------------------------------------------
  const anon = await (await ctx()).newPage();
  await anon.goto(BASE + "/staff/approvals");
  ok(new URL(anon.url()).pathname === "/login" && anon.url().includes("next=%2Fstaff%2Fapprovals"), "signed-out visitor is sent to login with next");
  await anon.screenshot({ path: `${SHOTS}/01-login.png` });

  // Validation errors surface per field and keep values.
  await anon.goto(BASE + "/signup");
  await anon.fill("#f-fullName", "Val Idation");
  await anon.fill("#f-email", "val@marq.test");
  await anon.fill("#f-password", "short");
  await anon.fill("#f-unit", "12");
  await anon.fill("#f-roomLetter", "Z");
  await anon.fill("#f-floor", "0");
  await anon.click("button[type=submit]");
  await anon.getByText("Unit is 3–4 digits").waitFor();
  ok(await anon.getByText("Room letter is A–F").isVisible(), "sign-up shows room letter error");
  ok(await anon.getByText("Use at least 8 characters").isVisible(), "sign-up shows password error");
  ok((await anon.inputValue("#f-fullName")) === "Val Idation", "sign-up keeps entered values on error");
  await anon.screenshot({ path: `${SHOTS}/02-signup-errors.png`, fullPage: true });
  ok(sql("select count(*) from auth.users where email = 'val@marq.test'") === "0", "invalid sign-up creates no account");

  // --- Ada: first admin ----------------------------------------------------------
  const adaPage = await (await ctx()).newPage();
  let t = now();
  await signUp(adaPage, { name: "Ada Manager", email: "ada@marq.test", unit: "101", room: "A", floor: "1" });
  await adaPage.screenshot({ path: `${SHOTS}/03-signup-done.png` });
  await adaPage.goto(await linkFor("ada@marq.test", t));
  await adaPage.waitForURL("**/pending");
  ok(await adaPage.getByText("Waiting for approval").isVisible(), "confirm link signs in and lands on pending");
  ok(sql("select role||'/'||status from public.profiles where email='ada@marq.test'") === "tenant/pending", "new sign-up is a pending tenant in the DB");

  sql("select public.bootstrap_admin('ada@marq.test')");
  await adaPage.goto(BASE + "/");
  await adaPage.waitForURL("**/staff");
  ok(await adaPage.getByRole("link", { name: "Team" }).isVisible(), "bootstrapped admin lands on staff area with Team tab");

  // --- Ada invites Sam (staff) ----------------------------------------------------
  await adaPage.goto(BASE + "/staff/team");
  t = now();
  await adaPage.fill("#f-fullName", "Sam Desk");
  await adaPage.fill("#f-email", "sam@marq.test");
  await adaPage.selectOption("#invite-role", "staff");
  await adaPage.click("text=Send invite");
  await adaPage.getByText("Invite sent to sam@marq.test.").waitFor();
  ok(sql("select role||'/'||status from public.profiles where email='sam@marq.test'") === "staff/approved", "invited staff account is approved staff");
  await adaPage.screenshot({ path: `${SHOTS}/04-team.png`, fullPage: true });

  const samCtx = await ctx();
  const sam = await samCtx.newPage();
  await sam.goto(await linkFor("sam@marq.test", t));
  await sam.waitForURL("**/account/password");
  await sam.fill("#f-password", "sam-pass-123");
  await sam.fill("#f-confirm", "sam-pass-123");
  await Promise.all([sam.waitForURL("**/staff"), sam.click("button[type=submit]")]);
  ok(!(await sam.getByRole("link", { name: "Team" }).count()), "staff (non-admin) doesn't see Team tab");
  await sam.goto(BASE + "/staff/team");
  ok(new URL(sam.url()).pathname === "/staff", "staff is redirected away from the admin-only Team page");

  // --- Alice and Bob sign up ------------------------------------------------------
  const alice = await (await ctx()).newPage();
  t = now();
  await signUp(alice, { name: "Alice Resident", email: "alice@marq.test", unit: "1204", room: "B", floor: "12" });
  await alice.goto(await linkFor("alice@marq.test", t));
  await alice.waitForURL("**/pending");
  await alice.screenshot({ path: `${SHOTS}/05-pending.png` });
  for (const p of ["/home", "/staff", "/driver", "/staff/approvals"]) {
    await alice.goto(BASE + p);
    ok(new URL(alice.url()).pathname === "/pending", `pending tenant opening ${p} is held at /pending`);
  }

  const bob = await (await ctx()).newPage();
  t = now();
  await signUp(bob, { name: "Bob Resident", email: "bob@marq.test", unit: "702", room: "C", floor: "7" });
  await bob.goto(await linkFor("bob@marq.test", t));
  await bob.waitForURL("**/pending");

  // Duplicate sign-up is refused without creating a second account.
  await anon.goto(BASE + "/signup");
  await anon.fill("#f-fullName", "Alice Again");
  await anon.fill("#f-email", "alice@marq.test");
  await anon.fill("#f-password", "marq-pass-1");
  await anon.fill("#f-unit", "1204");
  await anon.fill("#f-roomLetter", "B");
  await anon.fill("#f-floor", "12");
  await anon.click("button[type=submit]");
  await anon.waitForTimeout(1500);
  ok(sql("select count(*) from public.profiles where email='alice@marq.test'") === "1", "duplicate sign-up doesn't create a second profile");

  // --- Sam reviews ---------------------------------------------------------------
  await sam.goto(BASE + "/staff/approvals");
  const nav = await sam.getByRole("link", { name: /Approvals/ }).innerText();
  ok(nav.includes("2"), "Approvals tab shows pending count (2)");
  await sam.screenshot({ path: `${SHOTS}/06-approvals.png`, fullPage: true });
  const aliceCard = sam.locator("li", { hasText: "alice@marq.test" });
  ok(await aliceCard.getByText("1204B · Floor 12").isVisible(), "approval card shows unit, room and floor");
  await aliceCard.getByRole("button", { name: "Approve" }).click();
  await sam.locator("li", { hasText: "alice@marq.test" }).waitFor({ state: "detached" });
  const bobCard = sam.locator("li", { hasText: "bob@marq.test" });
  await bobCard.locator("input[name=note]").fill("Unit 702C is not on a current lease");
  await bobCard.getByRole("button", { name: "Reject" }).click();
  await sam.getByText("No one is waiting").waitFor();
  ok(true, "approval queue empties after approve + reject");
  ok(sql("select reviewed_by = (select id from public.profiles where email='sam@marq.test') from public.profiles where email='alice@marq.test'") === "t", "approval is attributed to the reviewing staff member");

  // --- Results for tenants -------------------------------------------------------
  await alice.goto(BASE + "/");
  await alice.waitForURL("**/home");
  ok(await alice.getByText("Hi Alice").isVisible(), "approved tenant reaches tenant home");
  ok(await alice.getByText("Unit 1204B · Floor 12").isVisible(), "tenant home shows their unit");
  await alice.screenshot({ path: `${SHOTS}/07-tenant-home.png`, fullPage: true });
  for (const p of ["/staff", "/staff/team", "/driver"]) {
    await alice.goto(BASE + p);
    ok(new URL(alice.url()).pathname === "/home", `tenant opening ${p} is sent to /home`);
  }

  await bob.goto(BASE + "/");
  await bob.waitForURL("**/pending");
  ok(await bob.getByText("We couldn't approve this account").isVisible(), "rejected tenant sees rejection");
  ok(await bob.getByText("Unit 702C is not on a current lease").isVisible(), "rejected tenant sees staff note");

  // --- Residents, suspend -------------------------------------------------------
  await sam.goto(BASE + "/staff/residents?q=alice");
  const row = sam.locator("li", { hasText: "alice@marq.test" });
  await row.getByRole("button", { name: "Suspend" }).click();
  await row.getByText("suspended").waitFor();
  await alice.goto(BASE + "/home");
  ok(new URL(alice.url()).pathname === "/pending" && (await alice.getByText("Account suspended").isVisible()), "suspended tenant loses access immediately");
  await sam.goto(BASE + "/staff/residents?q=alice");
  await sam.locator("li", { hasText: "alice@marq.test" }).getByRole("button", { name: "Reinstate" }).click();
  await sam.locator("li", { hasText: "alice@marq.test" }).getByRole("button", { name: "Suspend" }).waitFor();
  await alice.goto(BASE + "/");
  await alice.waitForURL("**/home");
  ok(true, "reinstated tenant regains access");

  // --- Sign out, sign in with next -----------------------------------------------
  await sam.getByRole("button", { name: "Sign out" }).click();
  await sam.waitForURL("**/login");
  await sam.goto(BASE + "/staff/residents");
  await sam.waitForURL("**/login?next=*");
  await signIn(sam, "sam@marq.test", "sam-pass-123", "/staff/residents");
  ok(new URL(sam.url()).pathname === "/staff/residents", "sign-in returns staff to the page they asked for");
  await anon.goto(BASE + "/login");
  await anon.fill("#f-email", "sam@marq.test");
  await anon.fill("#f-password", "wrong-password");
  await anon.click("button[type=submit]");
  await anon.getByText("Email or password is incorrect.").waitFor();
  ok(new URL(anon.url()).pathname === "/login", "wrong password shows a generic error and stays on login");

  // Open redirect attempt is ignored.
  const evil = await (await ctx()).newPage();
  await signIn(evil, "alice@marq.test", "marq-pass-1", "//evil.example/x");
  await evil.waitForURL("**/home");
  ok(new URL(evil.url()).host === "localhost:3000", "next=//evil.example is ignored after sign-in");

  // --- Password reset -----------------------------------------------------------
  const reset = await (await ctx()).newPage();
  await reset.goto(BASE + "/forgot-password");
  t = now();
  await reset.fill("#f-email", "alice@marq.test");
  await reset.click("button[type=submit]");
  await reset.getByText("a reset link is on its way").waitFor();
  await reset.goto(await linkFor("alice@marq.test", t));
  await reset.waitForURL("**/account/password");
  await reset.fill("#f-password", "new-alice-pass");
  await reset.fill("#f-confirm", "new-alice-pass");
  await Promise.all([reset.waitForURL("**/home"), reset.click("button[type=submit]")]);
  const fresh = await (await ctx()).newPage();
  await signIn(fresh, "alice@marq.test", "new-alice-pass");
  await fresh.waitForURL("**/home");
  ok(true, "password reset works end to end (new password signs in)");

  // --- Admin changes Sam to driver ---------------------------------------------
  await adaPage.goto(BASE + "/staff/team");
  const samRow = adaPage.locator("li", { hasText: "sam@marq.test" });
  await samRow.locator("select").selectOption("driver");
  await samRow.getByRole("button", { name: "Save" }).click();
  await adaPage.waitForTimeout(1000);
  ok(sql("select role from public.profiles where email='sam@marq.test'") === "driver", "admin changes a staff member to driver");
  await sam.goto(BASE + "/");
  await sam.waitForURL("**/driver");
  ok(true, "driver lands on the driver screen");
  await sam.goto(BASE + "/staff/approvals");
  ok(new URL(sam.url()).pathname === "/driver", "driver can't open staff pages");
  await sam.screenshot({ path: `${SHOTS}/08-driver.png` });
  ok(!(await adaPage.locator("li", { hasText: "ada@marq.test" }).locator("select").count()), "admin can't edit their own role in the UI");

  await browser.close();
  console.log(`\n${passed} end-to-end checks passed`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
