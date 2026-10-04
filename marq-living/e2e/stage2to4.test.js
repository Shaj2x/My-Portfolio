// Stages 2–4 end to end: shuttle run with live GPS, delay alerts, metrics and
// purge; targeted announcements and read tracking; front desk tickets;
// amenity booking; maintenance tick; device fault → ticket + announcement.
const { BASE, SHOTS, ok, count, sql, signIn, makeUser, launch, mobile, timeLabel } = require("./lib");

(async () => {
  const browser = await launch();
  const tia = await makeUser({ email: "tia@marq.test", name: "Tia Tenant", unit: "901", floor: 9 });
  const uma = await makeUser({ email: "uma@marq.test", name: "Uma Tenant", unit: "301", room: "B", floor: 3 });
  const stan = await makeUser({ email: "stan@marq.test", name: "Stan Staff", role: "staff" });
  const drew = await makeUser({ email: "drew@marq.test", name: "Drew Driver", role: "driver" });

  const ctx = async (extra = {}) => browser.newContext({ ...mobile, ...extra });
  const tiaP = await (await ctx()).newPage();
  const umaP = await (await ctx()).newPage();
  const stanP = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  const drewCtx = await ctx({ geolocation: { latitude: 42.99198, longitude: -81.25104, accuracy: 8 }, permissions: ["geolocation"] });
  const drewP = await drewCtx.newPage();
  await signIn(tiaP, tia.email, tia.password);
  await signIn(umaP, uma.email, uma.password);
  await signIn(stanP, stan.email, stan.password);
  await signIn(drewP, drew.email, drew.password);

  // --- Settings: Uma opts out of shuttle alerts ------------------------------
  await umaP.goto(BASE + "/settings");
  await umaP.uncheck("input[name=shuttle_alerts]");
  await umaP.click("text=Save");
  await umaP.waitForTimeout(800);
  ok(sql(`select shuttle_alerts from public.profiles where id = '${uma.id}'`) === "f", "tenant turns off shuttle alerts in settings");

  // --- Shuttle ---------------------------------------------------------------
  const runId = sql(`insert into public.runs (route_id, service_date, scheduled_departure)
    values ('5e000000-0000-0000-0000-000000000001', (now() at time zone 'America/Toronto')::date, date_trunc('minute', now()) + interval '2 min') returning id`).split("\n")[0];
  const departs = new Date(sql(`select to_char(scheduled_departure at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') from public.runs where id = '${runId}'`));

  await tiaP.goto(BASE + "/shuttle");
  ok(await tiaP.getByText("No shuttle on the road right now.").isVisible(), "tenant sees no active run");
  ok(await tiaP.getByText(/Next departure/).isVisible(), "tenant sees the next scheduled departure");

  await drewP.goto(BASE + "/driver");
  const row = drewP.locator("li", { hasText: timeLabel(departs) }).first();
  await row.getByRole("button", { name: "Start run" }).click();
  await drewP.getByText("Run in progress").waitFor();
  ok(sql(`select status from public.runs where id = '${runId}'`) === "active", "driver starts the run");

  // Drive toward the second stop.
  const path = [[42.99198, -81.25104], [42.9945, -81.2519], [42.9965, -81.2526], [42.99853, -81.25318]];
  for (const [lat, lng] of path) {
    await drewCtx.setGeolocation({ latitude: lat, longitude: lng, accuracy: 8 });
    await drewP.waitForTimeout(5600);
  }
  const fixes = Number(sql(`select count(*) from public.shuttle_locations where run_id = '${runId}'`));
  ok(fixes >= 3, `driver phone shares GPS every ~5–10 s (${fixes} fixes)`);
  ok(await drewP.getByText(/Sharing · \d+ sent/).isVisible(), "driver sees sharing status");
  await drewP.screenshot({ path: `${SHOTS}/20-driver-active.png` });

  await tiaP.goto(BASE + "/shuttle");
  await tiaP.getByText("Live", { exact: true }).waitFor();
  ok(await tiaP.getByText("Western — UCC").isVisible(), "tenant sees ETAs for upcoming stops");
  await tiaP.waitForTimeout(1500); // map tiles
  await tiaP.screenshot({ path: `${SHOTS}/21-tenant-shuttle-live.png`, fullPage: true });

  // Delay → alert for opted-in tenants only.
  await drewP.getByRole("button", { name: "Delayed" }).click();
  await drewP.getByRole("button", { name: "10 min" }).click();
  await drewP.getByRole("button", { name: "Send" }).click();
  await drewP.getByText("Tenants told you're 10 min late.").waitFor();
  await tiaP.goto(BASE + "/home");
  ok(await tiaP.getByRole("alert").getByText("Shuttle delayed 10 min").isVisible(), "opted-in tenant gets the delay banner");
  await tiaP.screenshot({ path: `${SHOTS}/22-delay-banner.png` });
  await umaP.goto(BASE + "/home");
  ok(!(await umaP.getByText("Shuttle delayed 10 min").count()), "opted-out tenant gets no delay alert");
  await tiaP.getByRole("button", { name: "Dismiss alert" }).click();
  await tiaP.waitForTimeout(800);
  ok(sql(`select count(*) from public.notifications where user_id = '${tia.id}' and kind = 'shuttle_delay' and read_at is null`) === "0", "dismissing the banner marks it read");

  await drewP.getByRole("button", { name: "End run" }).click();
  await drewP.getByText("Run ended. Location sharing stopped.").waitFor();
  ok(sql(`select count(*) from public.shuttle_locations where run_id = '${runId}'`) === "0", "GPS trail purged when the run ends");
  const m = sql(`select distance_km, stop_count from public.shuttle_run_metrics where run_id = '${runId}'`).split("|");
  ok(Number(m[0]) > 0.5 && Number(m[0]) < 1.0 && Number(m[1]) === 2, `run metrics logged (${m[0]} km, ${m[1]} stops)`);

  await stanP.goto(BASE + "/staff/shuttle");
  ok(await stanP.getByText("Recent run metrics").isVisible(), "staff see the shuttle board and run metrics");
  await stanP.fill("input[name=service_date]", sql(`select ((now() at time zone 'America/Toronto')::date + 30)::text`));
  await stanP.fill("input[name=note]", "Thanksgiving");
  await stanP.getByRole("button", { name: "Add", exact: true }).click();
  await stanP.getByText(/no service · All routes · Thanksgiving/).waitFor();
  ok(true, "staff add a holiday with no service");
  await stanP.screenshot({ path: `${SHOTS}/23-staff-shuttle.png`, fullPage: true });

  // --- Announcements ---------------------------------------------------------
  await stanP.goto(BASE + "/staff/announcements");
  await stanP.fill("#f-title", "Floor 9 water shutoff");
  await stanP.fill("#body", "Water off 10–11am Thursday for a valve repair.");
  await stanP.selectOption("select[name=category]", "maintenance");
  await stanP.selectOption("select[name=audience]", "floors");
  await stanP.fill("#f-floors", "9");
  await stanP.check("input[name=urgent]");
  await stanP.getByRole("button", { name: "Post" }).click();
  await stanP.getByText("Posted and pushed.").waitFor();
  ok(true, "staff post an urgent floor-targeted announcement");

  await tiaP.goto(BASE + "/announcements");
  ok(await tiaP.getByRole("heading", { name: "Floor 9 water shutoff" }).isVisible(), "floor 9 tenant sees it");
  await umaP.goto(BASE + "/announcements");
  ok(!(await umaP.getByText("Floor 9 water shutoff").count()), "floor 3 tenant doesn't");
  await tiaP.waitForTimeout(800);
  await stanP.goto(BASE + "/staff/announcements");
  ok(await stanP.getByText(/Read by 1 of 1 \(100%\)/).first().isVisible(), "staff see read tracking");

  // Scheduled post isn't visible until it's due.
  sql(`insert into public.announcements (title, body, publish_at) values ('Future party', 'Soon', now() + interval '1 day')`);
  await tiaP.goto(BASE + "/announcements");
  ok(!(await tiaP.getByText("Future party").count()), "scheduled post is hidden until publish time");

  // --- Tickets ---------------------------------------------------------------
  await tiaP.goto(BASE + "/requests/new");
  await tiaP.selectOption("#category", "maintenance");
  await tiaP.fill("#f-subject", "Bathroom fan not working");
  await tiaP.fill("#description", "Makes a grinding noise then stops.");
  await Promise.all([tiaP.waitForURL(/\/requests\/[0-9a-f-]{36}$/), tiaP.getByRole("button", { name: "Send to front desk" }).click()]);
  const ticketUrl = tiaP.url();
  ok(true, "tenant opens a request");

  await stanP.goto(BASE + "/staff/tickets");
  await stanP.getByText("Bathroom fan not working").click();
  await stanP.waitForURL(/\/staff\/tickets\//);
  ok(await stanP.getByText("Tia Tenant").isVisible(), "staff see who sent it");
  await stanP.fill("#reply", "Maintenance will come by tomorrow morning.");
  await stanP.getByRole("button", { name: "Send" }).click();
  await stanP.getByText("Maintenance will come by tomorrow morning.").waitFor();
  await stanP.fill("#reply", "Fan replaced last year too.");
  await stanP.check("input[name=internal]");
  await stanP.getByRole("button", { name: "Send" }).click();
  await stanP.getByText("Fan replaced last year too.").waitFor();
  await stanP.selectOption("select[name=status]", "in_progress");
  await stanP.getByRole("button", { name: "Save" }).click();
  await stanP.waitForTimeout(800);

  await tiaP.goto(ticketUrl);
  ok(await tiaP.getByText("Maintenance will come by tomorrow morning.").isVisible(), "tenant sees the staff reply");
  ok(!(await tiaP.getByText("Fan replaced last year too.").count()), "tenant doesn't see the internal note");
  ok(await tiaP.getByText("In progress").isVisible(), "tenant sees status");
  await tiaP.screenshot({ path: `${SHOTS}/24-ticket.png`, fullPage: true });
  await umaP.goto(ticketUrl);
  ok(await umaP.getByText("404").or(umaP.getByText("could not be found")).first().isVisible(), "another tenant can't open it");

  // --- Booking ---------------------------------------------------------------
  const tomorrow = sql(`select ((now() at time zone 'America/Toronto')::date + 1)::text`);
  await tiaP.goto(`${BASE}/book?room=game-room&date=${tomorrow}`);
  await tiaP.getByRole("button", { name: "1 h", exact: true }).click();
  const first = tiaP.getByRole("radio").first();
  const slot = await first.innerText();
  await first.click();
  await tiaP.getByRole("button", { name: /^Book / }).click();
  await tiaP.getByText(/Booked Game Room/).waitFor();
  await tiaP.getByText("Your bookings").waitFor();
  ok(true, `tenant books the game room at ${slot}`);
  await tiaP.screenshot({ path: `${SHOTS}/25-booking.png`, fullPage: true });
  ok(sql(`select count(*) from public.notifications where user_id = '${tia.id}' and kind = 'booking_confirmed'`) === "1", "booking confirmation queued (push + email)");

  await umaP.goto(`${BASE}/book?room=game-room&date=${tomorrow}`);
  await umaP.getByRole("button", { name: "1 h", exact: true }).click();
  ok(!(await umaP.getByRole("radio", { name: slot, exact: true }).count()), "the booked slot isn't offered to others");

  await tiaP.goto(`${BASE}/book?room=game-room&date=${tomorrow}`);
  await tiaP.getByRole("button", { name: "Cancel" }).first().click();
  await tiaP.waitForTimeout(800);
  ok(sql(`select status from public.bookings where tenant_id = '${tia.id}' order by created_at desc limit 1`) === "cancelled", "tenant cancels their booking");

  // --- Maintenance tick ------------------------------------------------------
  const noAuth = await fetch(`${BASE}/api/cron/tick`);
  ok(noAuth.status === 401, "tick requires the cron secret");
  const tick = await fetch(`${BASE}/api/cron/tick`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  const body = await tick.json();
  ok(tick.ok && typeof body.maintenance.runs_created === "number", "tick runs maintenance and delivery");
  ok(sql(`select count(*) from public.notifications where send_push and push_sent_at is null`) === "0", "pending pushes are claimed by the dispatcher");

  // --- Device fault → ticket + laundry announcement ---------------------------
  sql(`insert into public.devices (id, hardware_id, name, type, location) values ('6e000000-0000-0000-0000-000000000001', 'ct-laundry-e2e', 'Laundry CT', 'ct_node', 'Laundry room');
       insert into public.laundry_machines (label, kind, device_id, channel, state) values ('Dryer 2', 'dryer', '6e000000-0000-0000-0000-000000000001', 1, 'idle');
       insert into public.device_events (device_id, type, payload) values ('6e000000-0000-0000-0000-000000000001', 'fault', '{"channel":1,"message":"Heating element drawing 0 W"}');`);
  await stanP.goto(BASE + "/staff/tickets");
  ok(await stanP.getByText("Laundry CT: fault").isVisible(), "device fault opened a system ticket");
  await umaP.goto(BASE + "/announcements");
  ok(await umaP.getByRole("heading", { name: "Dryer 2 is out of service" }).isVisible(), "tenants see the automatic out-of-service post");

  await browser.close();
  console.log(`\n${count()} stage 2–4 checks passed`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
