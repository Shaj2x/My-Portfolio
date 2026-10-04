-- Stages 2–4: shuttle lifecycle and metrics, notifications, announcement
-- delivery, ticket workflow, device faults, booking rules, maintenance.
-- Users from 01/02: alice (approved, 502/floor 5, shuttle alerts OFF),
-- bob (approved, 702/floor 7, alerts on), carol (pending), sam/fay (staff),
-- ada (admin), dee (driver).
\ir helpers.sql

\set alice  '''a0000000-0000-0000-0000-00000000000a'''
\set bob    '''b0000000-0000-0000-0000-00000000000b'''
\set carol  '''c0000000-0000-0000-0000-00000000000c'''
\set sam    '''50000000-0000-0000-0000-000000000005'''
\set ada    '''ad000000-0000-0000-0000-0000000000ad'''
\set dee    '''dd000000-0000-0000-0000-0000000000dd'''
\set route  '''10000000-0000-0000-0000-000000000001'''

-- =========================================================================
-- Timetable → runs
-- =========================================================================
insert into public.routes (id, name) values ('10000000-0000-0000-0000-000000000002', 'Downtown');
insert into public.stops (route_id, name, lat, lng, sequence) values
  ('10000000-0000-0000-0000-000000000002', 'The Marq', 42.9900, -81.2500, 0),
  ('10000000-0000-0000-0000-000000000002', 'Downtown', 42.9900, -81.2400, 1);
-- A fixed future date so day-of-week is known: 2030-01-07 is a Monday.
insert into public.scheduled_runs (id, route_id, day_of_week, departure_time) values
  ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 1, '08:00'),
  ('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 1, '09:00'),
  ('70000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 1, '10:00'),
  ('70000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 2, '08:00');
insert into public.schedule_exceptions (service_date, kind, scheduled_run_id, departure_time) values
  ('2030-01-07', 'cancel_run', '70000000-0000-0000-0000-000000000002', null),
  ('2030-01-07', 'retime_run', '70000000-0000-0000-0000-000000000003', '10:30');
insert into public.schedule_exceptions (service_date, kind, route_id, departure_time) values
  ('2030-01-07', 'extra_run', '10000000-0000-0000-0000-000000000002', '12:00');
insert into public.schedule_exceptions (service_date, kind) values ('2030-01-01', 'no_service');

select public.materialize_runs('2030-01-07');
select tests.eq((select count(*) from public.runs where service_date = '2030-01-07' and route_id = '10000000-0000-0000-0000-000000000002'), 3::bigint, 'Monday: 08:00, retimed 10:30 and extra 12:00 (09:00 cancelled)');
select tests.eq(public.materialize_runs('2030-01-07'), 0, 'materializing twice creates nothing new');
select tests.eq(
  (select string_agg(to_char(scheduled_departure at time zone 'America/Toronto', 'HH24:MI'), ',' order by scheduled_departure)
     from public.runs where service_date = '2030-01-07' and route_id = '10000000-0000-0000-0000-000000000002'),
  '08:00,10:30,12:00', 'departures are in building local time');
select tests.eq(public.materialize_runs('2030-01-01'), 0, 'no service on a holiday');

-- =========================================================================
-- Run lifecycle
-- =========================================================================
insert into public.runs (id, route_id, service_date, scheduled_departure) values
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', current_date, now() + interval '1 min'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', current_date, now() + interval '30 min');

select tests.login(:alice);
select tests.throws($$select public.start_run('20000000-0000-0000-0000-000000000003')$$, 'tenant cannot start a run', '42501');
select tests.logout();

select tests.login(:dee);
select public.start_run('20000000-0000-0000-0000-000000000003');
select tests.throws($$select public.start_run('20000000-0000-0000-0000-000000000004')$$, 'only one active run per route', '22023');
-- Drive 0.0100° of longitude east (≈ 0.816 km at this latitude) in 4 points,
-- passing both stops, with a 60 s idle at the first stop.
insert into public.shuttle_locations (run_id, lat, lng, recorded_at, accuracy_m) values
  ('20000000-0000-0000-0000-000000000003', 42.9900, -81.2500, now() - interval '200 s', 5),
  ('20000000-0000-0000-0000-000000000003', 42.9900, -81.2500, now() - interval '140 s', 5),
  ('20000000-0000-0000-0000-000000000003', 42.9900, -81.2450, now() - interval '80 s', 5),
  ('20000000-0000-0000-0000-000000000003', 42.9900, -81.2400, now() - interval '20 s', 5),
  ('20000000-0000-0000-0000-000000000003', 43.5000, -81.0000, now() - interval '10 s', 900);
select public.end_run('20000000-0000-0000-0000-000000000003');
select tests.logout();

select tests.ok((select distance_km between 0.80 and 0.83 from public.shuttle_run_metrics where run_id = '20000000-0000-0000-0000-000000000003'), 'run distance from GPS trail, ignoring an inaccurate point');
select tests.eq((select extract(epoch from idle_time)::int from public.shuttle_run_metrics where run_id = '20000000-0000-0000-0000-000000000003'), 60, 'idle time counted');
select tests.eq((select stop_count::int from public.shuttle_run_metrics where run_id = '20000000-0000-0000-0000-000000000003'), 2, 'stops passed counted');
select tests.ok((select est_energy_kwh > 0 from public.shuttle_run_metrics where run_id = '20000000-0000-0000-0000-000000000003'), 'energy estimate recorded');
select tests.eq((select count(*) from public.shuttle_locations where run_id = '20000000-0000-0000-0000-000000000003'), 0::bigint, 'GPS trail purged when the run ends');

select tests.login(:dee);
select tests.throws($$select public.end_run('20000000-0000-0000-0000-000000000003')$$, 'cannot end a completed run', '22023');
select tests.throws($$select public.delay_run('20000000-0000-0000-0000-000000000004', 0)$$, 'delay must be at least a minute', '22023');
select public.delay_run('20000000-0000-0000-0000-000000000004', 10, 'Traffic on Richmond');
select tests.throws($$select public.cancel_run('20000000-0000-0000-0000-000000000004', '  ')$$, 'cancelling needs a reason', '22023');
select tests.logout();

select tests.eq((select count(*) from public.notifications where kind = 'shuttle_delay' and user_id = :bob), 1::bigint, 'opted-in tenant gets the delay alert');
select tests.eq((select count(*) from public.notifications where kind = 'shuttle_delay' and user_id = :alice), 0::bigint, 'opted-out tenant gets no delay alert');
select tests.eq((select count(*) from public.notifications where kind = 'shuttle_delay' and user_id = :carol), 0::bigint, 'pending tenant gets no delay alert');
select tests.ok((select send_push and urgent and body like '%Traffic on Richmond%' from public.notifications where kind = 'shuttle_delay' and user_id = :bob), 'delay alert is an urgent push with the note');

select tests.login(:sam);
select public.cancel_run('20000000-0000-0000-0000-000000000004', 'Vehicle maintenance');
select tests.logout();
select tests.eq((select count(*) from public.notifications where kind = 'shuttle_cancel' and user_id = :bob), 1::bigint, 'cancellation alert sent');

-- Late flagging.
insert into public.runs (id, route_id, service_date, scheduled_departure) values
  ('20000000-0000-0000-0000-000000000005', :route, current_date, now() - interval '6 min'),
  ('20000000-0000-0000-0000-000000000006', :route, current_date, now() - interval '6 min');
update public.runs set delay_minutes = 10 where id = '20000000-0000-0000-0000-000000000006';
select public.flag_late_runs();
select tests.ok((select late_flagged_at is not null from public.runs where id = '20000000-0000-0000-0000-000000000005'), 'run 6 min past departure is flagged');
select tests.ok((select late_flagged_at is null from public.runs where id = '20000000-0000-0000-0000-000000000006'), 'a run delayed 10 min is not flagged yet');
select tests.eq(public.flag_late_runs(), 0, 'a late run is flagged once');
select tests.ok((select count(*) >= 3 from public.notifications where kind = 'staff_alert' and ref ->> 'run_id' = '20000000-0000-0000-0000-000000000005'), 'all staff alerted about the late run');

select tests.login(:bob);
select tests.ok((select count(*) >= 1 from public.next_departures(5)), 'tenant sees upcoming departures');
select tests.eq((select count(*) from public.notifications where user_id <> :bob), 0::bigint, 'tenant sees only own notifications');
select tests.throws($$update public.notifications set title = 'x'$$, 'tenant cannot rewrite a notification', '42501');
select tests.ok(public.mark_notifications_read() >= 2, 'tenant marks notifications read');
select tests.logout();

select tests.login(:carol);
select tests.eq((select count(*) from public.next_departures(5)), 0::bigint, 'pending tenant gets no departures');
select tests.logout();

-- =========================================================================
-- Announcement delivery
-- =========================================================================
select tests.login(:sam);
insert into public.announcements (id, title, body, audience, target_floors, urgent) values
  ('40000000-0000-0000-0000-000000000010', 'Fire alarm test', 'Floor 7 at 10am', 'floors', '{7}', true);
insert into public.announcements (id, title, body, urgent, publish_at) values
  ('40000000-0000-0000-0000-000000000011', 'Power shutdown', 'Tomorrow', true, now() + interval '1 hour');
select tests.eq((select read_count from public.announcement_stats() where announcement_id = '40000000-0000-0000-0000-000000000010'), 0, 'staff see read counts');
select tests.eq((select audience_size from public.announcement_stats() where announcement_id = '40000000-0000-0000-0000-000000000010'), 1, 'audience size counts targeted approved tenants');
select tests.logout();
select tests.eq((select count(*) from public.notifications where ref ->> 'announcement_id' = '40000000-0000-0000-0000-000000000010'), 1::bigint, 'urgent floor post pushes only to that floor');
select tests.eq((select user_id from public.notifications where ref ->> 'announcement_id' = '40000000-0000-0000-0000-000000000010'), :bob::uuid, 'and to the right tenant');
select tests.eq((select count(*) from public.notifications where ref ->> 'announcement_id' = '40000000-0000-0000-0000-000000000011'), 0::bigint, 'scheduled post is not pushed early');
update public.announcements set publish_at = now() - interval '1 second' where id = '40000000-0000-0000-0000-000000000011';
select tests.eq((select count(*) from public.notifications where ref ->> 'announcement_id' = '40000000-0000-0000-0000-000000000011'), 2::bigint, 'scheduled building post is pushed to all approved tenants once due');
select tests.eq(public.deliver_announcement('40000000-0000-0000-0000-000000000011'), 0, 'a post is pushed only once');
select tests.login(:sam);
select tests.throws($$select public.deliver_announcement('40000000-0000-0000-0000-000000000011')$$, 'staff cannot call internal delivery directly', '42501');
select tests.logout();

-- =========================================================================
-- Tickets
-- =========================================================================
select tests.login(:bob);
insert into public.tickets (id, tenant_id, unit, category, subject) values
  ('50000000-0000-0000-0000-000000000010', :bob, '702', 'noise', 'Loud music 703');
select tests.logout();
select tests.ok((select count(*) >= 3 from public.notifications where kind = 'ticket_new' and ref ->> 'ticket_id' = '50000000-0000-0000-0000-000000000010'), 'new tenant ticket alerts staff');

select tests.login(:sam);
update public.tickets set status = 'resolved' where id = '50000000-0000-0000-0000-000000000010';
select tests.ok((select resolved_at is not null from public.tickets where id = '50000000-0000-0000-0000-000000000010'), 'resolved_at stamped');
select tests.logout();
select tests.ok((select send_email from public.notifications where kind = 'ticket_update' and user_id = :bob and title = 'Request resolved'), 'tenant told by push + email when resolved');
select tests.login(:sam);
update public.tickets set status = 'in_progress' where id = '50000000-0000-0000-0000-000000000010';
select tests.ok((select resolved_at is null from public.tickets where id = '50000000-0000-0000-0000-000000000010'), 'reopening clears resolved_at');
insert into public.ticket_messages (ticket_id, author_id, body) values ('50000000-0000-0000-0000-000000000010', :sam, 'Spoke to 703.');
insert into public.ticket_messages (ticket_id, author_id, body, internal) values ('50000000-0000-0000-0000-000000000010', :sam, 'Third complaint', true);
select tests.ok((select count(*) >= 1 from public.ticket_resolution_stats(now() - interval '1 day', now() + interval '1 day')), 'resolution stats available to staff');
select tests.logout();
select tests.eq((select count(*) from public.notifications where user_id = :bob and title = 'New reply from the front desk'), 1::bigint, 'tenant notified of public reply only, not internal note');

-- =========================================================================
-- Device faults → ticket + laundry announcement
-- =========================================================================
insert into public.device_events (device_id, type, payload) values
  ('60000000-0000-0000-0000-000000000001', 'fault', '{"channel": 0, "message": "Drawing 0 W while running"}');
select tests.eq((select state::text from public.laundry_machines where label = 'Washer 1'), 'fault', 'faulted washer marked out of service');
select tests.eq((select count(*) from public.tickets where source = 'system' and device_id = '60000000-0000-0000-0000-000000000001'), 1::bigint, 'fault opens a system ticket');
select tests.eq((select count(*) from public.announcements where source = 'system' and title = 'Washer 1 is out of service'), 1::bigint, 'fault posts a laundry announcement');
select tests.ok((select ticket_id is not null and announcement_id is not null from public.device_events where device_id = '60000000-0000-0000-0000-000000000001' order by id desc limit 1), 'event links to its ticket and announcement');
insert into public.device_events (device_id, type, payload) values
  ('60000000-0000-0000-0000-000000000001', 'anomaly', '{"message": "Lights on at 3am"}');
select tests.eq((select count(*) from public.tickets where source = 'system' and device_id = '60000000-0000-0000-0000-000000000001'), 1::bigint, 'repeat events add to the open ticket');
select tests.login(:alice);
select tests.eq((select count(*) from public.announcements where title = 'Washer 1 is out of service'), 1::bigint, 'tenants see the system announcement');
select tests.logout();
select tests.login(:sam);
update public.tickets set status = 'resolved' where source = 'system' and device_id = '60000000-0000-0000-0000-000000000001';
select tests.logout();
select tests.eq((select state::text from public.laundry_machines where label = 'Washer 1'), 'idle', 'resolving the ticket returns the washer to service');

-- =========================================================================
-- Booking rules (test-room: 08:00–23:00, 30–120 min, 2/week/unit, 14 days)
-- =========================================================================
select tests.login(:bob);
select tests.throws($$insert into public.bookings (amenity_id, tenant_id, unit, period) values ('30000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', '702', tests.slot(2, 6, 60))$$, 'before opening hours', 'P0001');
select tests.throws($$insert into public.bookings (amenity_id, tenant_id, unit, period) values ('30000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', '702', tests.slot(2, 22, 120))$$, 'runs past closing', 'P0001');
select tests.throws($$insert into public.bookings (amenity_id, tenant_id, unit, period) values ('30000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', '702', tests.slot(2, 12, 180))$$, 'longer than the maximum', 'P0001');
select tests.throws($$insert into public.bookings (amenity_id, tenant_id, unit, period) values ('30000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', '702', tests.slot(2, 12, 15))$$, 'shorter than the minimum', 'P0001');
select tests.throws($$insert into public.bookings (amenity_id, tenant_id, unit, period) values ('30000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', '702', tstzrange(lower(tests.slot(2, 12, 60)) + interval '7 min', lower(tests.slot(2, 12, 60)) + interval '67 min'))$$, 'not on the quarter hour', 'P0001');
select tests.throws($$insert into public.bookings (amenity_id, tenant_id, unit, period) values ('30000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', '702', tests.slot(-1, 12, 60))$$, 'in the past', 'P0001');
select tests.throws($$insert into public.bookings (amenity_id, tenant_id, unit, period) values ('30000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', '702', tests.slot(20, 12, 60))$$, 'beyond the booking window', 'P0001');
select tests.logout();

insert into public.amenity_blackouts (amenity_id, period, reason) values
  ('30000000-0000-0000-0000-000000000001', tests.slot(5, 8, 15 * 60), 'Carpet cleaning');
select tests.login(:bob);
select tests.throws($$insert into public.bookings (amenity_id, tenant_id, unit, period) values ('30000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', '702', tests.slot(5, 12, 60))$$, 'during a blackout', 'P0001');

-- Weekly limit: two per unit per Monday–Sunday week. Use next week's Monday
-- and Tuesday so both fall in the same week whatever today is.
create temp table nw as select (8 - extract(isodow from (now() at time zone 'America/Toronto')::date))::int as mon;
select tests.eq(tests.rows(format($$insert into public.bookings (amenity_id, tenant_id, unit, period) values ('30000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', '702', tests.slot(%s, 12, 60))$$, (select mon from nw))), 1::bigint, 'first booking of the week');
select tests.eq(tests.rows(format($$insert into public.bookings (amenity_id, tenant_id, unit, period) values ('30000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', '702', tests.slot(%s, 15, 60))$$, (select mon from nw) + 1)), 1::bigint, 'second booking of the week');
select tests.throws(format($$insert into public.bookings (amenity_id, tenant_id, unit, period) values ('30000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', '702', tests.slot(%s, 18, 60))$$, (select mon from nw) + 2), 'third booking in a week is over the unit limit', 'P0001');
select tests.ok((select count(*) = 2 from public.notifications where kind = 'booking_confirmed' and user_id = :bob), 'each booking sends a confirmation');
select tests.ok((select bool_and(send_email and send_push) from public.notifications where kind = 'booking_confirmed'), 'confirmation goes by push and email');
select tests.logout();

-- Staff can book beyond the unit limit (e.g. building events), not into a blackout.
select tests.login(:sam);
select tests.eq(tests.rows(format($$insert into public.bookings (amenity_id, tenant_id, unit, period) values ('30000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', '702', tests.slot(%s, 18, 60))$$, (select mon from nw) + 2)), 1::bigint, 'staff can book past the weekly limit');
select tests.throws($$insert into public.bookings (amenity_id, tenant_id, unit, period) values ('30000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', '702', tests.slot(5, 12, 60))$$, 'staff still cannot book into a blackout', 'P0001');
select tests.ok((select count(*) >= 1 from public.amenity_usage(now() - interval '1 day', now() + interval '30 days')), 'usage stats available to staff');
select tests.logout();

-- Buffer between bookings.
update public.amenities set buffer_minutes = 15 where id = '30000000-0000-0000-0000-000000000001';
select tests.login(:alice);
select tests.throws(format($$insert into public.bookings (amenity_id, tenant_id, unit, period) values ('30000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', '502', tests.slot(%s, 13, 60))$$, (select mon from nw)), 'booking right after another needs the buffer', 'P0001');
select tests.logout();
update public.amenities set buffer_minutes = 0 where id = '30000000-0000-0000-0000-000000000001';

-- =========================================================================
-- Maintenance
-- =========================================================================
insert into public.amenities (id, slug, name, open_time, close_time, min_notice_minutes)
values ('30000000-0000-0000-0000-000000000002', 'always-open', 'Always Open', '00:00', '00:00', 0);
insert into public.bookings (id, amenity_id, tenant_id, unit, period) values
  ('80000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', :alice, '502', tstzrange(now() + interval '20 min', now() + interval '25 min'));
alter table public.bookings disable trigger bookings_validate;
insert into public.bookings (id, amenity_id, tenant_id, unit, period) values
  ('80000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', :alice, '502', tstzrange(now() - interval '3 hours', now() - interval '2 hours'));
alter table public.bookings enable trigger bookings_validate;

select tests.ok((public.run_maintenance() ->> 'reminders')::int >= 1, 'maintenance sends reminders for bookings within the hour');
select tests.ok((select reminder_sent_at is not null from public.bookings where id = '80000000-0000-0000-0000-000000000001'), 'reminder stamped');
select tests.eq((select status::text from public.bookings where id = '80000000-0000-0000-0000-000000000002'), 'completed', 'past bookings are completed');
select tests.eq((public.run_maintenance() ->> 'reminders')::int, 0, 'reminders are sent once');
select tests.login(:alice);
select tests.throws($$select public.run_maintenance()$$, 'tenants cannot run maintenance', '42501');
select tests.logout();

-- =========================================================================
-- Offline devices: brief drops don't open tickets; 15 minutes does
-- =========================================================================
insert into public.devices (id, hardware_id, name, type, location, status, last_seen)
values ('60000000-0000-0000-0000-000000000009', 'pir-blip', 'Blip PIR', 'pir', 'Gym', 'online', now() - interval '20 minutes');
insert into public.device_events (device_id, type) values ('60000000-0000-0000-0000-000000000009', 'offline');
select tests.eq((select status::text from public.devices where id = '60000000-0000-0000-0000-000000000009'), 'offline', 'offline event marks the device offline');
select tests.eq((select count(*) from public.tickets where device_id = '60000000-0000-0000-0000-000000000009'), 0::bigint, 'going offline does not open a ticket by itself');
insert into public.device_events (device_id, type) values ('60000000-0000-0000-0000-000000000009', 'online');
update public.devices set last_seen = now() where id = '60000000-0000-0000-0000-000000000009';
select tests.eq(public.escalate_offline_devices(), 0, 'a device that came back is not escalated');
insert into public.device_events (device_id, type) values ('60000000-0000-0000-0000-000000000009', 'offline');
update public.devices set last_seen = now() - interval '16 minutes' where id = '60000000-0000-0000-0000-000000000009';
select tests.eq(public.escalate_offline_devices(), 1, 'offline for 15+ minutes opens a ticket');
select tests.eq(public.escalate_offline_devices(), 0, 'and only one');

-- =========================================================================
-- EV charge requests
-- =========================================================================
select tests.login(:alice);
select tests.throws(format($$insert into public.ev_sessions (tenant_id, requested_kwh, departure_time) values (%L, 20, now() + interval '5 minutes')$$, :alice), 'departure must be at least 15 minutes away', 'P0001');
select tests.throws(format($$insert into public.ev_sessions (tenant_id, requested_kwh, departure_time) values (%L, 20, now() + interval '10 days')$$, :alice), 'departure within 7 days', 'P0001');
-- Alice already has an active request from 02.
select tests.throws(format($$insert into public.ev_sessions (tenant_id, requested_kwh, departure_time) values (%L, 20, now() + interval '9 hours')$$, :alice), 'one active request per tenant', 'P0001');
select tests.ok((select count(*) >= 0 from public.ev_charger_status()), 'tenants can see charger availability');
select tests.logout();

-- =========================================================================
-- Staff analytics helpers
-- =========================================================================
select tests.login(:sam);
select tests.ok((select scheduled >= 3 and on_time = 0 from public.shuttle_on_time_stats(now() - interval '1 day', now() + interval '1 day')), 'shuttle on-time stats count past runs; a 5-min-late start is not on time');
select tests.ok((select total >= 1 from public.device_health()), 'device health summary');
select tests.ok((select approved >= 2 from public.tenant_counts()), 'tenant counts');
select tests.logout();
select tests.login(:alice);
select tests.eq((select total from public.device_health()), 0, 'tenants get no device health');
select tests.eq((select count(*) from public.shuttle_on_time_stats(now() - interval '1 day', now())), 1::bigint, 'aggregate always returns one row');
select tests.eq((select scheduled from public.shuttle_on_time_stats(now() - interval '1 day', now())), 0, 'but tenants see zero');
select tests.logout();
