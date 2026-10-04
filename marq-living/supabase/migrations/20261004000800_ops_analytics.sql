-- Marq Living — Stage 9: staff analytics helpers.

-- Shuttle reliability. A run is on time if it started within 5 minutes of
-- its scheduled departure (announced delays still count as late).
create or replace function public.shuttle_on_time_stats(p_from timestamptz, p_to timestamptz)
returns table (scheduled int, completed int, cancelled int, on_time int, on_time_pct numeric,
               avg_start_delay_min numeric, total_km numeric)
language sql stable security definer set search_path = ''
as $$
  select count(*)::int,
         count(*) filter (where r.status = 'completed')::int,
         count(*) filter (where r.status = 'cancelled')::int,
         count(*) filter (where r.started_at <= r.scheduled_departure + interval '5 minutes')::int,
         round(100.0 * count(*) filter (where r.started_at <= r.scheduled_departure + interval '5 minutes')
               / nullif(count(*) filter (where r.status in ('completed', 'active', 'cancelled') or r.started_at is not null
                                           or r.scheduled_departure < now()), 0), 1),
         round(avg(extract(epoch from r.started_at - r.scheduled_departure) / 60) filter (where r.started_at is not null)::numeric, 1),
         round(coalesce(sum(m.distance_km), 0), 1)
    from public.runs r left join public.shuttle_run_metrics m on m.run_id = r.id
   where public.is_staff() and r.scheduled_departure >= p_from and r.scheduled_departure < p_to
     and r.scheduled_departure < now()
$$;

-- Device health summary for the live dashboard.
create or replace function public.device_health()
returns table (total int, online int, offline int, fault int, provisioning int, low_battery int, stale_firmware int, open_device_tickets int)
language sql stable security definer set search_path = ''
as $$
  with d as (select * from public.devices where status <> 'retired'),
       fw as (select type, max(firmware_version) as latest from d where firmware_version is not null group by type)
  select count(*)::int,
         count(*) filter (where d.status = 'online')::int,
         count(*) filter (where d.status = 'offline')::int,
         count(*) filter (where d.status = 'fault')::int,
         count(*) filter (where d.status = 'provisioning')::int,
         count(*) filter (where d.battery_pct < 20)::int,
         count(*) filter (where d.firmware_version is not null and d.firmware_version < fw.latest)::int,
         (select count(*)::int from public.tickets t where t.source = 'system' and t.status <> 'resolved')
    from d left join fw on fw.type = d.type
   where public.is_staff()
$$;

-- Tenant counts by floor (staff overview).
create or replace function public.tenant_counts()
returns table (approved int, pending int, floors int)
language sql stable security definer set search_path = ''
as $$
  select count(*) filter (where status = 'approved')::int, count(*) filter (where status = 'pending')::int,
         count(distinct floor) filter (where status = 'approved')::int
    from public.profiles where role = 'tenant' and public.is_staff()
$$;
