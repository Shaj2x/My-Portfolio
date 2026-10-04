-- Marq Living — Stage 8: guard tenant EV charge requests.

create or replace function public.validate_ev_request() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_staff() then
    return new; -- scheduler/service and staff
  end if;
  if new.departure_time < now() + interval '15 minutes' then
    raise exception 'Pick a departure at least 15 minutes from now.' using errcode = 'P0001';
  end if;
  if new.departure_time > now() + interval '7 days' then
    raise exception 'Requests can be up to 7 days ahead.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.ev_sessions s where s.tenant_id = new.tenant_id and s.id <> new.id
               and s.status in ('requested', 'scheduled', 'charging', 'paused')) then
    raise exception 'You already have a charge request. Cancel it to make a new one.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger ev_sessions_validate before insert on public.ev_sessions
  for each row execute function public.validate_ev_request();

-- Tenants see which chargers are busy without seeing whose car it is.
create or replace function public.ev_charger_status()
returns table (charger_id uuid, label text, max_kw numeric, busy boolean)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.label, c.max_kw,
         exists (select 1 from public.ev_sessions s where s.charger_id = c.id and s.status in ('scheduled', 'charging', 'paused'))
    from public.ev_chargers c
   where public.is_approved() and not c.fleet_only
   order by c.label
$$;
