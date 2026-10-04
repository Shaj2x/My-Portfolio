-- Tiny assertion helpers for the RLS tests (no pgTAP dependency).
create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Act as a signed-in user (role authenticated + JWT sub), or as anon.
create or replace function tests.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  perform set_config('role', 'authenticated', false);
end $$;

create or replace function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', false);
  perform set_config('request.jwt.claim.sub', '', false);
end $$;

create or replace function tests.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'FAIL: %', label;
  end if;
  raise notice 'ok - %', label;
end $$;

create or replace function tests.eq(got anyelement, want anyelement, label text) returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAIL: % (got %, want %)', label, got, want;
  end if;
  raise notice 'ok - %', label;
end $$;

-- Runs sql and expects it to fail (any error, or a specific SQLSTATE).
create or replace function tests.throws(sql text, label text, want_state text default null)
returns void language plpgsql as $$
declare
  state text;
begin
  begin
    execute sql;
  exception when others then
    state := sqlstate;
  end;
  if state is null then
    raise exception 'FAIL: % (statement succeeded)', label;
  end if;
  if want_state is not null and state <> want_state then
    raise exception 'FAIL: % (got SQLSTATE %, want %)', label, state, want_state;
  end if;
  raise notice 'ok - %', label;
end $$;

-- Row count a statement affects/returns as the current user. A write blocked
-- by an RLS USING clause affects 0 rows rather than erroring.
create or replace function tests.rows(sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute sql;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

-- A booking slot d days from today at local hour h, lasting dur minutes.
create or replace function tests.slot(d int, h int, dur int) returns tstzrange language sql stable as $$
  select tstzrange(s, s + make_interval(mins => dur))
    from (select ((((now() at time zone 'America/Toronto')::date + d) + make_time(h, 0, 0))::timestamp
                  at time zone 'America/Toronto') as s) x
$$;
grant execute on function tests.slot(int, int, int) to authenticated, anon;
