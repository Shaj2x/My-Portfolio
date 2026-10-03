-- Marq Living — building operations metadata.
--
-- High-rate sensor readings do NOT live here: they go to the TimescaleDB
-- `readings` hypertable owned by the Go ingestion service (stage 5). Supabase
-- holds what the app and staff work with: the device registry, discrete
-- device events, room state, automation rules, the control-command log,
-- laundry and EV state, and forecasts.
--
-- The Go and Python services write with the service role (bypasses RLS).
-- Staff read; admins manage devices and rules.

create type public.device_type as enum (
  'ct_node',          -- ESP32 + SCT-013 clamps; one node may have several channels
  'pir',              -- occupancy sensor
  'relay',            -- lighting relay module
  'thermostat',       -- smart thermostat (API) or relay-driven HVAC
  'ev_charger',       -- OCPP 1.6 charge point
  'shuttle_telematics',
  'gateway'
);
create type public.device_status as enum ('provisioning', 'online', 'offline', 'fault', 'retired');
create type public.device_event_type as enum ('state_change', 'fault', 'anomaly', 'offline', 'online', 'override');

create table public.devices (
  id                uuid primary key default gen_random_uuid(),
  -- MQTT client id / topic segment, e.g. "ct-laundry-01". Stable across reflashes.
  hardware_id       text not null unique check (hardware_id ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name              text not null,
  type              public.device_type not null,
  location          text not null,
  -- Electrical circuit / panel position, e.g. "Panel B, breaker 14".
  circuit           text,
  room_id           uuid,  -- FK below, rooms defined after
  status            public.device_status not null default 'provisioning',
  firmware_version  text,
  battery_pct       smallint check (battery_pct between 0 and 100),
  rssi_dbm          smallint,
  last_seen         timestamptz,
  -- Per-channel calibration, e.g. {"channels": {"0": {"ratio": 30.0, "offset_a": 0.02, "voltage": 120}}}
  calibration       jsonb not null default '{}'::jsonb,
  -- Free-form config: channel labels, expected operating hours, OCPP id, etc.
  config            jsonb not null default '{}'::jsonb,
  -- Simulated devices (demo mode) are flagged so reports can exclude them.
  simulated         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index devices_type_idx on public.devices (type);

create table public.device_events (
  id           bigint generated always as identity primary key,
  device_id    uuid not null references public.devices (id) on delete cascade,
  type         public.device_event_type not null,
  -- e.g. {"channel": 2, "from": "running", "to": "finishing", "power_w": 180}
  payload      jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now(),
  -- Set when the app has turned this into a ticket / announcement.
  ticket_id    uuid references public.tickets (id) on delete set null,
  announcement_id uuid references public.announcements (id) on delete set null,
  acknowledged_by uuid references public.profiles (id) on delete set null,
  acknowledged_at timestamptz
);
create index device_events_device_idx on public.device_events (device_id, occurred_at desc);
create index device_events_open_faults_idx on public.device_events (occurred_at desc)
  where type in ('fault', 'anomaly') and acknowledged_at is null;

alter table public.tickets
  add constraint tickets_device_fk foreign key (device_id) references public.devices (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Rooms (automated shared spaces)
-- ---------------------------------------------------------------------------

create type public.override_mode as enum ('auto', 'force_on', 'force_off');

create table public.rooms (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name            text not null,
  amenity_id      uuid references public.amenities (id) on delete set null,
  device_ids      uuid[] not null default '{}',
  -- {"comfort_c": 21.5, "setback_c": 17, "preheat_minutes": 15}
  hvac_setpoints  jsonb not null default '{"comfort_c": 21.5, "setback_c": 17, "preheat_minutes": 15}'::jsonb,
  -- Manual override always wins over automation. Fail-safe default is
  -- lights on / HVAC normal (enforced in firmware when the system is offline).
  override_mode   public.override_mode not null default 'auto',
  override_until  timestamptz,
  override_by     uuid references public.profiles (id) on delete set null,
  -- Last known state, written by the automation engine:
  -- {"lights": "on", "hvac_mode": "comfort", "occupied": true, "since": "..."}
  state           jsonb not null default '{}'::jsonb,
  -- Old always-on draw, used to report savings per booking.
  baseline_kw     numeric(6, 3),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.devices
  add constraint devices_room_fk foreign key (room_id) references public.rooms (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Automation rules and the control-command log
-- ---------------------------------------------------------------------------

create table public.automation_rules (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  -- {"type": "booking.ended", "room": "theatre"} — schema defined in stage 7
  trigger      jsonb not null,
  -- [{"type": "no_motion_for", "room": "theatre", "minutes": 10}]
  conditions   jsonb not null default '[]'::jsonb,
  -- [{"type": "set_lights", "room": "theatre", "state": "off"}]
  actions      jsonb not null,
  enabled      boolean not null default true,
  priority     smallint not null default 100,
  created_by   uuid references public.profiles (id) on delete set null,
  updated_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint trigger_has_type check (trigger ? 'type'),
  constraint conditions_is_array check (jsonb_typeof(conditions) = 'array'),
  constraint actions_is_array check (jsonb_typeof(actions) = 'array' and jsonb_array_length(actions) > 0)
);

create type public.command_source as enum ('user', 'rule', 'schedule', 'scheduler', 'failsafe', 'system');
create type public.command_status as enum ('queued', 'sent', 'acked', 'failed', 'expired');

-- Every physical action, with who or what caused it.
create table public.control_commands (
  id            bigint generated always as identity primary key,
  device_id     uuid not null references public.devices (id) on delete cascade,
  room_id       uuid references public.rooms (id) on delete set null,
  command       jsonb not null,           -- {"relay": 1, "state": "off"}
  source        public.command_source not null,
  user_id       uuid references public.profiles (id) on delete set null,
  rule_id       uuid references public.automation_rules (id) on delete set null,
  reason        text,                     -- human-readable "booking ended, no motion 10 min"
  status        public.command_status not null default 'queued',
  error         text,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz,
  acked_at      timestamptz,
  constraint command_attribution check (
    (source = 'user' and user_id is not null) or
    (source = 'rule' and rule_id is not null) or
    (source not in ('user', 'rule'))
  )
);
create index control_commands_device_idx on public.control_commands (device_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Laundry
-- ---------------------------------------------------------------------------

create type public.machine_kind as enum ('washer', 'dryer');
create type public.machine_state as enum ('idle', 'running', 'finishing', 'fault', 'offline');

create table public.laundry_machines (
  id            uuid primary key default gen_random_uuid(),
  label         text not null unique,            -- "Washer 3"
  kind          public.machine_kind not null,
  device_id     uuid references public.devices (id) on delete set null,
  channel       smallint,                        -- CT channel on that node
  state         public.machine_state not null default 'offline',
  state_since   timestamptz not null default now(),
  est_done_at   timestamptz,
  -- Power-signature thresholds for state detection (stage 6).
  signature     jsonb not null default '{}'::jsonb,
  unique (device_id, channel)
);

-- "Notify me when a washer/dryer frees up." One-shot; deleted when sent.
create table public.laundry_watchers (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        public.machine_kind not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, kind)
);

-- ---------------------------------------------------------------------------
-- EV charging
-- ---------------------------------------------------------------------------

create type public.ev_session_status as enum ('requested', 'scheduled', 'charging', 'paused', 'completed', 'cancelled', 'faulted');

create table public.ev_chargers (
  id          uuid primary key default gen_random_uuid(),
  label       text not null unique,          -- "P1-03"
  device_id   uuid references public.devices (id) on delete set null,
  ocpp_id     text unique,
  max_kw      numeric(5, 2) not null default 7.2,
  -- Fleet chargers (the shuttle) are not bookable by tenants.
  fleet_only  boolean not null default false,
  status      public.device_status not null default 'offline',
  created_at  timestamptz not null default now()
);

create table public.ev_sessions (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid references public.profiles (id) on delete set null,
  charger_id       uuid references public.ev_chargers (id) on delete set null,
  vehicle_label    text,
  requested_kwh    numeric(6, 2) not null check (requested_kwh > 0 and requested_kwh <= 120),
  departure_time   timestamptz not null,
  status           public.ev_session_status not null default 'requested',
  delivered_kwh    numeric(7, 3) not null default 0,
  -- Scheduler output: [{"start": "...", "end": "...", "kw": 6.0}]
  plan             jsonb,
  est_complete_at  timestamptz,
  started_at       timestamptz,
  ended_at         timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index ev_sessions_active_idx on public.ev_sessions (status) where status in ('requested', 'scheduled', 'charging', 'paused');

-- ---------------------------------------------------------------------------
-- Energy sources and forecasts
-- ---------------------------------------------------------------------------

-- Grid today; on-site battery or solar later. The scheduler treats each as a
-- dispatchable source with these limits.
create type public.energy_source_kind as enum ('grid', 'battery', 'solar');

create table public.energy_sources (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  kind          public.energy_source_kind not null,
  device_id     uuid references public.devices (id) on delete set null,
  max_import_kw numeric(8, 2),
  max_export_kw numeric(8, 2),
  capacity_kwh  numeric(8, 2),
  -- Building peak-demand limit the scheduler keeps under (grid source).
  peak_limit_kw numeric(8, 2),
  enabled       boolean not null default true
);

create table public.forecasts (
  id            bigint generated always as identity primary key,
  -- Start of the 15-minute interval.
  timestamp     timestamptz not null,
  predicted_kw  numeric(8, 2) not null,
  lower_kw      numeric(8, 2),
  upper_kw      numeric(8, 2),
  actual_kw     numeric(8, 2),
  model         text not null,
  generated_at  timestamptz not null default now(),
  unique (timestamp, model, generated_at)
);
create index forecasts_ts_idx on public.forecasts (timestamp desc);

create trigger devices_touch before update on public.devices
  for each row execute function public.touch_updated_at();
create trigger rooms_touch before update on public.rooms
  for each row execute function public.touch_updated_at();
create trigger automation_rules_touch before update on public.automation_rules
  for each row execute function public.touch_updated_at();
create trigger ev_sessions_touch before update on public.ev_sessions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.devices           enable row level security;
alter table public.device_events     enable row level security;
alter table public.rooms             enable row level security;
alter table public.automation_rules  enable row level security;
alter table public.control_commands  enable row level security;
alter table public.laundry_machines  enable row level security;
alter table public.laundry_watchers  enable row level security;
alter table public.ev_chargers       enable row level security;
alter table public.ev_sessions       enable row level security;
alter table public.energy_sources    enable row level security;
alter table public.forecasts         enable row level security;

-- Devices: staff read; admins register and edit.
create policy devices_staff_read on public.devices for select to authenticated using (public.is_staff());
create policy devices_admin on public.devices for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy device_events_staff_read on public.device_events for select to authenticated using (public.is_staff());
-- Staff acknowledge events (only that; the service role writes the rest).
create policy device_events_staff_ack on public.device_events for update to authenticated
  using (public.is_staff()) with check (public.is_staff() and acknowledged_by = auth.uid());

-- Rooms: staff read and set manual overrides; admins edit configuration.
create policy rooms_staff_read on public.rooms for select to authenticated using (public.is_staff());
create policy rooms_staff_update on public.rooms for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy rooms_admin on public.rooms for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy automation_rules_staff_read on public.automation_rules for select to authenticated using (public.is_staff());
create policy automation_rules_admin on public.automation_rules for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Command log: staff read and can issue manual commands as themselves.
-- Nobody edits or deletes history from the app.
create policy control_commands_staff_read on public.control_commands for select to authenticated using (public.is_staff());
create policy control_commands_staff_insert on public.control_commands for insert to authenticated
  with check (
    public.is_staff() and source = 'user' and user_id = auth.uid() and status = 'queued'
  );

-- Laundry: every approved user sees machine availability.
create policy laundry_machines_read on public.laundry_machines for select to authenticated using (public.is_approved());
create policy laundry_machines_admin on public.laundry_machines for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy laundry_watchers_own on public.laundry_watchers for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_approved());

-- EV: tenants see charger availability and their own sessions.
create policy ev_chargers_read on public.ev_chargers for select to authenticated using (public.is_approved());
create policy ev_chargers_admin on public.ev_chargers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy ev_sessions_tenant_read on public.ev_sessions for select to authenticated
  using (tenant_id = auth.uid());
create policy ev_sessions_tenant_request on public.ev_sessions for insert to authenticated
  with check (
    public.my_role() = 'tenant' and tenant_id = auth.uid() and status = 'requested'
    and delivered_kwh = 0 and plan is null and started_at is null
  );
create policy ev_sessions_tenant_cancel on public.ev_sessions for update to authenticated
  using (tenant_id = auth.uid() and status in ('requested', 'scheduled', 'charging', 'paused'))
  with check (tenant_id = auth.uid() and status = 'cancelled');
create policy ev_sessions_staff on public.ev_sessions for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy energy_sources_staff_read on public.energy_sources for select to authenticated using (public.is_staff());
create policy energy_sources_admin on public.energy_sources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy forecasts_staff_read on public.forecasts for select to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------------
-- Realtime: tables the app subscribes to. Guarded so the migration also runs
-- on plain Postgres (CI) where the Supabase publication doesn't exist.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.profiles,
      public.runs,
      public.shuttle_locations,
      public.announcements,
      public.tickets,
      public.ticket_messages,
      public.bookings,
      public.laundry_machines,
      public.rooms,
      public.device_events,
      public.ev_sessions;
  end if;
end;
$$;
