-- Marq Living — Stage 5/6: hooks the ingest service calls in the app DB.

-- A machine finished: tell everyone waiting for that kind of machine, once.
create or replace function public.laundry_machine_freed(p_machine uuid) returns integer
language plpgsql security definer set search_path = ''
as $$
declare m public.laundry_machines; n integer;
begin
  select * into m from public.laundry_machines where id = p_machine;
  if not found then return 0; end if;
  with w as (
    delete from public.laundry_watchers where kind = m.kind returning user_id
  )
  select public.notify_users(coalesce(array_agg(user_id), '{}'), 'laundry_free',
           format('A %s is free', m.kind), format('%s just finished.', m.label), '/laundry',
           false, true, false, jsonb_build_object('machine_id', m.id))
    into n from w;
  return n;
end;
$$;
revoke all on function public.laundry_machine_freed(uuid) from public, anon, authenticated;

-- Laundry usage for analytics: completed cycles per machine.
create or replace function public.laundry_usage(p_from timestamptz, p_to timestamptz)
returns table (machine_id uuid, label text, kind public.machine_kind, cycles int)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.label, m.kind,
         (select count(*)::int from public.device_events e
           where e.device_id = m.device_id and e.type = 'state_change'
             and (e.payload ->> 'channel')::int = m.channel and e.payload ->> 'to' = 'running'
             and e.occurred_at >= p_from and e.occurred_at < p_to)
    from public.laundry_machines m
   where public.is_staff()
   order by m.kind, m.label
$$;
