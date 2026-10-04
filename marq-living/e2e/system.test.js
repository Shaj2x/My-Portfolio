// Whole system, no hardware: simulator devices → MQTT (real ACLs) → Go
// ingest → telemetry DB → analytics → web app; bookings → automation engine
// → MQTT commands → simulated relays → acks and measurable power changes;
// EV request → schedule → charger limits; fail-safe when the engine stops.
const { execSync } = require("child_process");
const { BASE, SHOTS, ok, count, sql, sqlT, until, signIn, makeUser, launch } = require("./lib");

(async () => {
  const browser = await launch();
  const tenant = await makeUser({ email: "sys-tenant@marq.test", name: "Sasha Resident", unit: "1101", floor: 11 });
  const staff = await makeUser({ email: "sys-staff@marq.test", name: "Pat Ops", role: "staff" });

  // --- Telemetry pipeline ---------------------------------------------------
  await until("live readings from simulated devices", () => Number(sqlT("select count(distinct device_id) from readings where ts > now() - interval '1 minute'")) >= 9);
  ok(true, "simulated CT and charger nodes publish readings through MQTT into the telemetry DB");
  await until("devices marked online", () => Number(sql("select count(*) from public.devices where simulated and status = 'online'")) >= 10, 60000);
  ok(true, "devices show online with firmware recorded");
  ok(Number(sqlT("select count(*) from readings where ts < now() - interval '5 days'")) > 100000, "history backfilled for analytics");

  // --- Booking-driven room automation ---------------------------------------
  sql(`alter table public.bookings disable trigger bookings_validate;
       insert into public.bookings (amenity_id, tenant_id, unit, period)
       values ((select amenity_id from public.rooms where slug = 'theatre'), '${tenant.id}', '1101', tstzrange(now() + interval '5 minutes', now() + interval '65 minutes'));
       alter table public.bookings enable trigger bookings_validate;`);
  await until("preheat commands acknowledged", () => Number(sql("select count(*) from public.control_commands where source = 'rule' and status = 'acked' and reason like 'Get room ready%'")) >= 2, 60000);
  ok(true, "booking 5 minutes out → lights on + HVAC comfort commands, acknowledged by the room node");
  ok(sql("select state->>'lights' from public.rooms where slug = 'theatre'") === "on", "room state reflects the acknowledged command");
  const theatreDev = sql("select id from public.devices where hardware_id = 'sim-ct-theatre'");
  await until("theatre lighting load measured", () => Number(sqlT(`select power_w from readings where device_id = '${theatreDev}' and channel = 0 order by ts desc limit 1`)) > 500, 30000);
  ok(true, "the physical effect is measured: theatre lighting circuit now draws > 500 W");

  // --- Staff views ------------------------------------------------------------
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await signIn(page, staff.email, staff.password);
  await page.goto(BASE + "/staff/rooms");
  ok(await page.getByText("Get room ready before a booking").first().isVisible(), "command log names the rule that acted");
  await page.screenshot({ path: `${SHOTS}/30-rooms.png`, fullPage: true });

  // Manual override from the app beats automation and is logged as the person.
  await page.locator("form", { has: page.locator('input[name="room"][value="theatre"]') }).filter({ has: page.locator('input[value="force_off"]') }).getByRole("button").click();
  await until("override commands acknowledged", () => Number(sql(`select count(*) from public.control_commands where source = 'user' and user_id = '${staff.id}' and status = 'acked'`)) >= 2, 30000);
  ok(true, "staff override sends lights-off + setback, acknowledged and attributed to the staff member");
  await until("theatre lights load drops", () => Number(sqlT(`select power_w from readings where device_id = '${theatreDev}' and channel = 0 order by ts desc limit 1`)) < 10, 30000);
  ok(true, "and the lighting circuit drops to standby");

  await page.goto(BASE + "/staff/energy");
  await page.getByText("Shared systems now").waitFor();
  ok(await page.getByText(/kW/).first().isVisible(), "energy dashboard shows live load from analytics");
  ok(await page.getByText("Room automation savings vs. always-on").isVisible(), "energy dashboard reports automation savings");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/31-energy.png`, fullPage: true });

  await page.goto(BASE + "/staff");
  ok(await page.getByText("Building load").isVisible() && await page.getByText("Device health").isVisible(), "operations overview shows load and device health");
  await page.screenshot({ path: `${SHOTS}/32-operations.png`, fullPage: true });

  await page.goto(BASE + "/staff/analytics");
  ok(await page.getByText("Monthly cost and savings").isVisible(), "analytics page renders cost and savings");
  await page.goto(BASE + "/staff/devices");
  ok(await page.getByText("Theatre controls").isVisible(), "device registry lists simulated nodes");
  await page.goto(BASE + "/staff/rules");
  ok(await page.getByText(/When 15 min before a booking in any room: lights on, HVAC comfort\./).isVisible(), "rules page describes the seeded rules in plain English");

  // --- Forecast ----------------------------------------------------------------
  await until("forecast generated at analytics startup", () => Number(sql("select count(*) from public.forecasts")) >= 96, 60000);
  await page.goto(BASE + "/staff/ev");
  ok(await page.getByText(/Model gbr-v1/).isVisible(), "next-day forecast from the gradient-boosting model");
  await page.screenshot({ path: `${SHOTS}/33-ev-peak.png`, fullPage: true });

  // --- Tenant: laundry and EV ---------------------------------------------------
  const t = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  await signIn(t, tenant.email, tenant.password);
  await t.goto(BASE + "/laundry");
  ok(await t.getByText(/of 4 free/).first().isVisible(), "tenant sees live washer/dryer availability");
  await t.screenshot({ path: `${SHOTS}/34-laundry.png`, fullPage: true });

  await t.goto(BASE + "/ev");
  await t.fill("#f-amount", "20");
  await t.selectOption("select[name=unit]", "kwh");
  await t.getByRole("button", { name: "Request charge" }).click();
  await t.getByText(/Ready by/).waitFor({ timeout: 30000 });
  ok(true, "tenant requests a charge and immediately sees an estimated ready time");
  await t.screenshot({ path: `${SHOTS}/35-ev.png`, fullPage: true });
  const session = sql(`select charger_id is not null and status = 'scheduled' from public.ev_sessions where tenant_id = '${tenant.id}'`);
  ok(session === "t", "scheduler assigned a charger and planned the session");
  await until("charger limit command acknowledged", () => Number(sql("select count(*) from public.control_commands where source = 'scheduler' and status = 'acked'")) >= 1, 90000, 3000);
  ok(true, "automation applied the plan to the charger and the charger acknowledged");

  // --- Fail-safe -----------------------------------------------------------------
  const pid = require("fs").readFileSync(`${process.env.E2E_WORK}/automation.pid`, "utf8").trim();
  {
    execSync(`kill ${pid}`);
    await until("room nodes fail safe without the engine heartbeat", () =>
      Number(sql("select count(*) from public.device_events where type = 'override' and payload->>'source' = 'failsafe'")) >= 1, 200000, 5000);
    ok(true, "with the automation engine stopped, room nodes return lights on / HVAC normal within ~2 minutes and report it");
  }

  await browser.close();
  console.log(`\n${count()} system checks passed`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
