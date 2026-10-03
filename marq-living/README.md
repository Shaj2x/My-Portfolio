# Marq Living

Resident app and building-operations platform for **The Marq**, 75 Ann Street, London, Ontario.

- **Tenant app** (mobile-first PWA): shuttle tracking, announcements, front desk requests, amenity booking, laundry and EV charging.
- **Operations layer**: connects the app to the building's electrical monitoring, room controls, laundry machines, EV chargers and the shuttle. Bookings and schedules drive physical actions, and power, occupancy and charge data flow back. Every physical action is logged and has a manual override.

## Status

| Stage | Scope | State |
|---|---|---|
| 1 | Project structure, Supabase schema + RLS, auth, roles, tenant approval | **Done**: DB, unit and end-to-end tests pass |
| 2 | Shuttle tracking, delay/cancel alerts, run metrics | Next |
| 3 | Announcements, front desk tickets | Tables + RLS in place |
| 4 | Amenity booking | Tables + RLS in place |
| 5 | MQTT broker, Go ingestion, TimescaleDB, demo simulator | |
| 6 | Laundry availability, electrical monitoring dashboard | Tables + RLS in place |
| 7 | Automation engine, booking-driven room control | Tables + RLS in place |
| 8 | Forecasting, EV load management, shuttle electrification model | Tables + RLS in place |
| 9 | Staff operations dashboard, analytics, savings reporting | |
| 10 | Real ESP32 + CT clamp prototype on one circuit | |

## Layout

```
marq-living/
  web/                 Next.js 16 (App Router) + TypeScript + Tailwind 4, PWA
  supabase/
    migrations/        Postgres schema, RLS, triggers (applied in order)
    tests/             RLS test suite, runs on plain Postgres (no Docker)
    templates/         Auth email templates (confirm, invite, reset)
    seed.sql           Amenities, rooms, grid source. No user accounts.
    config.toml        Supabase CLI config for local development
  e2e/                 End-to-end test against real Supabase Auth + PostgREST
  # added in later stages:
  services/ingest/     Go: MQTT → validate/batch → TimescaleDB, device events → Supabase   (5)
  services/automation/ Go: rules engine, control commands over MQTT                      (7)
  analytics/           Python/FastAPI: forecasting, EV scheduling, shuttle energy model   (8)
  simulator/           Python: demo-mode devices, shuttle, laundry, EV, occupancy         (5)
  firmware/            ESP32 C++: CT clamps, PIR, relays, OTA, offline buffer             (10)
  infra/               Docker Compose: Mosquitto, TimescaleDB, Go + Python services       (5)
```

## Architecture decisions

**Two databases.** Supabase Postgres holds everything people work with: accounts, shuttle, announcements, tickets, bookings, the device registry, discrete device events, room state, rules, the command log, laundry/EV state and forecasts. High-rate sensor `readings` go to a separate **TimescaleDB** run by the Go ingestion service (stage 5). Supabase no longer offers the timescaledb extension on new Postgres 17 projects, and keeping several readings per second away from the app database protects its performance and Realtime. The Go service writes state changes and faults back to Supabase as `device_events`.

**`profiles` is the users table.** It has one row per `auth.users` row, created by a trigger at sign-up. Role and status are never taken from sign-up metadata: every self sign-up is a pending **tenant**.

**Staff, drivers and admins are invited.** An admin sends an invite from **Staff → Team**. The Auth admin API (service key only) sets `auth.users.invited_at`, and only then does the sign-up trigger trust `invited_role`. GoTrue sets `invited_at` in a second statement of the same transaction, so invite-claiming sign-ups are handled by a deferred trigger at commit (see `20261003000100_identity.sql`). The end-to-end test caught this.

**Who can change what.** RLS decides which rows each role can touch. A `before update` guard on `profiles` decides which columns:

| Action | Tenant | Staff | Admin |
|---|---|---|---|
| Edit own name, phone, alert prefs | ✓ | ✓ | ✓ |
| Change own unit after approval | front desk | | |
| Approve / reject / suspend tenants | | ✓ | ✓ |
| Review staff, drivers, admins | | | ✓ (not self) |
| Change roles | | | ✓ (not own) |

Tenants never see other tenants. They can't see each other's profiles, tickets, bookings, EV sessions, photos or read receipts. Amenity availability comes from `amenity_busy_periods()`, which returns only the busy time ranges. Pending, rejected and suspended accounts see nothing but their own profile.

**Safety.** The `control_commands` log is append-only from the app, and every command records its source (user, rule, schedule, scheduler, fail-safe, system). Rooms carry a manual `override_mode` that always beats automation. Firmware falls back to lights on and HVAC normal when it loses contact (stage 10). Monitoring uses non-invasive CT clamps only. Any relay switching of line-voltage loads must use rated, certified enclosures and be installed by a licensed electrician. Driver GPS points are visible only while a run is active and are purged when it ends (stage 2).

## Setup

### 1. Supabase project

Create a project for Marq Living, separate from any other app. Then, from `marq-living/`:

```sh
npx supabase link --project-ref <ref>
npx supabase db push                     # applies supabase/migrations
psql "<connection string>" -f supabase/seed.sql
```

In **Authentication → Email Templates**, paste the three templates from `supabase/templates/` (confirm signup, invite user, reset password). They send links to `/auth/confirm`, which works in any browser. Admin invites need this, because they can't use the PKCE code flow. In **Authentication → URL Configuration**, set the Site URL to the app's address.

### 2. Web app

```sh
cd web
cp .env.example .env.local   # fill in URL, publishable key, secret key
npm install
npm run dev
```

On Vercel, create a **new project** from this repo with **Root Directory = `marq-living/web`**. The repo root's `vercel.json` belongs to the portfolio site. Add the same env vars, with `NEXT_PUBLIC_SITE_URL` set to the deployed URL.

### 3. First admin

Sign up in the app like a tenant, confirm the email, then in the Supabase SQL editor run:

```sql
select public.bootstrap_admin('you@example.com');
```

From then on, invite staff, drivers and other admins from **Staff → Team**.

## Tests

| Layer | Command | What it covers |
|---|---|---|
| Database | `supabase/tests/run.sh` | Applies every migration and the seed to a throwaway Postgres, then 112 checks of sign-up, approval, role guards and RLS on every table as tenant, pending tenant, staff, driver, admin and anon |
| Web unit | `cd web && npm test` | Role routing, open-redirect protection, form validation |
| Web static | `npm run lint && npm run typecheck && npm run build` | |
| End to end | `e2e/run.sh` | Real GoTrue + PostgREST + the built app, driven by Playwright at phone size: sign up → confirm email → pending gate → admin bootstrap → invite staff → approve/reject → role routing → suspend/reinstate → password reset → role change. 37 checks, with screenshots in `e2e/.work/shots` |

The DB and e2e tests need Postgres 15+ server binaries. The e2e test also needs Go (to build GoTrue the first time) and Chromium. Set `CHROMIUM_PATH` to use an installed browser. CI runs all three: `.github/workflows/marq-living.yml`.

## Assumptions to confirm

- Unit numbers are 3–4 digits and room letters are A–F, matching the database checks. Floors run 1–40. Floor is entered separately and is not derived from the unit number.
- The tenant home shows the upcoming features as "Coming soon" until each stage ships.
