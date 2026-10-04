#!/usr/bin/env bash
# End-to-end test against the real Supabase Auth server (GoTrue) and
# PostgREST, without Docker:
#
#   Postgres  ←  GoTrue (auth, migrates the auth schema)
#             ←  PostgREST (data API, RLS as each user)
#   gateway.js serves them at /auth/v1 and /rest/v1 like Supabase's API
#   smtp_sink.py captures auth emails so the test can follow their links
#   the Next.js app is built against that and driven with Playwright.
#
# First run downloads PostgREST and builds GoTrue from source (needs Go).
# Usage: e2e/run.sh            (from anywhere)
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
work="$here/.work"
pgdata="${E2E_PGDATA:-/var/tmp/marq-e2e}"   # outside the repo so the postgres user can reach it
pgbin="$(dirname "$(command -v pg_ctl 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")"

export E2E_PG_PORT="${E2E_PG_PORT:-54330}" GOTRUE_PORT="${GOTRUE_PORT:-9999}" PGRST_PORT="${PGRST_PORT:-3001}"
export GATEWAY_PORT="${GATEWAY_PORT:-54321}" APP_PORT="${APP_PORT:-3000}"
export E2E_MAIL="$work/mail" E2E_SHOTS="$work/shots" TEMPLATES="$root/supabase/templates"
SECRET="e2e-only-jwt-secret-at-least-32-characters-long"
POSTGREST_VERSION=v12.2.3
GOTRUE_REF="${GOTRUE_REF:-v2.197.0}"

mkdir -p "$work/bin" "$work/logs"
rm -rf "$E2E_MAIL" "$E2E_SHOTS" "$work/pids"; mkdir -p "$E2E_MAIL" "$E2E_SHOTS"

# --- binaries ----------------------------------------------------------------
if [ ! -x "$work/bin/postgrest" ]; then
  echo "downloading PostgREST $POSTGREST_VERSION"
  curl -fsSL "https://github.com/PostgREST/postgrest/releases/download/$POSTGREST_VERSION/postgrest-$POSTGREST_VERSION-linux-static-x64.tar.xz" \
    | tar -xJ -C "$work/bin"
fi
if [ ! -x "$work/bin/gotrue" ]; then
  echo "building GoTrue ($GOTRUE_REF)"
  rm -rf "$work/gotrue-src"
  git clone -q --depth 1 --branch "$GOTRUE_REF" https://github.com/supabase/auth.git "$work/gotrue-src"
  (cd "$work/gotrue-src" && go build -o "$work/bin/gotrue" .)
fi
[ -d "$here/node_modules/playwright" ] || (cd "$here" && npm install --no-audit --no-fund >/dev/null)

# --- processes -----------------------------------------------------------------
as_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
bg() { local name=$1; shift; "$@" >"$work/logs/$name.log" 2>&1 & echo $! >>"$work/pids"; echo $! >"$work/$name.pid"; }
cleanup() {
  [ -f "$work/pids" ] && xargs -r kill 2>/dev/null <"$work/pids" || true
  as_pg "$pgbin/pg_ctl" -D "$pgdata/data" stop -m fast >/dev/null 2>&1 || true
}
trap cleanup EXIT
wait_for() { for _ in $(seq 90); do curl -sf -o /dev/null "$1" && return 0; sleep 1; done; echo "timed out: $1"; return 1; }

rm -rf "$pgdata"; mkdir -p "$pgdata"
[ "$(id -u)" = 0 ] && chown postgres "$pgdata"
as_pg "$pgbin/initdb" -D "$pgdata/data" -U postgres --auth=trust -E UTF8 --locale=C >/dev/null
as_pg "$pgbin/pg_ctl" -D "$pgdata/data" -o "-p $E2E_PG_PORT -k $pgdata -c listen_addresses=127.0.0.1" -l "$pgdata/pg.log" start >/dev/null
psql_run() { psql -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$E2E_PG_PORT" -U postgres -d postgres "$@"; }

# Roles and schemas a Supabase database has before any migration runs.
psql_run <<'SQL'
create user supabase_auth_admin noinherit createrole login password 'root';
create schema auth authorization supabase_auth_admin;
grant create on database postgres to supabase_auth_admin;
alter user supabase_auth_admin set search_path = 'auth';
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit password 'pw';
grant anon, authenticated, service_role to authenticator;
create schema extensions;
create schema storage;
grant usage on schema public, extensions, storage to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
SQL

bg smtp python3 -W ignore "$here/smtp_sink.py" "$E2E_MAIL"
bg gateway node "$here/gateway.js"

GOTRUE_DB_DRIVER=postgres DATABASE_URL="postgres://supabase_auth_admin:root@127.0.0.1:$E2E_PG_PORT/postgres" \
GOTRUE_API_HOST=127.0.0.1 PORT="$GOTRUE_PORT" API_EXTERNAL_URL="http://localhost:$GATEWAY_PORT/auth/v1" \
GOTRUE_SITE_URL="http://localhost:$APP_PORT" GOTRUE_URI_ALLOW_LIST="http://localhost:$APP_PORT/**" \
GOTRUE_JWT_SECRET="$SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated \
GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role \
GOTRUE_DISABLE_SIGNUP=false GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=false \
GOTRUE_SMTP_HOST=127.0.0.1 GOTRUE_SMTP_PORT=2525 GOTRUE_SMTP_USER=x GOTRUE_SMTP_PASS=x \
GOTRUE_SMTP_ADMIN_EMAIL=frontdesk@marq.test GOTRUE_SMTP_MAX_FREQUENCY=1ns GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 \
GOTRUE_MAILER_TEMPLATES_CONFIRMATION="http://127.0.0.1:$GATEWAY_PORT/templates/confirmation.html" \
GOTRUE_MAILER_TEMPLATES_INVITE="http://127.0.0.1:$GATEWAY_PORT/templates/invite.html" \
GOTRUE_MAILER_TEMPLATES_RECOVERY="http://127.0.0.1:$GATEWAY_PORT/templates/recovery.html" \
  bg gotrue "$work/bin/gotrue"
wait_for "http://127.0.0.1:$GOTRUE_PORT/health"

# GoTrue has created the auth schema; add what Supabase's image provides on
# top of it, then the storage stand-in, then our migrations and seed.
psql_run <<'SQL'
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true),
                         current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
SQL
sed -n '/^create table storage.buckets/,$p' "$root/supabase/tests/supabase_stub.sql" | sed '/^alter default privileges/d' | psql_run
for f in "$root"/supabase/migrations/*.sql; do psql_run -f "$f"; done
psql_run -f "$root/supabase/seed.sql"

PGRST_DB_URI="postgres://authenticator:pw@127.0.0.1:$E2E_PG_PORT/postgres" PGRST_DB_SCHEMAS=public \
PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$SECRET" PGRST_SERVER_PORT="$PGRST_PORT" \
PGRST_DB_EXTRA_SEARCH_PATH=public,extensions \
  bg postgrest "$work/bin/postgrest"
wait_for "http://127.0.0.1:$PGRST_PORT/"
echo "stack up"

# --- building operations stack (broker, Go services, analytics, simulator) ----
export E2E_WORK="$work" MQTT_PORT="${MQTT_PORT:-18883}" ANALYTICS_PORT="${ANALYTICS_PORT:-18000}"
psql_run -c "create database telemetry"
export APP_DSN="postgresql://postgres@127.0.0.1:$E2E_PG_PORT/postgres" TSDB_DSN="postgresql://postgres@127.0.0.1:$E2E_PG_PORT/telemetry"
mq="$pgdata/mq"; mkdir -p "$mq"
cp "$root/infra/mosquitto/acl" "$mq/acl"
mosquitto_passwd -c -b "$mq/passwd" ingest ingest-pw
mosquitto_passwd -b "$mq/passwd" automation automation-pw
mosquitto_passwd -b "$mq/passwd" simulator simulator-pw
sed -e "s#/mosquitto/config/#$mq/#; s#/mosquitto/data/#$mq/#; s#^listener 1883#listener $MQTT_PORT 127.0.0.1#" \
  "$root/infra/mosquitto/mosquitto.conf" > "$mq/mosquitto.conf"
chmod 755 "$mq"; chmod 644 "$mq/acl" "$mq/mosquitto.conf"; chmod 640 "$mq/passwd"
[ "$(id -u)" = 0 ] && chown -R mosquitto "$mq" 2>/dev/null || true
bg mosquitto mosquitto -c "$mq/mosquitto.conf"
(cd "$root/services" && go build -o "$work/bin/ingest" ./cmd/ingest && go build -o "$work/bin/automation" ./cmd/automation)
(cd "$root/simulator" && SUPABASE_DB_URL="$APP_DSN" python3 -m marq_sim seed >/dev/null 2>&1)
(cd "$root/simulator" && SUPABASE_DB_URL="$APP_DSN" TIMESCALE_URL="$TSDB_DSN" python3 -c "
import os, psycopg
psycopg.connect(os.environ['TIMESCALE_URL'], autocommit=True).execute(open('$root/services/internal/store/telemetry.sql').read())
from marq_sim import backfill
backfill.backfill(os.environ['TIMESCALE_URL'], os.environ['SUPABASE_DB_URL'], days=10, automation_from_day=5)" >"$work/logs/backfill.log" 2>&1)
export ANALYTICS_API_KEY="e2e-analytics-key" ANALYTICS_URL="http://127.0.0.1:$ANALYTICS_PORT"
MQTT_URL="tcp://127.0.0.1:$MQTT_PORT" MQTT_USERNAME=ingest MQTT_PASSWORD=ingest-pw TIMESCALE_URL="$TSDB_DSN" SUPABASE_DB_URL="$APP_DSN" \
  HTTP_ADDR="127.0.0.1:18081" APP_NOTIFY_URL="http://localhost:$APP_PORT/api/internal/notify" INTERNAL_API_SECRET="e2e-internal-secret" \
  bg ingest "$work/bin/ingest"
(cd "$root/analytics" && TIMESCALE_URL="$TSDB_DSN" SUPABASE_DB_URL="$APP_DSN" ANALYTICS_API_KEY="$ANALYTICS_API_KEY" \
  WEATHER_URL="http://127.0.0.1:9/offline" SCHEDULER_ENABLED=true \
  bg analytics python3 -m uvicorn marq_analytics.api:app --host 127.0.0.1 --port "$ANALYTICS_PORT")
wait_for "http://127.0.0.1:$ANALYTICS_PORT/health"
wait_for "http://127.0.0.1:18081/healthz"
echo "building stack up"

# --- app -------------------------------------------------------------------------
anon_key="$(node "$here/jwt.js" "$SECRET" anon)"
service_key="$(node "$here/jwt.js" "$SECRET" service_role)"
export NEXT_PUBLIC_SUPABASE_URL="http://localhost:$GATEWAY_PORT"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$anon_key" SUPABASE_SECRET_KEY="$service_key"
export NEXT_PUBLIC_SITE_URL="http://localhost:$APP_PORT" SERVICE_KEY="$service_key"
export CRON_SECRET="e2e-cron-secret" INTERNAL_API_SECRET="e2e-internal-secret"
vapid="$(cd "$root/web" && npx --no-install web-push generate-vapid-keys --json)"
export NEXT_PUBLIC_VAPID_PUBLIC_KEY="$(node -e "console.log(JSON.parse(process.argv[1]).publicKey)" "$vapid")"
export VAPID_PRIVATE_KEY="$(node -e "console.log(JSON.parse(process.argv[1]).privateKey)" "$vapid")"
(cd "$root/web" && NEXT_DIST_DIR=.next-e2e npx next build >"$work/logs/build.log" 2>&1) || { tail -30 "$work/logs/build.log"; exit 1; }
cd "$root/web"; NEXT_DIST_DIR=.next-e2e bg app node node_modules/next/dist/bin/next start --port "$APP_PORT"; cd "$here"
wait_for "http://localhost:$APP_PORT/login"
echo "app up"

# Automation and the simulator start after the app (the engine calls its tick).
MQTT_URL="tcp://127.0.0.1:$MQTT_PORT" MQTT_USERNAME=automation MQTT_PASSWORD=automation-pw TIMESCALE_URL="$TSDB_DSN" SUPABASE_DB_URL="$APP_DSN" \
  HTTP_ADDR="127.0.0.1:18082" APP_URL="http://localhost:$APP_PORT" CRON_SECRET="$CRON_SECRET" INTERNAL_API_SECRET="$INTERNAL_API_SECRET" \
  bg automation "$work/bin/automation"
wait_for "http://127.0.0.1:18082/healthz"
(cd "$root/simulator" && MQTT_URL="tcp://127.0.0.1:$MQTT_PORT" MQTT_USERNAME=simulator MQTT_PASSWORD=simulator-pw SUPABASE_DB_URL="$APP_DSN" \
  bg simulator python3 -m marq_sim live --seed 3)
echo "automation and simulator up"

for t in "${@:-stage1 stage2to4 system}"; do
  for name in $t; do echo "== $name"; node "$here/$name.test.js"; done
done
echo "screenshots: $E2E_SHOTS"
