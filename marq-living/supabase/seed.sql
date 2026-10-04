-- Marq Living — baseline building data (safe to re-run). No user accounts:
-- people sign up through the app, and the first admin is promoted with
--   select public.bootstrap_admin('you@example.com');

insert into public.amenities (slug, name, description, capacity, max_duration_minutes, min_duration_minutes,
                              weekly_limit_per_unit, booking_window_days, min_notice_minutes,
                              open_time, close_time, buffer_minutes)
values
  ('theatre', 'Theatre Room', 'Projector, surround sound and lounge seating.', 12, 180, 60, 2, 14, 60, '10:00', '23:00', 15),
  ('game-room', 'Game Room', 'Pool table, consoles and board games.', 10, 120, 30, 3, 7, 30, '10:00', '23:00', 0)
on conflict (slug) do nothing;

insert into public.rooms (slug, name, amenity_id, hvac_setpoints, baseline_kw)
select 'theatre', 'Theatre Room', id, '{"comfort_c": 21.5, "setback_c": 17, "preheat_minutes": 15}', 1.8
  from public.amenities where slug = 'theatre'
on conflict (slug) do nothing;

insert into public.rooms (slug, name, amenity_id, hvac_setpoints, baseline_kw)
select 'game-room', 'Game Room', id, '{"comfort_c": 21, "setback_c": 17, "preheat_minutes": 10}', 1.2
  from public.amenities where slug = 'game-room'
on conflict (slug) do nothing;

insert into public.energy_sources (name, kind, peak_limit_kw)
select 'London Hydro grid', 'grid', 150
 where not exists (select 1 from public.energy_sources where kind = 'grid');

-- PLACEHOLDER shuttle route and timetable so the system works end to end.
-- Coordinates are approximate and the timetable is illustrative: replace both
-- in Staff → Shuttle with the building's real route and schedule.
insert into public.routes (id, name, description, color)
values ('5e000000-0000-0000-0000-000000000001', 'Western Campus Loop',
        'Placeholder route — edit stops and times in Staff → Shuttle.', '#1b2a4a')
on conflict (id) do nothing;

insert into public.stops (route_id, name, lat, lng, sequence, offset_minutes, dwell_seconds) values
  ('5e000000-0000-0000-0000-000000000001', 'The Marq (75 Ann St)',        42.99198, -81.25104, 0,  0, 120),
  ('5e000000-0000-0000-0000-000000000001', 'Richmond St & Oxford St',     42.99853, -81.25318, 1,  4, 30),
  ('5e000000-0000-0000-0000-000000000001', 'Western — UCC',               43.00869, -81.27326, 2, 12, 120),
  ('5e000000-0000-0000-0000-000000000001', 'Western — Alumni Hall',       43.00446, -81.27618, 3, 15, 60),
  ('5e000000-0000-0000-0000-000000000001', 'The Marq (return)',           42.99198, -81.25104, 4, 28, 0)
on conflict (route_id, sequence) do nothing;

-- Weekdays hourly 07:30–21:30; weekends every two hours 10:00–18:00.
insert into public.scheduled_runs (route_id, day_of_week, departure_time)
select '5e000000-0000-0000-0000-000000000001'::uuid, d, t::time
  from generate_series(1, 5) d, generate_series('2000-01-01 07:30'::timestamp, '2000-01-01 21:30', '1 hour') t
union all
select '5e000000-0000-0000-0000-000000000001'::uuid, d, t::time
  from unnest(array[0, 6]) d, generate_series('2000-01-01 10:00'::timestamp, '2000-01-01 18:00', '2 hours') t
on conflict (route_id, day_of_week, departure_time) do nothing;

select public.materialize_runs((now() at time zone 'America/Toronto')::date);
select public.materialize_runs((now() at time zone 'America/Toronto')::date + 1);
