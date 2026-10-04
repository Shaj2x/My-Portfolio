-- Marq Living — Stage 2: notifications, shuttle run lifecycle, run metrics.
--
-- Notifications: anything that should reach a person (shuttle delay, urgent
-- announcement, ticket reply, booking reminder, laundry free, staff alert)
-- becomes a row here. The app shows unread rows as in-app banners; the
-- dispatcher (web/src/app/api/cron/tick) sends web push and email for rows
-- that ask for them and stamps push_sent_at / email_sent_at.
--
-- Shuttle: drivers never update runs directly. They call start_run / end_run
-- / delay_run / cancel_run, which check the caller and keep the timeline
-- consistent. end_run computes the run's metrics from its GPS trail and then
-- purges the trail.

create or replace function public.building_tz() returns text
language sql immutable as $$ select 'America/Toronto' $$;

-- ===========================================================================
-- Notifications
-- ===========================================================================

create type public.notification_kind as enum (
  'shuttle_delay', 'shuttle_cancel', 'shuttle_late', 'announcement',
  'ticket_update', 'ticket_new', 'booking_confirmed', 'booking_reminder',
  'laundry_free', 'ev_update', 'staff_alert'
);

create table public.notifications (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  kind           public.notification_kind not null,
  title          text not null,
  body           text not null default '',
  url            text,
  urgent         boolean not null default false,
  send_push      boolean not null default false,
  send_email     boolean not null default false,
  ref            jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  read_at        timestamptz,
  push_sent_at   timestamptz,
  email_sent_at  timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_push_due_idx on public.notifications (created_at) where send_push and push_sent_at is null;
create index notifications_email_due_idx on public.notifications (created_at) where send_email and email_sent_at is null;

alter table public.notifications enable row level security;
create policy notifications_own_read on public.notifications for select to authenticated
  using (user_id = auth.uid());
-- Users may only mark their own as read.
create policy notifications_own_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.guard_notification_update()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and (
       new.user_id, new.kind, new.title, new.body, new.url, new.urgent, new.send_push,
       new.send_email, new.ref, new.created_at, new.push_sent_at, new.email_sent_at)
     is distinct from (
       old.user_id, old.kind, old.title, old.body, old.url, old.urgent, old.send_push,
       old.send_email, old.ref, old.created_at, old.push_sent_at, old.email_sent_at) then
    raise exception 'only read_at can be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger notifications_guard before update on public.notifications
  for each row execute function public.guard_notification_update();

-- Fan-out helpers. Not callable from the app: triggers and definer functions use them.
create or replace function public.notify_users(
  p_users uuid[], p_kind public.notification_kind, p_title text, p_body text,
  p_url text default null, p_urgent boolean default false, p_push boolean default false,
  p_email boolean default false, p_ref jsonb default '{}'::jsonb
) returns integer
language sql security definer set search_path = ''
as $$
  with ins as (
    insert into public.notifications (user_id, kind, title, body, url, urgent, send_push, send_email, ref)
    select distinct u, p_kind, p_title, coalesce(p_body, ''), p_url, p_urgent, p_push, p_email, coalesce(p_ref, '{}'::jsonb)
      from unnest(p_users) as u
     where u is not null
    returning 1
  )
  select count(*)::integer from ins
$$;

create or replace function public.staff_ids() returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(id), '{}') from public.profiles
   where role in ('staff', 'admin') and status = 'approved'
$$;

create or replace function public.notify_staff(
  p_title text, p_body text, p_url text default null, p_ref jsonb default '{}'::jsonb,
  p_push boolean default true
) returns integer
language sql security definer set search_path = ''
as $$
  select public.notify_users(public.staff_ids(), 'staff_alert', p_title, p_body, p_url, true, p_push, false, p_ref)
$$;

-- Unread count + mark-all-read for the signed-in user.
create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns integer language sql security invoker set search_path = ''
as $$
  with u as (
    update public.notifications set read_at = now()
     where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids))
    returning 1
  ) select count(*)::integer from u
$$;

revoke all on function public.notify_users(uuid[], public.notification_kind, text, text, text, boolean, boolean, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.notify_staff(text, text, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.staff_ids() from public, anon, authenticated;

-- ===========================================================================
-- Shuttle
-- ===========================================================================

-- Drivers act only through the functions below.
drop policy runs_driver_update on public.runs;

-- Approved tenants who opted in to shuttle alerts.
create or replace function public.shuttle_alert_recipients() returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(id), '{}') from public.profiles
   where status = 'approved' and role = 'tenant' and shuttle_alerts
$$;
revoke all on function public.shuttle_alert_recipients() from public, anon, authenticated;

create or replace function public.local_time_label(ts timestamptz) returns text
language sql stable as $$
  select ltrim(to_char(ts at time zone public.building_tz(), 'HH12:MI am'), '0')
$$;

-- Caller may operate this run: the assigned driver, any driver for an
-- unassigned run, or staff.
create or replace function public.can_operate_run(r public.runs) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_staff()
      or (public.my_role() = 'driver' and (r.driver_id is null or r.driver_id = auth.uid()))
$$;

create or replace function public.start_run(p_run uuid) returns public.runs
language plpgsql security definer set search_path = ''
as $$
declare r public.runs;
begin
  select * into r from public.runs where id = p_run for update;
  if not found then raise exception 'run not found' using errcode = 'P0002'; end if;
  if not public.can_operate_run(r) then raise exception 'not allowed to operate this run' using errcode = '42501'; end if;
  if r.status <> 'scheduled' then raise exception 'run is %', r.status using errcode = '22023'; end if;
  if exists (select 1 from public.runs where route_id = r.route_id and status = 'active') then
    raise exception 'another run on this route is already active' using errcode = '22023';
  end if;
  update public.runs
     set status = 'active', driver_id = coalesce(driver_id, auth.uid()), started_at = now(), updated_by = auth.uid()
   where id = p_run returning * into r;
  return r;
end;
$$;

-- For a run that isn't on the timetable (e.g. an extra trip).
create or replace function public.start_unscheduled_run(p_route uuid) returns public.runs
language plpgsql security definer set search_path = ''
as $$
declare r public.runs;
begin
  if not public.is_driver() then raise exception 'drivers only' using errcode = '42501'; end if;
  insert into public.runs (route_id, service_date, scheduled_departure, status, driver_id, updated_by)
  values (p_route, (now() at time zone public.building_tz())::date, now(), 'scheduled', auth.uid(), auth.uid())
  returning * into r;
  return public.start_run(r.id);
end;
$$;

create or replace function public.haversine_km(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns float8 language sql immutable as $$
  select 2 * 6371.0088 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- Distance, idle time and stops from the GPS trail. Points with poor
-- accuracy (>100 m) are ignored; a gap with < 0.5 m/s movement counts as idle.
-- Energy is a first estimate (0.35 kWh/km + 2 kW while idle); the analytics
-- service's electrification model refines it.
create or replace function public.compute_run_metrics(p_run uuid) returns public.shuttle_run_metrics
language plpgsql security definer set search_path = ''
as $$
declare
  r public.runs;
  m public.shuttle_run_metrics;
  v_dist float8; v_idle float8; v_stops int;
  stop_list public.stops[];
  pt record;
begin
  select * into r from public.runs where id = p_run;
  with pts as (
    select lat, lng, recorded_at,
           lag(lat) over w as plat, lag(lng) over w as plng, lag(recorded_at) over w as pts
      from public.shuttle_locations
     where run_id = p_run and coalesce(accuracy_m, 0) <= 100
    window w as (order by recorded_at)
  ), seg as (
    select public.haversine_km(plat, plng, lat, lng) as km,
           extract(epoch from recorded_at - pts) as secs
      from pts where plat is not null
  )
  select coalesce(sum(km), 0),
         coalesce(sum(secs) filter (where secs > 0 and km * 1000 / secs < 0.5), 0)
    into v_dist, v_idle
    from seg;

  -- Stops are passed in route order (so a loop's return stop, which shares
  -- the first stop's location, only counts once the loop is driven).
  v_stops := 0;
  select array_agg(s order by s.sequence) into stop_list from public.stops s where s.route_id = r.route_id;
  for pt in select l.lat, l.lng from public.shuttle_locations l
             where l.run_id = p_run and coalesce(l.accuracy_m, 0) <= 100 order by l.recorded_at loop
    for i in (v_stops + 1) .. coalesce(array_length(stop_list, 1), 0) loop
      if public.haversine_km(stop_list[i].lat, stop_list[i].lng, pt.lat, pt.lng) < 0.04 then
        v_stops := i;
        exit;
      end if;
    end loop;
  end loop;

  insert into public.shuttle_run_metrics (run_id, distance_km, duration, idle_time, stop_count, est_energy_kwh)
  values (p_run, round(v_dist::numeric, 3),
          coalesce(r.ended_at, now()) - coalesce(r.started_at, now()),
          make_interval(secs => v_idle), v_stops,
          round((v_dist * 0.35 + v_idle / 3600.0 * 2.0)::numeric, 3))
  on conflict (run_id) do update set
    distance_km = excluded.distance_km, duration = excluded.duration, idle_time = excluded.idle_time,
    stop_count = excluded.stop_count, est_energy_kwh = excluded.est_energy_kwh
  returning * into m;
  return m;
end;
$$;

create or replace function public.end_run(p_run uuid) returns public.runs
language plpgsql security definer set search_path = ''
as $$
declare r public.runs;
begin
  select * into r from public.runs where id = p_run for update;
  if not found then raise exception 'run not found' using errcode = 'P0002'; end if;
  if not public.can_operate_run(r) then raise exception 'not allowed to operate this run' using errcode = '42501'; end if;
  if r.status <> 'active' then raise exception 'run is %', r.status using errcode = '22023'; end if;
  update public.runs set status = 'completed', ended_at = now(), updated_by = auth.uid()
   where id = p_run returning * into r;
  perform public.compute_run_metrics(p_run);
  -- Driver location exists only during the run.
  delete from public.shuttle_locations where run_id = p_run;
  return r;
end;
$$;

create or replace function public.delay_run(p_run uuid, p_minutes int, p_note text default null) returns public.runs
language plpgsql security definer set search_path = ''
as $$
declare r public.runs;
begin
  select * into r from public.runs where id = p_run for update;
  if not found then raise exception 'run not found' using errcode = 'P0002'; end if;
  if not public.can_operate_run(r) then raise exception 'not allowed to operate this run' using errcode = '42501'; end if;
  if r.status not in ('scheduled', 'active') then raise exception 'run is %', r.status using errcode = '22023'; end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 240 then
    raise exception 'delay must be 1–240 minutes' using errcode = '22023';
  end if;
  update public.runs set delay_minutes = p_minutes, updated_by = auth.uid() where id = p_run returning * into r;
  perform public.notify_users(
    public.shuttle_alert_recipients(), 'shuttle_delay',
    format('Shuttle delayed %s min', p_minutes),
    format('The %s run is running about %s minutes late.%s',
           public.local_time_label(r.scheduled_departure), p_minutes,
           coalesce(' ' || nullif(btrim(p_note), ''), '')),
    '/shuttle', true, true, false, jsonb_build_object('run_id', r.id));
  return r;
end;
$$;

create or replace function public.cancel_run(p_run uuid, p_reason text) returns public.runs
language plpgsql security definer set search_path = ''
as $$
declare r public.runs;
begin
  select * into r from public.runs where id = p_run for update;
  if not found then raise exception 'run not found' using errcode = 'P0002'; end if;
  if not public.can_operate_run(r) then raise exception 'not allowed to operate this run' using errcode = '42501'; end if;
  if r.status not in ('scheduled', 'active') then raise exception 'run is %', r.status using errcode = '22023'; end if;
  if nullif(btrim(p_reason), '') is null then raise exception 'give a reason' using errcode = '22023'; end if;
  update public.runs set status = 'cancelled', cancel_reason = btrim(p_reason), ended_at = now(), updated_by = auth.uid()
   where id = p_run returning * into r;
  delete from public.shuttle_locations where run_id = p_run;
  perform public.notify_users(
    public.shuttle_alert_recipients(), 'shuttle_cancel',
    format('%s shuttle cancelled', public.local_time_label(r.scheduled_departure)),
    btrim(p_reason), '/shuttle', true, true, false, jsonb_build_object('run_id', r.id));
  return r;
end;
$$;

-- Create the day's runs from the weekly timetable and its exceptions.
create or replace function public.materialize_runs(p_date date) returns integer
language plpgsql security definer set search_path = ''
as $$
declare n integer := 0; c integer;
begin
  if exists (select 1 from public.schedule_exceptions e
              where e.service_date = p_date and e.kind = 'no_service' and e.route_id is null) then
    return 0;
  end if;

  insert into public.runs (route_id, scheduled_run_id, service_date, scheduled_departure)
  select s.route_id, s.id, p_date,
         ((p_date + coalesce(rt.departure_time, s.departure_time))::timestamp at time zone public.building_tz())
    from public.scheduled_runs s
    join public.routes ro on ro.id = s.route_id and ro.active
    left join public.schedule_exceptions rt
      on rt.service_date = p_date and rt.kind = 'retime_run' and rt.scheduled_run_id = s.id
   where s.active and s.day_of_week = extract(dow from p_date)
     and not exists (select 1 from public.schedule_exceptions e
                      where e.service_date = p_date
                        and ((e.kind = 'cancel_run' and e.scheduled_run_id = s.id)
                          or (e.kind = 'no_service' and e.route_id = s.route_id)))
  on conflict (scheduled_run_id, service_date) do nothing;
  get diagnostics c = row_count; n := n + c;

  insert into public.runs (route_id, service_date, scheduled_departure)
  select e.route_id, p_date, ((p_date + e.departure_time)::timestamp at time zone public.building_tz())
    from public.schedule_exceptions e
   where e.service_date = p_date and e.kind = 'extra_run'
     and not exists (select 1 from public.runs r
                      where r.route_id = e.route_id
                        and r.scheduled_departure = ((p_date + e.departure_time)::timestamp at time zone public.building_tz()));
  get diagnostics c = row_count; n := n + c;
  return n;
end;
$$;

-- A run not started 5 minutes after its (delay-adjusted) departure is flagged
-- once and staff are alerted.
create or replace function public.flag_late_runs() returns integer
language plpgsql security definer set search_path = ''
as $$
declare r record; n integer := 0;
begin
  for r in
    update public.runs set late_flagged_at = now()
     where status = 'scheduled' and late_flagged_at is null
       and scheduled_departure + make_interval(mins => coalesce(delay_minutes, 0) + 5) < now()
       and scheduled_departure > now() - interval '3 hours'
    returning id, scheduled_departure
  loop
    perform public.notify_staff(
      format('%s shuttle hasn''t started', public.local_time_label(r.scheduled_departure)),
      'The run is more than 5 minutes past its departure time and no driver has started it.',
      '/staff/shuttle', jsonb_build_object('run_id', r.id));
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Upcoming departures for the tenant map when no run is active.
create or replace function public.next_departures(p_limit int default 5)
returns table (run_id uuid, route_id uuid, route_name text, departs_at timestamptz,
               status public.run_status, delay_minutes smallint, cancel_reason text)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.route_id, ro.name,
         r.scheduled_departure + make_interval(mins => coalesce(r.delay_minutes, 0)),
         r.status, r.delay_minutes, r.cancel_reason
    from public.runs r join public.routes ro on ro.id = r.route_id
   where public.is_approved()
     and r.status in ('scheduled', 'cancelled')
     and r.scheduled_departure + make_interval(mins => coalesce(r.delay_minutes, 0)) > now() - interval '5 minutes'
   order by r.scheduled_departure
   limit greatest(1, least(p_limit, 20))
$$;

revoke all on function public.start_run(uuid), public.start_unscheduled_run(uuid), public.end_run(uuid),
  public.delay_run(uuid, int, text), public.cancel_run(uuid, text) from public, anon;
grant execute on function public.start_run(uuid), public.start_unscheduled_run(uuid), public.end_run(uuid),
  public.delay_run(uuid, int, text), public.cancel_run(uuid, text) to authenticated;
revoke all on function public.compute_run_metrics(uuid), public.materialize_runs(date),
  public.flag_late_runs() from public, anon, authenticated;
