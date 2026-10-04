-- Marq Living — Stage 3: announcement delivery, read stats, ticket workflow,
-- and system-raised tickets/announcements from device faults.

-- ===========================================================================
-- Announcements
-- ===========================================================================

-- Approved tenants in an announcement's audience.
create or replace function public.announcement_recipients(a public.announcements) returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(p.id), '{}')
    from public.profiles p
   where p.status = 'approved' and p.role = 'tenant'
     and case a.audience
           when 'building' then true
           when 'floors' then p.floor = any (a.target_floors)
           when 'units' then p.unit = any (a.target_units)
         end
$$;
revoke all on function public.announcement_recipients(public.announcements) from public, anon, authenticated;

-- Push urgent posts once they're published. Scheduled posts are picked up by
-- run_maintenance() when publish_at passes.
create or replace function public.deliver_announcement(p_id uuid) returns integer
language plpgsql security definer set search_path = ''
as $$
declare a public.announcements; n integer;
begin
  update public.announcements set push_sent_at = now()
   where id = p_id and urgent and push_sent_at is null and publish_at <= now()
     and (expires_at is null or expires_at > now())
  returning * into a;
  if not found then return 0; end if;
  n := public.notify_users(public.announcement_recipients(a), 'announcement',
         a.title, left(a.body, 180), '/announcements#' || a.id, true, true, false,
         jsonb_build_object('announcement_id', a.id));
  return n;
end;
$$;
revoke all on function public.deliver_announcement(uuid) from public, anon, authenticated;

create or replace function public.on_announcement_saved() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.urgent and new.push_sent_at is null and new.publish_at <= now() then
    perform public.deliver_announcement(new.id);
  end if;
  return null;
end;
$$;
create trigger announcements_deliver after insert or update of urgent, publish_at on public.announcements
  for each row execute function public.on_announcement_saved();

-- Staff view: audience size and how many have read each post.
create or replace function public.announcement_stats()
returns table (announcement_id uuid, audience_size int, read_count int)
language sql stable security definer set search_path = ''
as $$
  select a.id, cardinality(public.announcement_recipients(a)),
         (select count(*)::int from public.announcement_reads r where r.announcement_id = a.id)
    from public.announcements a
   where public.is_staff()
$$;

-- ===========================================================================
-- Tickets
-- ===========================================================================

create or replace function public.on_ticket_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.source = 'tenant' then
      perform public.notify_users(public.staff_ids(), 'ticket_new',
        format('New request from %s', coalesce(new.unit, 'a tenant')), new.subject,
        '/staff/tickets/' || new.id, new.priority in ('high', 'urgent'), false, false,
        jsonb_build_object('ticket_id', new.id));
    end if;
    return null;
  end if;

  if new.status is distinct from old.status and new.tenant_id is not null then
    perform public.notify_users(array[new.tenant_id], 'ticket_update',
      case new.status when 'resolved' then 'Request resolved'
                      when 'in_progress' then 'We''re on it'
                      else 'Request reopened' end,
      new.subject, '/requests/' || new.id, false, true, new.status = 'resolved',
      jsonb_build_object('ticket_id', new.id));
  end if;
  return null;
end;
$$;
create trigger tickets_notify after insert or update of status on public.tickets
  for each row execute function public.on_ticket_change();

-- resolved_at follows status.
create or replace function public.set_ticket_resolved_at() returns trigger
language plpgsql as $$
begin
  if new.status = 'resolved' and (tg_op = 'INSERT' or old.status <> 'resolved') then
    new.resolved_at := now();
  elsif new.status <> 'resolved' then
    new.resolved_at := null;
  end if;
  return new;
end;
$$;
create trigger tickets_resolved_at before insert or update of status on public.tickets
  for each row execute function public.set_ticket_resolved_at();

create or replace function public.on_ticket_message() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare t public.tickets;
begin
  select * into t from public.tickets where id = new.ticket_id;
  if t.tenant_id is not null and new.author_id = t.tenant_id then
    -- Tenant replied: tell staff, and reopen a resolved ticket.
    perform public.notify_users(public.staff_ids(), 'ticket_update',
      format('Reply on %s', t.subject), left(new.body, 180), '/staff/tickets/' || t.id,
      false, false, false, jsonb_build_object('ticket_id', t.id));
  elsif not new.internal and t.tenant_id is not null then
    perform public.notify_users(array[t.tenant_id], 'ticket_update',
      'New reply from the front desk', left(new.body, 180), '/requests/' || t.id,
      false, true, false, jsonb_build_object('ticket_id', t.id));
  end if;
  update public.tickets set updated_at = now() where id = t.id;
  return null;
end;
$$;
create trigger ticket_messages_notify after insert on public.ticket_messages
  for each row execute function public.on_ticket_message();

-- Staff analytics: hours from open to resolved.
create or replace function public.ticket_resolution_stats(p_from timestamptz, p_to timestamptz)
returns table (category public.ticket_category, opened int, resolved int,
               median_hours numeric, avg_hours numeric)
language sql stable security definer set search_path = ''
as $$
  select t.category, count(*)::int, count(t.resolved_at)::int,
         round((percentile_cont(0.5) within group (order by extract(epoch from t.resolved_at - t.created_at) / 3600)
                filter (where t.resolved_at is not null))::numeric, 1),
         round(avg(extract(epoch from t.resolved_at - t.created_at) / 3600)::numeric, 1)
    from public.tickets t
   where public.is_staff() and t.created_at >= p_from and t.created_at < p_to
   group by t.category
   order by 2 desc
$$;

-- ===========================================================================
-- Device faults → tickets and announcements
-- ===========================================================================

-- A fault or anomaly opens one system ticket per device (until resolved) and
-- alerts staff. A laundry machine fault also marks the machine out of service
-- and posts a building announcement so tenants don't waste a trip.
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

  if new.type not in ('fault', 'anomaly', 'offline') then
    return null;
  end if;

  if new.type = 'offline' then
    update public.devices set status = 'offline' where id = d.id and status <> 'retired';
  elsif new.type = 'fault' then
    update public.devices set status = 'fault' where id = d.id and status <> 'retired';
  end if;

  select id into t_id from public.tickets
   where device_id = d.id and status <> 'resolved' and source = 'system'
   order by created_at desc limit 1;

  if t_id is null then
    insert into public.tickets (category, subject, description, priority, source, device_id)
    values ('device_fault',
            format('%s: %s', d.name, case new.type when 'offline' then 'offline' when 'fault' then 'fault' else 'abnormal reading' end),
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
create trigger device_events_raise after insert on public.device_events
  for each row execute function public.on_device_event();

-- When a faulted machine's ticket is resolved, put it back in service.
create or replace function public.on_fault_ticket_resolved() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'resolved' and old.status <> 'resolved' and new.device_id is not null then
    update public.devices set status = 'online' where id = new.device_id and status = 'fault';
    update public.laundry_machines set state = 'idle', state_since = now()
     where device_id = new.device_id and state = 'fault';
  end if;
  return null;
end;
$$;
create trigger tickets_fault_resolved after update of status on public.tickets
  for each row execute function public.on_fault_ticket_resolved();
