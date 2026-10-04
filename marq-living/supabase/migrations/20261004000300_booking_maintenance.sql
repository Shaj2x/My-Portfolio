-- Marq Living — Stage 4: amenity booking rules, confirmations and reminders,
-- plus run_maintenance(), the once-a-minute job that keeps time-based state
-- moving (materialize runs, flag late runs, publish scheduled posts, booking
-- reminders and completion).

-- ===========================================================================
-- Booking rules
-- ===========================================================================

-- Enforced in the database so every client (app, staff tools, API) gets the
-- same rules. Tenants get every rule; staff bookings skip the per-unit limit,
-- notice and window (they book on someone's behalf or for building events)
-- but still can't overlap blackouts or other bookings.
create or replace function public.validate_booking() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  a public.amenities;
  tz text := public.building_tz();
  s timestamptz := lower(new.period);
  e timestamptz := upper(new.period);
  mins numeric;
  is_staff boolean := public.is_staff() or auth.uid() is null;
  week_start timestamptz;
  used int;
  day date;
  open_at timestamptz;
  close_at timestamptz;
begin
  if new.status <> 'confirmed' then
    return new;
  end if;
  -- Only re-check when something that matters changed.
  if tg_op = 'UPDATE' and old.status = 'confirmed'
     and new.period = old.period and new.amenity_id = old.amenity_id then
    return new;
  end if;

  select * into a from public.amenities where id = new.amenity_id;
  if not found or not a.active then
    raise exception 'This room isn''t available for booking.' using errcode = 'P0001';
  end if;
  if not lower_inc(new.period) or upper_inc(new.period) then
    new.period := tstzrange(s, e, '[)');
  end if;

  mins := extract(epoch from e - s) / 60;
  if s < now() then
    raise exception 'That time has already passed.' using errcode = 'P0001';
  end if;

  -- Opening hours on the start's local day (close_time 00:00 means midnight).
  day := (s at time zone tz)::date;
  open_at := (day + a.open_time)::timestamp at time zone tz;
  close_at := (case when a.close_time = '00:00'::time then (day + 1)::timestamp
                    else day + a.close_time end) at time zone tz;
  if s < open_at or e > close_at then
    raise exception '% is open % to %.', a.name,
      ltrim(to_char(a.open_time, 'HH12:MI am'), '0'), ltrim(to_char(a.close_time, 'HH12:MI am'), '0')
      using errcode = 'P0001';
  end if;

  if exists (select 1 from public.amenity_blackouts b where b.amenity_id = a.id and b.period && new.period) then
    raise exception '% is closed for part of that time.', a.name using errcode = 'P0001';
  end if;

  if a.buffer_minutes > 0 and exists (
       select 1 from public.bookings b
        where b.amenity_id = a.id and b.status = 'confirmed' and b.id <> new.id
          and b.period && tstzrange(s - make_interval(mins => a.buffer_minutes), e + make_interval(mins => a.buffer_minutes))) then
    raise exception '% needs % minutes between bookings.', a.name, a.buffer_minutes using errcode = 'P0001';
  end if;

  if is_staff then
    return new;
  end if;

  if extract(minute from s at time zone tz)::int % 15 <> 0 or extract(minute from e at time zone tz)::int % 15 <> 0 then
    raise exception 'Bookings start and end on the quarter hour.' using errcode = 'P0001';
  end if;
  if mins < a.min_duration_minutes or mins > a.max_duration_minutes then
    raise exception 'Book % between % and % minutes.', a.name, a.min_duration_minutes, a.max_duration_minutes
      using errcode = 'P0001';
  end if;
  if s < now() + make_interval(mins => a.min_notice_minutes) then
    raise exception 'Book at least % minutes ahead.', a.min_notice_minutes using errcode = 'P0001';
  end if;
  if s > now() + make_interval(days => a.booking_window_days) then
    raise exception 'You can book up to % days ahead.', a.booking_window_days using errcode = 'P0001';
  end if;

  -- Per-unit weekly limit (Monday–Sunday, building time).
  week_start := (date_trunc('week', s at time zone tz)) at time zone tz;
  select count(*) into used from public.bookings b
   where b.amenity_id = a.id and b.unit = new.unit and b.status in ('confirmed', 'completed')
     and b.id <> new.id
     and lower(b.period) >= week_start and lower(b.period) < week_start + interval '7 days';
  if used >= a.weekly_limit_per_unit then
    raise exception 'Unit % has used its % % bookings this week.', new.unit, a.weekly_limit_per_unit, a.name
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;
create trigger bookings_validate before insert or update on public.bookings
  for each row execute function public.validate_booking();

create or replace function public.on_booking_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare a public.amenities;
begin
  select * into a from public.amenities where id = new.amenity_id;
  if tg_op = 'INSERT' and new.status = 'confirmed' then
    perform public.notify_users(array[new.tenant_id], 'booking_confirmed',
      format('%s booked', a.name),
      format('%s, %s–%s', to_char(lower(new.period) at time zone public.building_tz(), 'FMDay, FMMonth FMDD'),
             public.local_time_label(lower(new.period)), public.local_time_label(upper(new.period))),
      '/book', false, true, true, jsonb_build_object('booking_id', new.id));
  end if;
  return null;
end;
$$;
create trigger bookings_notify after insert on public.bookings
  for each row execute function public.on_booking_change();

-- Usage analytics for staff.
create or replace function public.amenity_usage(p_from timestamptz, p_to timestamptz)
returns table (amenity_id uuid, amenity text, bookings int, hours numeric, cancelled int, energy_kwh numeric)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.name,
         count(*) filter (where b.status in ('confirmed', 'completed'))::int,
         round(coalesce(sum(extract(epoch from upper(b.period) - lower(b.period)) / 3600)
               filter (where b.status in ('confirmed', 'completed')), 0)::numeric, 1),
         count(*) filter (where b.status = 'cancelled')::int,
         round(coalesce(sum(b.energy_kwh), 0), 2)
    from public.amenities a
    left join public.bookings b on b.amenity_id = a.id and lower(b.period) >= p_from and lower(b.period) < p_to
   where public.is_staff()
   group by a.id, a.name
   order by a.name
$$;

-- ===========================================================================
-- Maintenance tick
-- ===========================================================================

create or replace function public.run_maintenance() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  today date := (now() at time zone public.building_tz())::date;
  v_runs int; v_late int; v_posts int := 0; v_rem int := 0; v_done int; v_purged int;
  r record;
begin
  v_runs := public.materialize_runs(today) + public.materialize_runs(today + 1);
  v_late := public.flag_late_runs();

  for r in select id from public.announcements
            where urgent and push_sent_at is null and publish_at <= now()
              and (expires_at is null or expires_at > now())
  loop
    v_posts := v_posts + public.deliver_announcement(r.id);
  end loop;

  for r in
    update public.bookings b set reminder_sent_at = now()
      from public.amenities a
     where a.id = b.amenity_id and b.status = 'confirmed' and b.reminder_sent_at is null
       and lower(b.period) between now() and now() + interval '60 minutes'
    returning b.id, b.tenant_id, a.name, lower(b.period) as starts
  loop
    perform public.notify_users(array[r.tenant_id], 'booking_reminder',
      format('%s at %s', r.name, public.local_time_label(r.starts)),
      'Your booking starts within the hour.', '/book', false, true, false,
      jsonb_build_object('booking_id', r.id));
    v_rem := v_rem + 1;
  end loop;

  update public.bookings set status = 'completed'
   where status = 'confirmed' and upper(period) < now();
  get diagnostics v_done = row_count;

  -- Safety net: location trails of runs that ended without end_run().
  delete from public.shuttle_locations l using public.runs ru
   where ru.id = l.run_id and ru.status <> 'active';
  get diagnostics v_purged = row_count;

  -- Read notifications older than 60 days aren't needed.
  delete from public.notifications where read_at < now() - interval '60 days';

  return jsonb_build_object('runs_created', v_runs, 'late_flagged', v_late, 'posts_delivered', v_posts,
                            'reminders', v_rem, 'bookings_completed', v_done, 'locations_purged', v_purged);
end;
$$;
revoke all on function public.run_maintenance() from public, anon, authenticated;

-- On Supabase, pg_cron runs maintenance every minute. Elsewhere (CI, plain
-- Postgres) the web app's /api/cron/tick route calls it instead.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('marq-maintenance', '* * * * *', 'select public.run_maintenance()');
  end if;
exception when others then
  raise notice 'pg_cron not scheduled: %', sqlerrm;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
