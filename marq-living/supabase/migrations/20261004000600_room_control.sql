-- Marq Living — Stage 7: manual room overrides from the staff app.
--
-- An override always beats automation: force_on (lights on, HVAC comfort)
-- or force_off (lights off, HVAC setback) for a while or until cleared.
-- The physical commands are queued as the staff member, so the command log
-- shows who did it; the automation engine dispatches them.

create or replace function public.set_room_override(
  p_room text, p_mode public.override_mode, p_minutes int default null
) returns public.rooms
language plpgsql security invoker set search_path = ''
as $$
declare
  r public.rooms;
  relay record;
  thermo uuid;
begin
  if not public.is_staff() then
    raise exception 'staff only' using errcode = '42501';
  end if;
  update public.rooms
     set override_mode = p_mode,
         override_until = case when p_mode = 'auto' or p_minutes is null then null else now() + make_interval(mins => p_minutes) end,
         override_by = auth.uid()
   where slug = p_room
  returning * into r;
  if not found then raise exception 'room not found' using errcode = 'P0002'; end if;
  if p_mode = 'auto' then return r; end if;

  select d.id, coalesce((d.config -> 'outputs' ->> 'lights')::int, 0) as lights_ch,
         coalesce((d.config -> 'outputs' ->> 'hvac')::int, 1) as hvac_ch
    into relay
    from public.devices d where d.id = any (r.device_ids) and d.type = 'relay' and d.status <> 'retired' limit 1;
  select d.id into thermo from public.devices d where d.id = any (r.device_ids) and d.type = 'thermostat' and d.status <> 'retired' limit 1;

  if relay.id is not null then
    insert into public.control_commands (device_id, room_id, command, source, user_id, reason)
    values (relay.id, r.id,
            jsonb_build_object('relay', jsonb_build_object('ch', relay.lights_ch, 'state', case p_mode when 'force_on' then 'on' else 'off' end)),
            'user', auth.uid(), format('Manual override: %s', replace(p_mode::text, '_', ' ')));
  end if;
  if coalesce(thermo, relay.id) is not null then
    insert into public.control_commands (device_id, room_id, command, source, user_id, reason)
    values (coalesce(thermo, relay.id), r.id,
            jsonb_build_object('hvac', jsonb_build_object(
              'mode', case p_mode when 'force_on' then 'comfort' else 'setback' end,
              'setpoint_c', case p_mode when 'force_on' then r.hvac_setpoints -> 'comfort_c' else r.hvac_setpoints -> 'setback_c' end)),
            'user', auth.uid(), format('Manual override: %s', replace(p_mode::text, '_', ' ')));
  end if;
  return r;
end;
$$;
revoke all on function public.set_room_override(text, public.override_mode, int) from public, anon;
grant execute on function public.set_room_override(text, public.override_mode, int) to authenticated;
