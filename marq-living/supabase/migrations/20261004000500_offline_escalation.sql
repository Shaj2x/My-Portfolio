-- Marq Living — devices that drop offline briefly (reboots, firmware
-- updates, a broker restart) shouldn't open tickets. Offline now only marks
-- the device; run_maintenance() escalates devices still offline after 15
-- minutes into one system ticket each.

create or replace function public.escalate_offline_devices(p_after interval default interval '15 minutes') returns integer
language plpgsql security definer set search_path = ''
as $$
declare d record; n integer := 0;
begin
  for d in
    select dev.id, dev.name, dev.location, dev.last_seen
      from public.devices dev
     where dev.status = 'offline'
       and coalesce(dev.last_seen, dev.updated_at) < now() - p_after
       and not exists (select 1 from public.tickets t
                        where t.device_id = dev.id and t.source = 'system' and t.status <> 'resolved')
  loop
    insert into public.tickets (category, subject, description, priority, source, device_id)
    values ('device_fault', format('%s: offline', d.name),
            format('No data from %s (%s) since %s.', d.name, d.location,
                   coalesce(to_char(d.last_seen at time zone public.building_tz(), 'YYYY-MM-DD HH24:MI'), 'it was installed')),
            'normal', 'system', d.id);
    perform public.notify_staff(format('%s is offline', d.name), 'It has not reported for 15 minutes.', '/staff/devices',
                                jsonb_build_object('device_id', d.id), false);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.escalate_offline_devices(interval) from public, anon, authenticated;

-- Same as before, except offline events only update the device.
create or replace function public.on_device_event() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  d public.devices;
  t_id uuid;
  m record;
  a_id uuid;
  detail text := coalesce(new.payload ->> 'message', new.payload ->> 'reason', new.type::text);
begin
  select * into d from public.devices where id = new.device_id;

  if new.type = 'online' then
    update public.devices set status = 'online', last_seen = greatest(coalesce(last_seen, new.occurred_at), new.occurred_at)
     where id = d.id and status in ('offline', 'provisioning');
    return null;
  end if;
  if new.type = 'offline' then
    update public.devices set status = 'offline' where id = d.id and status not in ('retired', 'fault');
    return null;
  end if;
  if new.type not in ('fault', 'anomaly') then
    return null;
  end if;

  if new.type = 'fault' then
    update public.devices set status = 'fault' where id = d.id and status <> 'retired';
  end if;

  select id into t_id from public.tickets
   where device_id = d.id and status <> 'resolved' and source = 'system'
   order by created_at desc limit 1;

  if t_id is null then
    insert into public.tickets (category, subject, description, priority, source, device_id)
    values ('device_fault',
            format('%s: %s', d.name, case new.type when 'fault' then 'fault' else 'abnormal reading' end),
            format('%s (%s). Raised automatically at %s.', detail, d.location,
                   to_char(new.occurred_at at time zone public.building_tz(), 'YYYY-MM-DD HH24:MI')),
            (case new.type when 'fault' then 'high' else 'normal' end)::public.ticket_priority,
            'system', d.id)
    returning id into t_id;
    perform public.notify_staff(format('%s needs attention', d.name), detail,
                                '/staff/tickets/' || t_id, jsonb_build_object('device_id', d.id, 'event_id', new.id),
                                new.type = 'fault');
  else
    insert into public.ticket_messages (ticket_id, body, internal)
    values (t_id, format('Another %s event: %s', new.type, detail), true);
  end if;

  if new.type = 'fault' then
    for m in
      select lm.id, lm.label from public.laundry_machines lm
       where lm.device_id = d.id
         and (new.payload ->> 'channel' is null or lm.channel = (new.payload ->> 'channel')::smallint)
         and lm.state <> 'fault'
    loop
      update public.laundry_machines set state = 'fault', state_since = now(), est_done_at = null where id = m.id;
      insert into public.announcements (title, body, category, source, source_ref)
      values (format('%s is out of service', m.label),
              format('%s in the laundry room is out of service. We''ve logged it for repair — please use another machine.', m.label),
              'maintenance', 'system', jsonb_build_object('device_id', d.id, 'event_id', new.id, 'machine_id', m.id))
      returning id into a_id;
    end loop;
  end if;

  update public.device_events set ticket_id = t_id, announcement_id = a_id where id = new.id;
  return null;
end;
$$;

-- Maintenance now also escalates long-offline devices.
create or replace function public.run_maintenance() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  today date := (now() at time zone public.building_tz())::date;
  v_runs int; v_late int; v_posts int := 0; v_rem int := 0; v_done int; v_purged int; v_offline int;
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

  delete from public.shuttle_locations l using public.runs ru
   where ru.id = l.run_id and ru.status <> 'active';
  get diagnostics v_purged = row_count;

  v_offline := public.escalate_offline_devices();

  delete from public.notifications where read_at < now() - interval '60 days';

  return jsonb_build_object('runs_created', v_runs, 'late_flagged', v_late, 'posts_delivered', v_posts,
                            'reminders', v_rem, 'bookings_completed', v_done, 'locations_purged', v_purged,
                            'offline_escalated', v_offline);
end;
$$;
revoke all on function public.run_maintenance() from public, anon, authenticated;
