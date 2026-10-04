#!/usr/bin/env bash
# Boots a throwaway Postgres with two databases and runs a command against them:
#   app        Supabase stand-in + every migration + seed
#   telemetry  the TimescaleDB schema (plain-Postgres fallback)
# Exports APP_DB_URL and TSDB_URL. Usage: scripts/with-test-db.sh <command…>
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
pgbin="$(dirname "$(command -v pg_ctl 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")"
work="$(mktemp -d)"; port="${PGTEST_PORT:-$((54400 + RANDOM % 500))}"
as_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
chmod 777 "$work"
as_pg "$pgbin/initdb" -D "$work/data" -U postgres --auth=trust -E UTF8 --locale=C >/dev/null
as_pg "$pgbin/pg_ctl" -D "$work/data" -o "-p $port -k $work -c listen_addresses=127.0.0.1" -l "$work/log" start >/dev/null
trap 'as_pg "$pgbin/pg_ctl" -D "$work/data" stop -m fast >/dev/null; rm -rf "$work"' EXIT
P() { psql -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U postgres "$@"; }
P -d postgres -c "create database app" -c "create database telemetry"
P -d app -f "$root/supabase/tests/supabase_stub.sql"
for f in "$root"/supabase/migrations/*.sql; do P -d app -f "$f" >/dev/null; done
P -d app -f "$root/supabase/seed.sql" >/dev/null
P -d telemetry -f "$root/services/internal/store/telemetry.sql" >/dev/null
export APP_DB_URL="postgresql://postgres@127.0.0.1:$port/app" TSDB_URL="postgresql://postgres@127.0.0.1:$port/telemetry"
"$@"
