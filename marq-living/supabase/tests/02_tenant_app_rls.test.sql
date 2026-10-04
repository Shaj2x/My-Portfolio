-- RLS for the tenant app and operations tables. Builds on the users created
-- in 01_identity: alice (approved, unit 502, floor 5), bob (approved, 702,
-- floor 7), carol (pending, floor 5), sam (staff), ada (admin), dan
-- (suspended driver).
\ir helpers.sql

\set alice  '''a0000000-0000-0000-0000-00000000000a'''
\set bob    '''b0000000-0000-0000-0000-00000000000b'''
\set carol  '''c0000000-0000-0000-0000-00000000000c'''
\set sam    '''50000000-0000-0000-0000-000000000005'''
\set ada    '''ad000000-0000-0000-0000-0000000000ad'''
\set dee    '''dd000000-0000-0000-0000-0000000000dd'''

insert into auth.users (id, email, invited_at, raw_user_meta_data)
values (:dee, 'dee@marq.test', now(), '{"full_name":"Dee Driver","invited_role":"driver"}');

-- Reference data, inserted as the backend.
insert into public.routes (id, name) values ('10000000-0000-0000-0000-000000000001', 'Campus Loop');
insert into public.runs (id, route_id, service_date, scheduled_departure, status) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, now() - interval '5 min', 'scheduled'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', current_date, now() + interval '2 hours', 'scheduled');
insert into public.amenities (id, slug, name) values ('30000000-0000-0000-0000-000000000001', 'test-room', 'Test Room');

-- =========================================================================
-- Announcements: targeting and scheduled publishing
-- =========================================================================
select tests.login(:sam);
insert into public.announcements (id, title, body, audience, target_floors, target_units, publish_at, created_by) values
  ('40000000-0000-0000-0000-000000000001', 'Water shutoff', 'Building-wide', 'building', '{}', '{}', now() - interval '1 min', :sam),
  ('40000000-0000-0000-0000-000000000002', 'Floor 5 painting', 'Floor 5', 'floors', '{5}', '{}', now() - interval '1 min', :sam),
  ('40000000-0000-0000-0000-000000000003', 'Unit 702 inspection', 'Unit 702', 'units', '{}', '{702}', now() - interval '1 min', :sam),
  ('40000000-0000-0000-0000-000000000004', 'Future post', 'Not yet', 'building', '{}', '{}', now() + interval '1 day', :sam),
  ('40000000-0000-0000-0000-000000000005', 'Old post', 'Expired', 'building', '{}', '{}', now() - interval '2 days', :sam);
update public.announcements set expires_at = now() - interval '1 day' where id = '40000000-0000-0000-0000-000000000005';
select tests.eq((select count(*) from public.announcements), 5::bigint, 'staff sees all announcements incl. scheduled and expired');
select tests.throws($$insert into public.announcements (title, body, audience) values ('x', 'y', 'floors')$$, 'floor-targeted post needs floors');
select tests.logout();

select tests.login(:alice);
select tests.eq((select string_agg(title, ',' order by title) from public.announcements), 'Floor 5 painting,Water shutoff', 'floor 5 tenant sees building + floor 5 only');
select tests.throws($$insert into public.announcements (title, body) values ('x', 'y')$$, 'tenant cannot post announcements', '42501');
select tests.eq(tests.rows($$insert into public.announcement_reads (announcement_id, user_id) values ('40000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a')$$), 1::bigint, 'tenant marks a visible post read');
select tests.throws($$insert into public.announcement_reads (announcement_id, user_id) values ('40000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a')$$, 'tenant cannot mark an untargeted post read', '42501');
select tests.throws($$insert into public.announcement_reads (announcement_id, user_id) values ('40000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b')$$, 'tenant cannot write reads for someone else', '42501');
select tests.logout();

select tests.login(:bob);
select tests.eq((select string_agg(title, ',' order by title) from public.announcements), 'Unit 702 inspection,Water shutoff', 'unit 702 tenant sees building + unit post');
select tests.eq((select count(*) from public.announcement_reads), 0::bigint, 'tenant cannot see others'' read receipts');
select tests.logout();

select tests.login(:carol);
select tests.eq((select count(*) from public.announcements), 0::bigint, 'pending tenant sees no announcements');
select tests.logout();

select tests.login(:sam);
select tests.eq((select count(*) from public.announcement_reads), 1::bigint, 'staff sees read receipts');
select tests.logout();

-- =========================================================================
-- Tickets
-- =========================================================================
select tests.login(:alice);
insert into public.tickets (id, tenant_id, unit, category, subject, description, photo_path)
values ('50000000-0000-0000-0000-000000000001', :alice, '502', 'maintenance', 'Leaky tap', 'Kitchen', 'a0000000-0000-0000-0000-00000000000a/tap.jpg');
select tests.throws(format($$insert into public.tickets (tenant_id, unit, category, subject) values (%L, '702', 'other', 'x')$$, :bob), 'tenant cannot open a ticket for someone else', '42501');
select tests.throws(format($$insert into public.tickets (tenant_id, unit, category, subject) values (%L, '702', 'other', 'x')$$, :alice), 'tenant cannot open a ticket for another unit', '42501');
select tests.throws(format($$insert into public.tickets (tenant_id, unit, category, subject, status) values (%L, '502', 'other', 'x', 'resolved')$$, :alice), 'tenant cannot open a pre-resolved ticket', '42501');
select tests.throws(format($$insert into public.tickets (tenant_id, unit, category, subject, source) values (%L, '502', 'other', 'x', 'system')$$, :alice), 'tenant cannot spoof a system ticket', '42501');
select tests.throws(format($$insert into public.tickets (tenant_id, unit, category, subject, photo_path) values (%L, '502', 'other', 'x', 'b0000000-0000-0000-0000-00000000000b/x.jpg')$$, :alice), 'tenant cannot attach a photo from another user''s folder', '42501');
select tests.eq(tests.rows($$update public.tickets set status = 'resolved'$$), 0::bigint, 'tenant cannot change ticket status');
insert into public.ticket_messages (ticket_id, author_id, body) values ('50000000-0000-0000-0000-000000000001', :alice, 'Still dripping');
select tests.throws(format($$insert into public.ticket_messages (ticket_id, author_id, body, internal) values ('50000000-0000-0000-0000-000000000001', %L, 'x', true)$$, :alice), 'tenant cannot post internal notes', '42501');
select tests.logout();

select tests.login(:bob);
select tests.eq((select count(*) from public.tickets), 0::bigint, 'tenant cannot see another tenant''s tickets');
select tests.eq((select count(*) from public.ticket_messages), 0::bigint, 'tenant cannot see another tenant''s messages');
select tests.throws(format($$insert into public.ticket_messages (ticket_id, author_id, body) values ('50000000-0000-0000-0000-000000000001', %L, 'hi')$$, :bob), 'tenant cannot reply on another tenant''s ticket', '42501');
select tests.logout();

select tests.login(:sam);
update public.tickets set status = 'in_progress', assigned_to = :sam where id = '50000000-0000-0000-0000-000000000001';
insert into public.ticket_messages (ticket_id, author_id, body) values ('50000000-0000-0000-0000-000000000001', :sam, 'Plumber booked for Tuesday');
insert into public.ticket_messages (ticket_id, author_id, body, internal) values ('50000000-0000-0000-0000-000000000001', :sam, 'Second leak this year in 502', true);
select tests.throws(format($$insert into public.ticket_messages (ticket_id, author_id, body) values ('50000000-0000-0000-0000-000000000001', %L, 'x')$$, :alice), 'staff cannot post as someone else', '42501');
select tests.logout();

select tests.login(:alice);
select tests.eq((select count(*) from public.ticket_messages), 2::bigint, 'tenant sees the thread without internal notes');
select tests.eq((select status::text from public.tickets), 'in_progress', 'tenant sees status updates');
select tests.logout();

-- =========================================================================
-- Bookings
-- =========================================================================
select tests.login(:alice);
insert into public.bookings (amenity_id, tenant_id, unit, period)
values ('30000000-0000-0000-0000-000000000001', :alice, '502', tests.slot(1, 19, 120));
select tests.throws(format($$insert into public.bookings (amenity_id, tenant_id, unit, period) values ('30000000-0000-0000-0000-000000000001', %L, '702', tests.slot(3, 12, 60))$$, :bob), 'tenant cannot book as someone else', '42501');
select tests.logout();

select tests.login(:bob);
select tests.eq((select count(*) from public.bookings), 0::bigint, 'tenant cannot see another tenant''s booking');
select tests.eq((select count(*) from public.amenity_busy_periods('30000000-0000-0000-0000-000000000001', now(), now() + interval '7 days')), 1::bigint, 'busy periods show the slot without who booked it');
select tests.throws(format($$insert into public.bookings (amenity_id, tenant_id, unit, period) values ('30000000-0000-0000-0000-000000000001', %L, '702', tests.slot(1, 20, 120))$$, :bob), 'overlapping booking is rejected', '23P01');
select tests.eq(tests.rows($$update public.bookings set status = 'cancelled'$$), 0::bigint, 'tenant cannot cancel another tenant''s booking');
select tests.logout();

select tests.login(:carol);
select tests.eq((select count(*) from public.amenity_busy_periods('30000000-0000-0000-0000-000000000001', now(), now() + interval '7 days')), 0::bigint, 'pending tenant gets no availability data');
select tests.throws(format($$insert into public.bookings (amenity_id, tenant_id, unit, period) values ('30000000-0000-0000-0000-000000000001', %L, '503', tests.slot(4, 12, 60))$$, :carol), 'pending tenant cannot book', '42501');
select tests.logout();

select tests.login(:alice);
select tests.throws($$update public.bookings set energy_kwh = 0$$, 'tenant cannot write booking energy', '42501');
select tests.eq(tests.rows($$update public.bookings set status = 'cancelled'$$), 1::bigint, 'tenant cancels own booking');
select tests.logout();

-- =========================================================================
-- Shuttle: runs and live location
-- =========================================================================
select tests.login(:dee);
select tests.eq((public.start_run('20000000-0000-0000-0000-000000000001')).status::text, 'active', 'driver starts a run');
insert into public.shuttle_locations (run_id, lat, lng) values ('20000000-0000-0000-0000-000000000001', 42.9849, -81.2453);
select tests.throws($$insert into public.shuttle_locations (run_id, lat, lng) values ('20000000-0000-0000-0000-000000000002', 42.98, -81.24)$$, 'driver cannot post location for a run that is not active', '42501');
select tests.eq(tests.rows(format($$update public.runs set driver_id = %L$$, :alice)), 0::bigint, 'drivers cannot edit runs directly');
select tests.logout();

select tests.login(:alice);
select tests.eq((select count(*) from public.shuttle_locations), 1::bigint, 'tenant sees location of the active run');
select tests.throws($$insert into public.shuttle_locations (run_id, lat, lng) values ('20000000-0000-0000-0000-000000000001', 0, 0)$$, 'tenant cannot post shuttle locations', '42501');
select tests.eq(tests.rows($$update public.runs set status = 'cancelled', cancel_reason = 'x'$$), 0::bigint, 'tenant cannot change runs');
select tests.logout();

select tests.login(:carol);
select tests.eq((select count(*) from public.shuttle_locations), 0::bigint, 'pending tenant cannot track the shuttle');
select tests.eq((select count(*) from public.runs), 0::bigint, 'pending tenant cannot see runs');
select tests.logout();

-- Run ends -> location no longer visible even before it's purged.
update public.runs set status = 'completed', ended_at = now() where id = '20000000-0000-0000-0000-000000000001';
select tests.login(:alice);
select tests.eq((select count(*) from public.shuttle_locations), 0::bigint, 'tenant cannot see locations after the run ends');
select tests.logout();

-- =========================================================================
-- Operations tables
-- =========================================================================
insert into public.devices (id, hardware_id, name, type, location)
values ('60000000-0000-0000-0000-000000000001', 'ct-laundry-01', 'Laundry CT node', 'ct_node', 'Laundry room');
insert into public.laundry_machines (label, kind, device_id, channel, state)
values ('Washer 1', 'washer', '60000000-0000-0000-0000-000000000001', 0, 'idle');

select tests.login(:alice);
select tests.eq((select count(*) from public.devices), 0::bigint, 'tenant cannot see devices');
select tests.eq((select count(*) from public.laundry_machines), 1::bigint, 'tenant sees laundry availability');
select tests.eq((select count(*) from public.control_commands), 0::bigint, 'tenant cannot see the command log');
select tests.throws($$insert into public.control_commands (device_id, command, source, user_id) values ('60000000-0000-0000-0000-000000000001', '{}', 'user', 'a0000000-0000-0000-0000-00000000000a')$$, 'tenant cannot send device commands', '42501');
insert into public.laundry_watchers (user_id, kind) values (:alice, 'washer');
insert into public.ev_sessions (tenant_id, requested_kwh, departure_time) values (:alice, 20, now() + interval '10 hours');
select tests.throws(format($$insert into public.ev_sessions (tenant_id, requested_kwh, departure_time, status) values (%L, 20, now() + interval '10 hours', 'charging')$$, :alice), 'tenant cannot create a session already charging');
select tests.logout();

select tests.login(:bob);
select tests.eq((select count(*) from public.ev_sessions), 0::bigint, 'tenant cannot see another tenant''s EV session');
select tests.eq((select count(*) from public.laundry_watchers), 0::bigint, 'tenant cannot see another tenant''s laundry watch');
select tests.logout();

select tests.login(:sam);
select tests.eq((select count(*) from public.devices), 1::bigint, 'staff sees devices');
select tests.throws($$insert into public.devices (hardware_id, name, type, location) values ('pir-x', 'x', 'pir', 'x')$$, 'staff cannot register devices', '42501');
select tests.eq(tests.rows(format($$insert into public.control_commands (device_id, command, source, user_id) values ('60000000-0000-0000-0000-000000000001', '{"relay":1,"state":"on"}', 'user', %L)$$, :sam)), 1::bigint, 'staff issues a manual command attributed to themselves');
select tests.throws(format($$insert into public.control_commands (device_id, command, source, user_id) values ('60000000-0000-0000-0000-000000000001', '{}', 'user', %L)$$, :ada), 'staff cannot attribute a command to someone else', '42501');
select tests.eq(tests.rows($$update public.control_commands set status = 'acked'$$), 0::bigint, 'command log is append-only from the app');
select tests.eq(tests.rows($$delete from public.control_commands$$), 0::bigint, 'command log cannot be deleted from the app');
select tests.logout();

select tests.login(:ada);
insert into public.devices (hardware_id, name, type, location) values ('pir-theatre-01', 'Theatre PIR', 'pir', 'Theatre room');
insert into public.automation_rules (name, trigger, actions)
values ('Theatre lights off', '{"type":"booking.ended","room":"theatre"}', '[{"type":"set_lights","room":"theatre","state":"off"}]');
select tests.throws($$insert into public.automation_rules (name, trigger, actions) values ('bad', '{}', '[]')$$, 'rule needs a trigger type and at least one action');
select tests.logout();

-- =========================================================================
-- Storage
-- =========================================================================
select tests.login(:alice);
insert into storage.objects (bucket_id, name) values ('ticket-photos', 'a0000000-0000-0000-0000-00000000000a/tap.jpg');
select tests.throws($$insert into storage.objects (bucket_id, name) values ('ticket-photos', 'b0000000-0000-0000-0000-00000000000b/x.jpg')$$, 'tenant cannot upload into another user''s folder', '42501');
select tests.logout();

select tests.login(:bob);
select tests.eq((select count(*) from storage.objects), 0::bigint, 'tenant cannot read another tenant''s photos');
select tests.logout();

select tests.login(:carol);
select tests.throws($$insert into storage.objects (bucket_id, name) values ('ticket-photos', 'c0000000-0000-0000-0000-00000000000c/x.jpg')$$, 'pending tenant cannot upload', '42501');
select tests.logout();

select tests.login(:sam);
select tests.eq((select count(*) from storage.objects), 1::bigint, 'staff can read ticket photos');
select tests.logout();
