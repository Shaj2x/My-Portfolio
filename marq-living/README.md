# Marq Living

Resident app and building-operations platform for **The Marq**, 75 Ann Street, London, Ontario.

- **Tenant app** (mobile-first PWA): live shuttle map with ETAs and delay alerts, announcements for your floor or unit, front desk requests, theatre and game room booking, laundry availability, and EV charge requests.
- **Operations layer**: CT clamps, occupancy sensors, room relays, laundry machines, EV chargers and the shuttle, all connected over MQTT. Bookings and schedules drive physical actions (lights, HVAC, charger limits). Power, occupancy and charge data flow back for dashboards, forecasting, savings reporting and fault detection. Every physical action is logged with who or what caused it, can be overridden by staff, and has a fail-safe.

## What's built

| Stage | Scope | Where |
|---|---|---|
| 1 | Auth, roles, tenant approval, schema with RLS | `supabase/`, `web/` |
| 2 | Shuttle: driver Start/End Run with GPS every 5–10 s, live tenant map and stop ETAs, next departure, delay/cancel push + banner, late-run staff alerts, timetable with holiday exceptions, run metrics with the GPS trail purged | `web/src/app/driver`, `(tenant)/shuttle`, `staff/shuttle` |
| 3 | Announcements (building/floors/units, categories, urgent push, scheduled, read tracking); front desk tickets (photos, threads, internal notes); device faults auto-open tickets and laundry "out of service" posts | `(tenant)/announcements`, `(tenant)/requests`, `staff/announcements`, `staff/tickets` |
| 4 | Amenity booking with rules enforced in the database (hours, length, notice, window, weekly per-unit limit, blackouts, buffer); confirmations and reminders | `(tenant)/book`, `staff/amenities` |
| 5 | MQTT protocol, Mosquitto with per-device ACLs, Go ingest service, TimescaleDB, demo simulator | `docs/mqtt-protocol.md`, `infra/`, `services/`, `simulator/` |
| 6 | Laundry availability from power signatures + "notify me"; energy monitoring dashboard; anomaly detection | `(tenant)/laundry`, `staff/energy`, `services/internal/laundry`, `analytics/` |
| 7 | Automation engine: booking-driven lights/HVAC, wait-for-empty power-down, unbooked-use alerts, manual override, fail-safe heartbeat, energy per booking | `services/cmd/automation`, `staff/rooms` |
| 8 | Next-day load forecast (15-min), EV charge scheduling under the peak limit with Ontario TOU/ULO prices, live peak guard, shuttle electrification model and charge planning | `analytics/`, `(tenant)/ev`, `staff/ev`, `staff/shuttle` |
| 9 | Live operations overview, analytics (on-time rate, resolution time, usage, cost, savings, carbon), device management with calibration, rule editor | `staff/`, `staff/analytics`, `staff/devices`, `staff/rules` |
| 10 | ESP32 firmware for CT and room nodes, plus the single-circuit prototype plan | `firmware/` |

## Layout

```
marq-living/
  web/            Next.js 16 PWA (tenant, driver, staff). Deploy to Vercel.
  supabase/       Migrations, RLS, triggers, seed, auth email templates, DB tests
  services/       Go: cmd/ingest (MQTT → TimescaleDB + app DB), cmd/automation (rules → MQTT commands)
  analytics/      Python FastAPI: energy reporting, forecast, EV scheduler, shuttle model, anomalies
  simulator/      Python: every device simulated, closed loop with commands; history backfill
  firmware/       ESP32 (PlatformIO): CT node and room node; host-tested core
  infra/          Docker Compose: Mosquitto (ACLs), TimescaleDB, ingest, automation, analytics, simulator
  docs/           MQTT protocol
  e2e/            Docker-free end-to-end tests (GoTrue, PostgREST, broker, services, simulator, Playwright)
  scripts/        Type generation, throwaway test databases
```

## How it fits together

```
 ESP32 nodes / simulator ──MQTT──► Mosquitto ──► ingest (Go) ──► TimescaleDB (readings, metrics)
        ▲                              │             │
        │ cmd + heartbeat               │             └──► Supabase: device presence, events, laundry state
        │                              ▼                     (triggers → tickets, announcements, notifications)
        └──────────── automation (Go) ◄── rules, rooms, bookings, EV plans (Supabase)
                         │    every physical action = a control_commands row, acknowledged by the device
                         └──► web /api/cron/tick each minute (maintenance + push/email delivery)

 analytics (Python) ◄── TimescaleDB + Supabase ──► forecasts, EV plans, anomalies, energy/savings API
 web (Next.js) ◄──► Supabase (Auth, Postgres + RLS, Realtime, Storage) and the analytics API (server-side)
```

## Architecture decisions

**Two databases.** Supabase Postgres holds what people work with: accounts, shuttle, announcements, tickets, bookings, the device registry, device events, room state, rules, the command log, laundry and EV state, and forecasts. High-rate readings live in **TimescaleDB** (a 15-minute continuous aggregate, compression, and retention). Supabase no longer offers the extension on new projects, and this keeps sensor volume away from the app database and Realtime. The web app reads time-series only through the analytics API.

**Database as the source of truth for rules people rely on.** Booking rules, run lifecycle (drivers act only through `start_run`/`end_run`/`delay_run`/`cancel_run`), announcement targeting, ticket and fault workflows, notifications, and RLS are all enforced in Postgres. Every client therefore gets the same behaviour.

**Accounts.** Every self sign-up is a pending tenant. Staff, drivers and admins join only by admin invite, which is trusted via `auth.users.invited_at`, read in a deferred trigger because GoTrue sets it after the insert. A column guard limits who can change roles, status and units. Tenants never see other tenants' data. Availability comes from functions that return only busy times or charger counts.

**Notifications.** One `notifications` table feeds in-app banners (live over Realtime), web push (VAPID) and email (Resend). Database triggers and services create rows; the web app delivers them right after the action, and on the once-a-minute tick.

**Automation.** Rules are data (`automation_rules`), edited in the app and validated identically in TypeScript and Go. The engine fires each trigger once, can wait for conditions ("booking ended → wait until no motion for 10 minutes"), respects cooldowns and price periods, and never overrides a manual override.

**Safety.** Monitoring uses non-invasive CT clamps. Switching goes through certified contactors in rated enclosures, installed by a licensed electrician. Lights sit on normally-closed contacts, so a dead node leaves them on. Nodes also fail safe in software if the engine's heartbeat stops for 120 s; the system test verifies this. Overrides (app or physical switch) always win. The command log is append-only from the app. Driver GPS is visible only during a run and deleted when it ends.

**Energy pricing.** Ontario RPP TOU and ULO prices (OEB, effective 1 Nov 2024) with Ontario holidays, in `analytics/marq_analytics/tariffs.py` and `services/internal/tariff` (the two are kept in step by mirrored tests). Prices change every 1 November, so check them against oeb.ca. A building on a commercial rate should replace them with its own tariff.

**Future sources.** The EV scheduler plans against headroom from `energy_sources`: the grid limit today, plus a battery or solar array once one is registered.

## Setup

### 1. Supabase

Create a project, then from `marq-living/`:

```sh
npx supabase link --project-ref <ref>
npx supabase db push
psql "<connection string>" -f supabase/seed.sql      # amenities, rooms, default rules, PLACEHOLDER shuttle route
```

- **Authentication → Email Templates:** paste `supabase/templates/*` (confirm, invite, reset). Links go to `/auth/confirm`, which admin invites require.
- **URL Configuration:** set the Site URL to the app's address.
- **Realtime:** the migrations add the needed tables to `supabase_realtime`. **pg_cron** runs maintenance every minute if the extension is available.
- **First admin:** sign up in the app, then run `select public.bootstrap_admin('you@example.com');`.

### 2. Web app (Vercel)

Create a new Vercel project with **Root Directory `marq-living/web`**. The repo root's `vercel.json` is the portfolio site's. Set the variables in `web/.env.example`:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Supabase |
| `NEXT_PUBLIC_SITE_URL` | Links in emails |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web push (`npx web-push generate-vapid-keys`) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email (optional) |
| `CRON_SECRET`, `INTERNAL_API_SECRET` | Tick and service-to-app calls |
| `ANALYTICS_URL`, `ANALYTICS_API_KEY` | Analytics API (server-side only) |
| `NEXT_PUBLIC_MAP_TILE_URL` | Map tiles (OpenStreetMap by default; use Mapbox or MapTiler in production) |

### 3. Building stack (on-site server or VM)

```sh
cd infra
cp .env.example .env                    # Supabase DB URL, secrets, app URL
./mosquitto/make-passwords.sh            # service accounts; add one per device later
docker compose up -d                     # broker, TimescaleDB, ingest, automation, analytics
docker compose --profile demo up -d      # + simulator (demo without hardware)
docker compose run --rm simulator seed   # register the demo devices
docker compose run --rm simulator backfill --days 28   # history for the forecast and savings
```

Expose the analytics API to the web app over HTTPS, for example with a reverse proxy or tunnel, with `ANALYTICS_API_KEY` set. The automation engine calls the web app's `/api/cron/tick` every minute, so Vercel Cron isn't required.

### 4. Hardware

See [firmware/README.md](firmware/README.md): bill of materials, wiring, safety, calibration, and the **stage 10 prototype checklist** for proving one real CT node on one circuit end to end.

## Tests

| Layer | Command | Covers |
|---|---|---|
| Database | `supabase/tests/run.sh` | 198 checks: sign-up and approval, RLS on every table as every role, run lifecycle and metrics, notifications, announcement delivery, tickets, device faults, booking rules, maintenance, EV requests, analytics helpers |
| Web unit | `cd web && npm test` | 41 tests: role routing, validation, ETAs, timezone handling, booking picker, rule schema |
| Web static | `npm run lint && npm run typecheck && npm run build` | |
| Go | `cd services && go test ./... && ./test-integration.sh` | Payload validation, calibration, laundry classifier, anomalies, rules engine, tariffs. Integration tests use a real embedded MQTT broker and the app database with every migration (ingest pipeline, automation loop, EV peak guard). |
| Python | `cd simulator && pytest`, `scripts/with-test-db.sh sh -c 'cd analytics && pytest'` | Physical models; tariffs and holidays; EV scheduler (deadline, cost, peak limit); forecast accuracy; shuttle model; and energy, forecast, EV, anomaly jobs on real databases |
| Firmware | `make -C firmware/test/host` | 38 checks on RMS current, energy counter (incl. `millis()` wrap), offline buffer, fail-safe, manual override, payloads |
| End to end | `e2e/run.sh` | Real GoTrue + PostgREST + Mosquitto (ACLs) + Go services + analytics + simulator + the built app, driven by Playwright: **37** auth checks, **34** tenant/staff feature checks, and **21** whole-system checks. The system checks cover a booking switching on a room, the measured load change, a staff override, EV scheduling to charger acknowledgement, and the fail-safe when the engine stops. |

CI (`.github/workflows/marq-living.yml`) runs all of these and compiles both firmware builds. Firmware compilation needs the PlatformIO registry, which this development environment's network policy blocks, so CI is where it is verified.

## Things to confirm before go-live

- **Shuttle route and timetable.** The seed has a placeholder Western Campus loop. Replace the stops, coordinates and departures in **Staff → Shuttle**.
- **Units and floors.** Unit numbers are assumed to be 3–4 digits, room letters A–F, and floors 1–40, entered separately.
- **Electricity tariff and peak limit.** The grid source is seeded at 150 kW, and prices are RPP TOU/ULO. Set the real contracted demand limit and rate.
- **Device inventory.** Register the real nodes (hardware IDs = MQTT usernames), link laundry machines and chargers, and calibrate each channel against a clamp meter.
