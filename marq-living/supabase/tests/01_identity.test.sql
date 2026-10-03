-- Stage 1: sign-up, approval, roles, and profile privacy.
\ir helpers.sql

-- Fixed ids for readability.
\set alice  '''a0000000-0000-0000-0000-00000000000a'''
\set bob    '''b0000000-0000-0000-0000-00000000000b'''
\set carol  '''c0000000-0000-0000-0000-00000000000c'''
\set sam    '''50000000-0000-0000-0000-000000000005'''
\set ada    '''ad000000-0000-0000-0000-0000000000ad'''
\set dan    '''d0000000-0000-0000-0000-00000000000d'''
\set mal    '''e0000000-0000-0000-0000-00000000000e'''

-- --- Sign-up ----------------------------------------------------------------
-- Ada signs up like anyone, then is bootstrapped to admin from the SQL editor.
insert into auth.users (id, email, raw_user_meta_data) values
  (:ada,   'ada@marq.test',   '{"full_name":"Ada Admin","unit":"1201","room_letter":"a","floor":"12"}'),
  (:alice, 'alice@marq.test', '{"full_name":"Alice Tenant","unit":"501","room_letter":"A","floor":"5"}'),
  (:bob,   'bob@marq.test',   '{"full_name":"Bob Tenant","unit":"702","room_letter":"B","floor":"7"}'),
  (:carol, 'carol@marq.test', '{"full_name":"Carol Pending","unit":"503","room_letter":"C","floor":"5"}');

-- Mallory forges privileged metadata on a normal sign-up.
insert into auth.users (id, email, raw_user_meta_data) values
  (:mal, 'mal@marq.test', '{"full_name":"Mallory","unit":"808","room_letter":"D","floor":"8","invited_role":"admin","role":"admin","status":"approved"}');

select tests.eq((select role::text from public.profiles where id = :mal), 'tenant', 'forged invited_role/role metadata is ignored');
select tests.eq((select status::text from public.profiles where id = :mal), 'pending', 'forged status metadata is ignored');
select tests.eq((select role::text || '/' || status from public.profiles where id = :alice), 'tenant/pending', 'self sign-up is a pending tenant');
select tests.eq((select room_letter from public.profiles where id = :ada), 'A', 'room letter normalized to upper case');

select tests.throws(
  $$insert into auth.users (email, raw_user_meta_data) values ('nounit@marq.test', '{"full_name":"No Unit"}')$$,
  'tenant sign-up without unit/room/floor is rejected');
select tests.throws(
  $$insert into auth.users (email, raw_user_meta_data) values ('bad@marq.test', '{"full_name":"X","unit":"5O1","room_letter":"A","floor":"5"}')$$,
  'malformed unit is rejected');
select tests.throws(
  $$insert into auth.users (email, raw_user_meta_data) values ('bad2@marq.test', '{"full_name":"X","unit":"501","room_letter":"Z","floor":"5"}')$$,
  'room letter outside A-F is rejected');

-- Invited accounts (admin API sets invited_at) get the invited role, approved, no unit needed.
insert into auth.users (id, email, invited_at, raw_user_meta_data) values
  (:sam, 'sam@marq.test', now(), '{"full_name":"Sam Staff","invited_role":"staff"}'),
  (:dan, 'dan@marq.test', now(), '{"full_name":"Dan Driver","invited_role":"driver"}');
select tests.eq((select role::text || '/' || status from public.profiles where id = :sam), 'staff/approved', 'invited staff is approved staff');
select tests.eq((select role::text || '/' || status from public.profiles where id = :dan), 'driver/approved', 'invited driver is approved driver');

-- GoTrue's real invite sequence: insert, then set invited_at in the same transaction.
begin;
insert into auth.users (id, email, raw_user_meta_data)
values ('f0000000-0000-0000-0000-00000000000f', 'fay@marq.test', '{"full_name":"Fay Frontdesk","invited_role":"staff"}');
update auth.users set invited_at = now() where id = 'f0000000-0000-0000-0000-00000000000f';
commit;
select tests.eq((select role::text || '/' || status from public.profiles where id = 'f0000000-0000-0000-0000-00000000000f'), 'staff/approved', 'GoTrue invite sequence (insert then set invited_at) yields approved staff');

-- A forged invite with no unit fails at commit, so no half-made account remains.
select tests.throws(
  $$insert into auth.users (email, raw_user_meta_data) values ('forger@marq.test', '{"full_name":"F","invited_role":"admin"}'); set constraints all immediate$$,
  'forged invite without a unit is rejected');

select public.bootstrap_admin('ADA@marq.test');
select tests.eq((select role::text || '/' || status from public.profiles where id = :ada), 'admin/approved', 'bootstrap_admin promotes by email (case-insensitive)');

-- --- Pending tenant ---------------------------------------------------------
select tests.login(:alice);
select tests.eq((select count(*) from public.profiles), 1::bigint, 'pending tenant sees only own profile');
select tests.eq(public.is_approved(), false, 'pending tenant is not approved');
select tests.eq(public.my_role(), null::public.app_role, 'pending tenant has no effective role');
select tests.throws(format($$update public.profiles set status = 'approved' where id = %L$$, :alice), 'pending tenant cannot approve self', '42501');
select tests.throws(format($$update public.profiles set role = 'admin' where id = %L$$, :alice), 'tenant cannot change own role', '42501');
select tests.throws(format($$select public.review_tenant(%L, 'approved')$$, :alice), 'tenant cannot call review_tenant', '42501');
select tests.throws(format($$select public.set_user_role(%L, 'admin')$$, :alice), 'tenant cannot call set_user_role', '42501');
select tests.throws($$select public.bootstrap_admin('alice@marq.test')$$, 'bootstrap_admin is not callable from the app');
-- Pending tenants may fix a typo in their own address before review.
select tests.eq(tests.rows(format($$update public.profiles set unit = '502' where id = %L$$, :alice)), 1::bigint, 'pending tenant can correct own unit');
select tests.eq(tests.rows(format($$update public.profiles set full_name = 'Hacked' where id = %L$$, :bob)), 0::bigint, 'tenant cannot update another profile');
select tests.logout();

-- --- Staff review -----------------------------------------------------------
select tests.login(:sam);
select tests.eq(public.is_staff(), true, 'staff is_staff()');
select tests.ok((select count(*) from public.profiles) >= 7, 'staff can list all profiles');
select tests.eq((select count(*) from public.profiles where status = 'pending'), 4::bigint, 'staff sees the pending queue');
select tests.eq((public.review_tenant(:alice, 'approved', 'Lease checked')).status::text, 'approved', 'staff approves a tenant');
select tests.eq((select reviewed_by from public.profiles where id = :alice), :sam::uuid, 'approval records the reviewer');
select public.review_tenant(:bob, 'approved');
select tests.eq((public.review_tenant(:mal, 'rejected', 'Not on lease')).status::text, 'rejected', 'staff rejects a tenant');
select tests.throws(format($$select public.review_tenant(%L, 'pending')$$, :carol), 'review decision must be approve/reject/suspend', '22023');
select tests.throws(format($$select public.review_tenant(%L, 'suspended')$$, :ada), 'staff cannot review an admin', '42501');
select tests.throws(format($$select public.review_tenant(%L, 'suspended')$$, :sam), 'staff cannot review themselves', '42501');
select tests.throws(format($$update public.profiles set role = 'staff' where id = %L$$, :alice), 'staff cannot change roles', '42501');
select tests.throws(format($$select public.set_user_role(%L, 'driver')$$, :alice), 'staff cannot call set_user_role', '42501');
select tests.throws(format($$update public.profiles set phone = '555' where id = %L$$, :dan), 'staff cannot edit a driver profile', '42501');
select tests.eq(tests.rows(format($$update public.profiles set unit = '502', floor = 5 where id = %L$$, :alice)), 1::bigint, 'staff can move a tenant to another unit');
select tests.logout();

-- --- Approved tenant ---------------------------------------------------------
select tests.login(:alice);
select tests.eq(public.is_approved(), true, 'approved tenant is approved');
select tests.eq(public.my_role(), 'tenant'::public.app_role, 'approved tenant role');
select tests.eq((select count(*) from public.profiles), 1::bigint, 'approved tenant still sees only own profile');
select tests.eq(tests.rows(format($$update public.profiles set phone = '519-555-0101', shuttle_alerts = false where id = %L$$, :alice)), 1::bigint, 'tenant can edit own phone and alert preference');
select tests.throws(format($$update public.profiles set unit = '901' where id = %L$$, :alice), 'approved tenant cannot change own unit', '42501');
select tests.throws(format($$update public.profiles set email = 'x@y.z' where id = %L$$, :alice), 'email is changed only through auth', '42501');
select tests.logout();

-- Rejected users still see their own row (for the "not approved" screen) and nothing else.
select tests.login(:mal);
select tests.eq((select status::text from public.profiles), 'rejected', 'rejected user sees own status');
select tests.eq(public.is_approved(), false, 'rejected user is not approved');
select tests.logout();

-- --- Admin ------------------------------------------------------------------
select tests.login(:ada);
select tests.eq((public.set_user_role(:sam, 'admin')).role::text, 'admin', 'admin promotes staff to admin');
select tests.eq((public.set_user_role(:sam, 'staff')).role::text, 'staff', 'admin demotes back to staff');
select tests.throws(format($$select public.set_user_role(%L, 'staff')$$, :ada), 'admin cannot change own role', '42501');
select tests.throws(format($$select public.set_user_role(%L, 'tenant')$$, :dan), 'demoting to tenant needs a unit');
select tests.eq((public.review_tenant(:dan, 'suspended')).status::text, 'suspended', 'admin can suspend a driver');
select tests.logout();

select tests.login(:dan);
select tests.eq(public.is_driver(), false, 'suspended driver loses driver access');
select tests.logout();

-- --- Anonymous --------------------------------------------------------------
set role anon;
select tests.eq((select count(*) from public.profiles), 0::bigint, 'anon sees no profiles');
reset role;

-- Email changes in auth propagate to the profile.
update auth.users set email = 'alice.new@marq.test' where id = :alice;
select tests.eq((select email from public.profiles where id = :alice), 'alice.new@marq.test', 'auth email change syncs to profile');

-- Deleting the auth user removes the profile.
delete from auth.users where id = :mal;
select tests.eq((select count(*) from public.profiles where id = :mal), 0::bigint, 'deleting auth user cascades to profile');
