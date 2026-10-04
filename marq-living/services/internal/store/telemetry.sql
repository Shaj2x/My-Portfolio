-- Marq Living telemetry database (TimescaleDB). Applied idempotently by the
-- ingest service at startup. Works on plain Postgres too (no hypertables,
-- compression or continuous aggregates) so tests run anywhere.

create table if not exists readings (
  ts          timestamptz      not null,
  device_id   uuid             not null,
  channel     smallint         not null,
  current_a   real,
  power_w     real,
  energy_kwh  double precision,
  primary key (device_id, channel, ts)
);

-- Scalar measurements that aren't electrical: state of charge, temperature,
-- occupancy counts.
create table if not exists metrics (
  ts         timestamptz not null,
  device_id  uuid        not null,
  name       text        not null,
  channel    smallint    not null default 0,
  value      double precision not null,
  primary key (device_id, name, channel, ts)
);

do $$
declare
  has_ts boolean := exists (select 1 from pg_available_extensions where name = 'timescaledb');
begin
  if has_ts then
    create extension if not exists timescaledb;
    perform create_hypertable('readings', 'ts', chunk_time_interval => interval '1 day', if_not_exists => true);
    perform create_hypertable('metrics', 'ts', chunk_time_interval => interval '7 days', if_not_exists => true);
  elsif not exists (select 1 from pg_proc where proname = 'time_bucket') then
    -- Minimal stand-in so queries are the same everywhere.
    execute $f$
      create function time_bucket(bucket interval, ts timestamptz) returns timestamptz
      language sql immutable parallel safe as
      'select date_bin(bucket, ts, timestamptz ''2000-01-03 00:00:00+00'')'
    $f$;
  end if;
end;
$$;

create index if not exists readings_ts_idx on readings (ts desc);

-- 15-minute rollup used by dashboards, forecasting and billing. Average power
-- is the demand for the interval; energy is the counter delta.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'timescaledb') then
    if not exists (select 1 from timescaledb_information.continuous_aggregates where view_name = 'readings_15m') then
      execute $v$
        create materialized view readings_15m with (timescaledb.continuous) as
        select time_bucket('15 minutes', ts) as bucket, device_id, channel,
               avg(power_w) as avg_power_w, max(power_w) as max_power_w,
               max(energy_kwh) - min(energy_kwh) as energy_kwh, count(*) as samples
          from readings group by 1, 2, 3
        with no data
      $v$;
      perform add_continuous_aggregate_policy('readings_15m', start_offset => interval '2 days',
        end_offset => interval '1 minute', schedule_interval => interval '1 minute');
      alter table readings set (timescaledb.compress, timescaledb.compress_segmentby = 'device_id, channel');
      perform add_compression_policy('readings', interval '7 days');
      -- Raw readings for 1 year; the 15-minute rollup is kept indefinitely.
      perform add_retention_policy('readings', interval '365 days');
    end if;
  elsif not exists (select 1 from pg_views where viewname = 'readings_15m') then
    execute $v$
      create view readings_15m as
      select time_bucket('15 minutes', ts) as bucket, device_id, channel,
             avg(power_w) as avg_power_w, max(power_w) as max_power_w,
             max(energy_kwh) - min(energy_kwh) as energy_kwh, count(*) as samples
        from readings group by 1, 2, 3
    $v$;
  end if;
end;
$$;

-- Latest reading per device/channel, for live views.
create or replace view readings_latest as
select distinct on (device_id, channel) device_id, channel, ts, current_a, power_w, energy_kwh
  from readings
 where ts > now() - interval '10 minutes'
 order by device_id, channel, ts desc;
