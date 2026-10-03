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
