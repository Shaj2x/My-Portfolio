-- Marq Living — tenant app tables: shuttle, announcements, tickets, amenities,
-- push subscriptions. Tables and RLS only; per-feature logic (late-run
-- flagging, booking rule checks, metric computation) lands with each stage.
--
-- RLS conventions used throughout:
--   * Unapproved accounts see nothing outside their own profile.
--   * Tenants see shared building data plus their own rows, never another
--     tenant's rows.
--   * Staff/admin manage everything here. Backend services use the service
--     role, which bypasses RLS.

-- ===========================================================================
-- Shuttle
-- ===========================================================================

create type public.run_status as enum ('scheduled', 'active', 'completed', 'cancelled');

create table public.routes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  color       text not null default '#1d4ed8' check (color ~ '^#[0-9a-fA-F]{6}$'),
  -- GeoJSON LineString of the driven path, for drawing on the map.
  path        jsonb,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.stops (
  id              uuid primary key default gen_random_uuid(),
  route_id        uuid not null references public.routes (id) on delete cascade,
  name            text not null,
  lat             double precision not null check (lat between -90 and 90),
  lng             double precision not null check (lng between -180 and 180),
  sequence        smallint not null check (sequence >= 0),
  -- Minutes after departure the shuttle is expected here (for ETAs when no live run).
  offset_minutes  smallint not null default 0 check (offset_minutes >= 0),
  dwell_seconds   smallint not null default 60 check (dwell_seconds >= 0),
  unique (route_id, sequence)
);

-- Weekly timetable. day_of_week follows Postgres extract(dow): 0 = Sunday.
create table public.scheduled_runs (
  id              uuid primary key default gen_random_uuid(),
  route_id        uuid not null references public.routes (id) on delete cascade,
  day_of_week     smallint not null check (day_of_week between 0 and 6),
  departure_time  time not null,
  active          boolean not null default true,
  unique (route_id, day_of_week, departure_time)
);

-- Holiday and one-off changes to the weekly timetable.
create type public.schedule_exception_kind as enum ('no_service', 'cancel_run', 'extra_run', 'retime_run');

create table public.schedule_exceptions (
  id                uuid primary key default gen_random_uuid(),
  service_date      date not null,
  kind              public.schedule_exception_kind not null,
  route_id          uuid references public.routes (id) on delete cascade,
  scheduled_run_id  uuid references public.scheduled_runs (id) on delete cascade,
  departure_time    time,
  note              text,
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint exception_shape check (
    case kind
      when 'no_service' then scheduled_run_id is null
      when 'cancel_run' then scheduled_run_id is not null
      when 'extra_run'  then route_id is not null and departure_time is not null
      when 'retime_run' then scheduled_run_id is not null and departure_time is not null
    end
  )
);
create index schedule_exceptions_date_idx on public.schedule_exceptions (service_date);

-- A concrete run on a given day: materialized from the timetable, or ad hoc.
create table public.runs (
  id                   uuid primary key default gen_random_uuid(),
  route_id             uuid not null references public.routes (id),
  scheduled_run_id     uuid references public.scheduled_runs (id) on delete set null,
  service_date         date not null,
  scheduled_departure  timestamptz not null,
  status               public.run_status not null default 'scheduled',
  driver_id            uuid references public.profiles (id) on delete set null,
  delay_minutes        smallint check (delay_minutes between 1 and 240),
  cancel_reason        text,
  started_at           timestamptz,
  ended_at             timestamptz,
  late_flagged_at      timestamptz,
  updated_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (scheduled_run_id, service_date),
  constraint cancelled_has_reason check (status <> 'cancelled' or cancel_reason is not null)
);
create index runs_departure_idx on public.runs (scheduled_departure);
-- At most one live run per route.
create unique index runs_one_active_per_route on public.runs (route_id) where status = 'active';

-- Live GPS points. Only exist while a run is active; purged when it ends
-- (after metrics are computed — stage 2).
create table public.shuttle_locations (
  id           bigint generated always as identity primary key,
  run_id       uuid not null references public.runs (id) on delete cascade,
  lat          double precision not null check (lat between -90 and 90),
  lng          double precision not null check (lng between -180 and 180),
  heading      real,
  speed_mps    real,
  accuracy_m   real,
  recorded_at  timestamptz not null default now()
);
create index shuttle_locations_run_idx on public.shuttle_locations (run_id, recorded_at desc);

create table public.shuttle_run_metrics (
  run_id          uuid primary key references public.runs (id) on delete cascade,
  distance_km     numeric(8, 3) not null,
  duration        interval not null,
  idle_time       interval not null,
  stop_count      smallint not null,
  est_energy_kwh  numeric(8, 3),
  created_at      timestamptz not null default now()
);

-- ===========================================================================
-- Announcements
-- ===========================================================================

create type public.announcement_category as enum ('maintenance', 'events', 'safety', 'general');
create type public.announcement_audience as enum ('building', 'floors', 'units');
create type public.content_source as enum ('staff', 'system');

create table public.announcements (
  id             uuid primary key default gen_random_uuid(),
  title          text not null check (char_length(title) between 1 and 160),
  body           text not null,
  category       public.announcement_category not null default 'general',
  audience       public.announcement_audience not null default 'building',
  target_floors  smallint[] not null default '{}',
  target_units   text[] not null default '{}',
  urgent         boolean not null default false,
  publish_at     timestamptz not null default now(),
  expires_at     timestamptz,
  source         public.content_source not null default 'staff',
  -- For system posts: what raised it, e.g. {"device_id": "...", "event_id": 123}.
  source_ref     jsonb,
  push_sent_at   timestamptz,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint audience_targets check (
    (audience = 'building') or
    (audience = 'floors' and cardinality(target_floors) > 0) or
    (audience = 'units'  and cardinality(target_units)  > 0)
  ),
  constraint expires_after_publish check (expires_at is null or expires_at > publish_at)
);
create index announcements_publish_idx on public.announcements (publish_at desc);

create table public.announcement_reads (
  announcement_id  uuid not null references public.announcements (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  read_at          timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

-- Whether the calling user is in an announcement's audience. Used by RLS.
create or replace function public.announcement_targets_me(a public.announcements)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case a.audience
    when 'building' then true
    when 'floors'   then public.my_floor() = any (a.target_floors)
    when 'units'    then public.my_unit()  = any (a.target_units)
  end
$$;

-- ===========================================================================
-- Front desk tickets
-- ===========================================================================

create type public.ticket_status as enum ('open', 'in_progress', 'resolved');
create type public.ticket_category as enum (
  'maintenance', 'noise', 'package', 'lockout', 'amenity', 'shuttle', 'device_fault', 'other'
);
create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.ticket_source as enum ('tenant', 'staff', 'system');

create table public.tickets (
  id           uuid primary key default gen_random_uuid(),
  -- Null for tickets the system opened from a device fault.
  tenant_id    uuid references public.profiles (id) on delete set null,
  unit         text,
  category     public.ticket_category not null,
  subject      text not null check (char_length(subject) between 1 and 160),
  description  text not null default '',
  -- Storage path in the ticket-photos bucket: <tenant_id>/<file>.
  photo_path   text,
  status       public.ticket_status not null default 'open',
  priority     public.ticket_priority not null default 'normal',
  source       public.ticket_source not null default 'tenant',
  device_id    uuid,  -- FK added in the operations migration
  assigned_to  uuid references public.profiles (id) on delete set null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index tickets_tenant_idx on public.tickets (tenant_id, created_at desc);
create index tickets_open_idx on public.tickets (status, created_at) where status <> 'resolved';

create table public.ticket_messages (
  id               uuid primary key default gen_random_uuid(),
  ticket_id        uuid not null references public.tickets (id) on delete cascade,
  author_id        uuid references public.profiles (id) on delete set null,
  body             text not null check (char_length(body) between 1 and 4000),
  attachment_path  text,
  -- Staff-only notes, hidden from the tenant.
  internal         boolean not null default false,
  created_at       timestamptz not null default now()
);
create index ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

-- ===========================================================================
-- Amenities and bookings
-- ===========================================================================

create type public.booking_status as enum ('confirmed', 'cancelled', 'completed', 'no_show');

create table public.amenities (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name                   text not null,
  description            text,
  capacity               smallint,
  max_duration_minutes   smallint not null default 120 check (max_duration_minutes > 0),
  min_duration_minutes   smallint not null default 30 check (min_duration_minutes > 0),
  weekly_limit_per_unit  smallint not null default 2 check (weekly_limit_per_unit >= 0),
  booking_window_days    smallint not null default 14 check (booking_window_days > 0),
  min_notice_minutes     smallint not null default 0 check (min_notice_minutes >= 0),
  open_time              time not null default '08:00',
  close_time             time not null default '23:00',
  -- Gap kept free after each booking for cleaning / HVAC setback.
  buffer_minutes         smallint not null default 0 check (buffer_minutes >= 0),
  active                 boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table public.amenity_blackouts (
  id          uuid primary key default gen_random_uuid(),
  amenity_id  uuid not null references public.amenities (id) on delete cascade,
  period      tstzrange not null check (not isempty(period)),
  reason      text,
  created_by  uuid references public.profiles (id) on delete set null
);
create index amenity_blackouts_period_idx on public.amenity_blackouts using gist (amenity_id, period);

create table public.bookings (
  id           uuid primary key default gen_random_uuid(),
  amenity_id   uuid not null references public.amenities (id),
  tenant_id    uuid not null references public.profiles (id) on delete cascade,
  unit         text not null,
  period       tstzrange not null check (not isempty(period)),
  status       public.booking_status not null default 'confirmed',
  guests       smallint not null default 0 check (guests >= 0),
  note         text,
  -- Filled in by the automation engine after the booking (stage 7).
  energy_kwh   numeric(8, 3),
  reminder_sent_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- No double-booking a room.
  constraint bookings_no_overlap exclude using gist (amenity_id with =, period with &&)
    where (status = 'confirmed')
);
create index bookings_tenant_idx on public.bookings (tenant_id, lower(period) desc);
create index bookings_unit_idx on public.bookings (unit, lower(period));

-- Tenants can't read each other's bookings, but need to see what's taken.
-- Returns only the busy ranges, no names or units.
create or replace function public.amenity_busy_periods(
  p_amenity uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (period tstzrange, kind text)
language sql stable security definer set search_path = ''
as $$
  select b.period, 'booking'
    from public.bookings b
   where public.is_approved()
     and b.amenity_id = p_amenity and b.status = 'confirmed'
     and b.period && tstzrange(p_from, p_to)
  union all
  select x.period, 'blackout'
    from public.amenity_blackouts x
   where public.is_approved()
     and x.amenity_id = p_amenity
     and x.period && tstzrange(p_from, p_to)
  order by 1
$$;

-- ===========================================================================
-- Web push subscriptions
-- ===========================================================================

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ===========================================================================
-- updated_at triggers
-- ===========================================================================

create trigger routes_touch before update on public.routes
  for each row execute function public.touch_updated_at();
create trigger runs_touch before update on public.runs
  for each row execute function public.touch_updated_at();
create trigger announcements_touch before update on public.announcements
  for each row execute function public.touch_updated_at();
create trigger tickets_touch before update on public.tickets
  for each row execute function public.touch_updated_at();
create trigger amenities_touch before update on public.amenities
  for each row execute function public.touch_updated_at();
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- RLS
-- ===========================================================================

alter table public.routes               enable row level security;
alter table public.stops                enable row level security;
alter table public.scheduled_runs       enable row level security;
alter table public.schedule_exceptions  enable row level security;
alter table public.runs                 enable row level security;
alter table public.shuttle_locations    enable row level security;
alter table public.shuttle_run_metrics  enable row level security;
alter table public.announcements        enable row level security;
alter table public.announcement_reads   enable row level security;
alter table public.tickets              enable row level security;
alter table public.ticket_messages      enable row level security;
alter table public.amenities            enable row level security;
alter table public.amenity_blackouts    enable row level security;
alter table public.bookings             enable row level security;
alter table public.push_subscriptions   enable row level security;

-- Shuttle reference data: any approved user reads, staff writes.
create policy routes_read on public.routes for select to authenticated using (public.is_approved());
create policy routes_staff on public.routes for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy stops_read on public.stops for select to authenticated using (public.is_approved());
create policy stops_staff on public.stops for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy scheduled_runs_read on public.scheduled_runs for select to authenticated using (public.is_approved());
create policy scheduled_runs_staff on public.scheduled_runs for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy schedule_exceptions_read on public.schedule_exceptions for select to authenticated using (public.is_approved());
create policy schedule_exceptions_staff on public.schedule_exceptions for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Runs: everyone approved can see status. Drivers update runs (start, end,
-- delay, cancel); the column-level rules for drivers come with stage 2.
create policy runs_read on public.runs for select to authenticated using (public.is_approved());
create policy runs_staff on public.runs for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy runs_driver_update on public.runs for update to authenticated
  using (public.my_role() = 'driver' and (driver_id is null or driver_id = auth.uid()))
  with check (public.my_role() = 'driver' and driver_id = auth.uid());

-- Locations: visible only while the run is active. Only the run's driver writes.
create policy shuttle_locations_read on public.shuttle_locations for select to authenticated
  using (
    public.is_approved()
    and exists (select 1 from public.runs r where r.id = run_id and r.status = 'active')
  );
create policy shuttle_locations_driver_insert on public.shuttle_locations for insert to authenticated
  with check (
    public.is_driver()
    and exists (
      select 1 from public.runs r
       where r.id = run_id and r.status = 'active' and r.driver_id = auth.uid()
    )
  );

-- Metrics: computed by the backend; staff read.
create policy shuttle_run_metrics_staff on public.shuttle_run_metrics for select to authenticated
  using (public.is_staff());

-- Announcements: tenants see published, unexpired posts aimed at them.
create policy announcements_read on public.announcements for select to authenticated
  using (
    public.is_approved()
    and publish_at <= now()
    and (expires_at is null or expires_at > now())
    and public.announcement_targets_me(announcements)
  );
create policy announcements_staff on public.announcements for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy announcement_reads_own on public.announcement_reads for select to authenticated
  using (user_id = auth.uid());
-- Insert works only for announcements the caller can see (the subquery runs
-- under the caller's RLS on announcements).
create policy announcement_reads_insert on public.announcement_reads for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.announcements a where a.id = announcement_id)
  );
create policy announcement_reads_staff on public.announcement_reads for select to authenticated
  using (public.is_staff());

-- Tickets: tenants open and read their own; staff handle all.
create policy tickets_tenant_read on public.tickets for select to authenticated
  using (tenant_id = auth.uid() and public.is_approved());
create policy tickets_tenant_insert on public.tickets for insert to authenticated
  with check (
    public.my_role() = 'tenant'
    and tenant_id = auth.uid()
    and unit = public.my_unit()
    and source = 'tenant'
    and status = 'open'
    and assigned_to is null
    and device_id is null
    and (photo_path is null or photo_path like auth.uid()::text || '/%')
  );
create policy tickets_staff on public.tickets for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy ticket_messages_tenant_read on public.ticket_messages for select to authenticated
  using (
    not internal
    and exists (select 1 from public.tickets t where t.id = ticket_id and t.tenant_id = auth.uid())
  );
create policy ticket_messages_tenant_insert on public.ticket_messages for insert to authenticated
  with check (
    author_id = auth.uid()
    and not internal
    and (attachment_path is null or attachment_path like auth.uid()::text || '/%')
    and exists (
      select 1 from public.tickets t
       where t.id = ticket_id and t.tenant_id = auth.uid() and t.status <> 'resolved'
    )
  );
create policy ticket_messages_staff on public.ticket_messages for all to authenticated
  using (public.is_staff()) with check (public.is_staff() and author_id = auth.uid());

-- Amenities: approved users read rules; staff manage.
create policy amenities_read on public.amenities for select to authenticated using (public.is_approved());
create policy amenities_staff on public.amenities for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy amenity_blackouts_read on public.amenity_blackouts for select to authenticated using (public.is_approved());
create policy amenity_blackouts_staff on public.amenity_blackouts for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Bookings: tenants see and manage only their own. Booking rules (window,
-- limits, hours, blackouts) are enforced by a trigger in stage 4.
create policy bookings_tenant_read on public.bookings for select to authenticated
  using (tenant_id = auth.uid());
create policy bookings_tenant_insert on public.bookings for insert to authenticated
  with check (
    public.my_role() = 'tenant'
    and tenant_id = auth.uid()
    and unit = public.my_unit()
    and status = 'confirmed'
    and energy_kwh is null
  );
create policy bookings_tenant_cancel on public.bookings for update to authenticated
  using (tenant_id = auth.uid() and status = 'confirmed')
  with check (
    tenant_id = auth.uid() and unit = public.my_unit()
    and status in ('confirmed', 'cancelled') and energy_kwh is null
  );
create policy bookings_staff on public.bookings for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Push subscriptions: strictly per user.
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
