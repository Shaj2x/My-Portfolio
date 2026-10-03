-- Marq Living — Stage 1: identity, roles, tenant approval.
--
-- profiles is the app's "users" table: one row per auth.users row, created by
-- a trigger at sign-up. Everyone signs up as a pending tenant. Staff approve
-- tenants; only admins create or promote staff, drivers and other admins.

create extension if not exists btree_gist with schema extensions;

create type public.app_role as enum ('tenant', 'staff', 'driver', 'admin');
create type public.account_status as enum ('pending', 'approved', 'rejected', 'suspended');

create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text not null,
  full_name         text not null check (char_length(btrim(full_name)) between 1 and 120),
  role              public.app_role not null default 'tenant',
  status            public.account_status not null default 'pending',
  unit              text check (unit ~ '^[0-9]{3,4}$'),
  room_letter       text check (room_letter ~ '^[A-F]$'),
  floor             smallint check (floor between 1 and 40),
  phone             text,
  shuttle_alerts    boolean not null default true,
  reviewed_by       uuid references public.profiles (id) on delete set null,
  reviewed_at       timestamptz,
  review_note       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- A tenant must have a full address in the building.
  constraint tenant_has_unit check (
    role <> 'tenant' or (unit is not null and room_letter is not null and floor is not null)
  )
);

comment on table public.profiles is 'App users (tenants, staff, drivers, admins). 1:1 with auth.users.';

create index profiles_status_idx on public.profiles (status) where status = 'pending';
create index profiles_floor_idx on public.profiles (floor);
create index profiles_unit_idx on public.profiles (unit);

-- ---------------------------------------------------------------------------
-- Helper functions used by RLS policies across the schema. SECURITY DEFINER
-- so they can read profiles without recursing into profiles' own policies.
-- Each answers only about the calling user.
-- ---------------------------------------------------------------------------

create or replace function public.my_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = auth.uid() and status = 'approved'
$$;

create or replace function public.is_approved()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'approved')
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.my_role() in ('staff', 'admin'), false)
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

create or replace function public.is_driver()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.my_role() in ('driver', 'staff', 'admin'), false)
$$;

create or replace function public.my_floor()
returns smallint
language sql stable security definer set search_path = ''
as $$
  select floor from public.profiles where id = auth.uid() and status = 'approved'
$$;

create or replace function public.my_unit()
returns text
language sql stable security definer set search_path = ''
as $$
  select unit from public.profiles where id = auth.uid() and status = 'approved'
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sign-up: create the profile from the sign-up form's metadata.
--
-- Self sign-ups are always pending tenants; role and status are never read
-- from metadata a user controls. The one exception is an account an admin
-- invited through the Auth admin API (service key only), which sets
-- auth.users.invited_at. Those carry invited_role and start approved.
--
-- GoTrue inserts an invited user first and sets invited_at in a second
-- UPDATE in the same transaction, so sign-ups that claim invited_role are
-- handled by a deferred trigger that runs at commit and re-reads invited_at.
-- Everything else is handled immediately, so bad input fails the sign-up
-- request right away.
-- ---------------------------------------------------------------------------

create or replace function public.create_profile_for(u auth.users)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  meta jsonb := coalesce(u.raw_user_meta_data, '{}'::jsonb);
  invited_role public.app_role;
begin
  if u.invited_at is not null and meta ->> 'invited_role' in ('staff', 'driver', 'admin') then
    invited_role := (meta ->> 'invited_role')::public.app_role;
  end if;

  if invited_role is not null then
    insert into public.profiles (id, email, full_name, role, status, phone, reviewed_by, reviewed_at, review_note)
    values (
      u.id,
      u.email,
      coalesce(nullif(btrim(meta ->> 'full_name'), ''), split_part(u.email, '@', 1)),
      invited_role,
      'approved',
      nullif(btrim(meta ->> 'phone'), ''),
      (select p.id from public.profiles p
        where p.id::text = meta ->> 'invited_by' and p.role = 'admin'),
      now(),
      'invited'
    );
  else
    insert into public.profiles (id, email, full_name, unit, room_letter, floor, phone)
    values (
      u.id,
      u.email,
      coalesce(nullif(btrim(meta ->> 'full_name'), ''), split_part(u.email, '@', 1)),
      upper(nullif(btrim(meta ->> 'unit'), '')),
      upper(nullif(btrim(meta ->> 'room_letter'), '')),
      nullif(meta ->> 'floor', '')::smallint,
      nullif(btrim(meta ->> 'phone'), '')
    );
  end if;
end;
$$;

-- Immediate: ordinary sign-ups.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.create_profile_for(new);
  return null;
end;
$$;

-- Deferred to commit: sign-ups that claim to be invites. Reads the committed
-- state of the row, by which point GoTrue has set invited_at (or not).
create or replace function public.handle_new_invited_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  u auth.users;
begin
  select * into u from auth.users where id = new.id;
  if found and not exists (select 1 from public.profiles where id = u.id) then
    perform public.create_profile_for(u);
  end if;
  return null;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  when (new.raw_user_meta_data ->> 'invited_role' is null)
  execute function public.handle_new_user();

create constraint trigger on_auth_user_invited
  after insert on auth.users
  deferrable initially deferred
  for each row
  when (new.raw_user_meta_data ->> 'invited_role' is not null)
  execute function public.handle_new_invited_user();

-- Keep profile email in sync if the user changes it.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Column guard. RLS decides which rows a user may update; this decides which
-- columns. Runs for every update (including staff), except trusted backend
-- roles (service_role / postgres) where auth.uid() is null.
-- ---------------------------------------------------------------------------

create or replace function public.guard_profile_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_role public.app_role := public.my_role();
begin
  if actor is null then
    return new; -- backend / migrations
  end if;

  if new.id is distinct from old.id or new.email is distinct from old.email
     or new.created_at is distinct from old.created_at then
    raise exception 'id, email and created_at cannot be changed here' using errcode = '42501';
  end if;

  -- Role changes: admins only, and never on yourself (prevents lock-out).
  if new.role is distinct from old.role then
    if actor_role is distinct from 'admin' then
      raise exception 'only admins can change roles' using errcode = '42501';
    end if;
    if old.id = actor then
      raise exception 'admins cannot change their own role' using errcode = '42501';
    end if;
  end if;

  -- Status / review changes: staff may review tenants; admins may review anyone
  -- but themselves.
  if new.status is distinct from old.status
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
     or new.review_note is distinct from old.review_note then
    if actor_role is null or actor_role not in ('staff', 'admin') then
      raise exception 'only staff can review accounts' using errcode = '42501';
    end if;
    if old.id = actor then
      raise exception 'you cannot review your own account' using errcode = '42501';
    end if;
    if actor_role = 'staff' and old.role <> 'tenant' then
      raise exception 'staff can only review tenant accounts' using errcode = '42501';
    end if;
  end if;

  -- Address changes after approval go through staff (a tenant moving units
  -- changes who sees which floor announcements).
  if (new.unit, new.room_letter, new.floor) is distinct from (old.unit, old.room_letter, old.floor)
     and old.id = actor and old.status = 'approved'
     and (actor_role is null or actor_role not in ('staff', 'admin')) then
    raise exception 'ask the front desk to change your unit' using errcode = '42501';
  end if;

  if actor_role = 'staff' and old.id <> actor and old.role <> 'tenant' then
    raise exception 'staff can only edit tenant accounts' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_update();

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

-- Everyone can read their own row (pending users need it for the waiting screen).
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- Staff and admins can read everyone. Tenants never see other tenants.
create policy profiles_select_staff on public.profiles
  for select to authenticated
  using (public.is_staff());

-- Drivers need nothing from other profiles.

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_update_staff on public.profiles
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- No insert policy: rows come from the auth trigger. No delete policy: admins
-- remove accounts through the Auth admin API, which cascades.

-- ---------------------------------------------------------------------------
-- Review RPCs (thin wrappers so the app makes one call and gets the guard).
-- SECURITY INVOKER: they run as the caller, so RLS and the guard apply.
-- ---------------------------------------------------------------------------

create or replace function public.review_tenant(
  target uuid,
  decision public.account_status,
  note text default null
)
returns public.profiles
language plpgsql security invoker set search_path = ''
as $$
declare
  result public.profiles;
begin
  if decision not in ('approved', 'rejected', 'suspended') then
    raise exception 'decision must be approved, rejected or suspended' using errcode = '22023';
  end if;

  update public.profiles
     set status = decision,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = nullif(btrim(note), '')
   where id = target
  returning * into result;

  if result.id is null then
    raise exception 'account not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

create or replace function public.set_user_role(target uuid, new_role public.app_role)
returns public.profiles
language plpgsql security invoker set search_path = ''
as $$
declare
  result public.profiles;
begin
  if not public.is_admin() then
    raise exception 'only admins can change roles' using errcode = '42501';
  end if;

  update public.profiles
     set role = new_role,
         -- Staff, drivers and admins are vetted by the admin who assigns them.
         status = case when new_role = 'tenant' then status else 'approved' end,
         reviewed_by = case when new_role = 'tenant' then reviewed_by else auth.uid() end,
         reviewed_at = case when new_role = 'tenant' then reviewed_at else now() end
   where id = target
  returning * into result;

  if result.id is null then
    raise exception 'account not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

-- First admin: run once from the SQL editor (as postgres) after that person
-- has signed up:  select public.bootstrap_admin('you@example.com');
create or replace function public.bootstrap_admin(admin_email text)
returns public.profiles
language plpgsql security definer set search_path = ''
as $$
declare
  result public.profiles;
begin
  if auth.uid() is not null then
    raise exception 'run bootstrap_admin from the SQL editor, not the app' using errcode = '42501';
  end if;
  update public.profiles
     set role = 'admin', status = 'approved', reviewed_at = now(), review_note = 'bootstrap'
   where lower(email) = lower(admin_email)
  returning * into result;
  if result.id is null then
    raise exception 'no account with email %', admin_email using errcode = 'P0002';
  end if;
  return result;
end;
$$;

revoke all on function public.bootstrap_admin(text) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_new_invited_user() from public, anon, authenticated;
revoke all on function public.create_profile_for(auth.users) from public, anon, authenticated;
revoke all on function public.handle_user_email_change() from public, anon, authenticated;
revoke all on function public.guard_profile_update() from public, anon, authenticated;
revoke all on function public.review_tenant(uuid, public.account_status, text) from public, anon;
revoke all on function public.set_user_role(uuid, public.app_role) from public, anon;
grant execute on function public.review_tenant(uuid, public.account_status, text) to authenticated;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;
