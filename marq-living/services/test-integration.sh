#!/usr/bin/env bash
# Integration tests for the Go services against throwaway Postgres databases:
# "app" (Supabase stand-in + all migrations) and "telemetry".
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
pgbin="$(dirname "$(command -v pg_ctl 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")"
work="$(mktemp -d)"; port="${PGTEST_PORT:-54339}"
as_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
chmod 777 "$work"
as_pg "$pgbin/initdb" -D "$work/data" -U postgres --auth=trust >/dev/null
as_pg "$pgbin/pg_ctl" -D "$work/data" -o "-p $port -k $work -c listen_addresses=127.0.0.1" -l "$work/log" start >/dev/null
trap 'as_pg "$pgbin/pg_ctl" -D "$work/data" stop -m fast >/dev/null; rm -rf "$work"' EXIT
P() { psql -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$port" -U postgres "$@"; }
P -d postgres -c "create database app" -c "create database telemetry"
P -d app -f "$root/supabase/tests/supabase_stub.sql"
for f in "$root"/supabase/migrations/*.sql; do P -d app -f "$f" >/dev/null; done
P -d app -f "$root/supabase/seed.sql" >/dev/null
export APP_DB_URL="postgres://postgres@127.0.0.1:$port/app" TSDB_URL="postgres://postgres@127.0.0.1:$port/telemetry"
cd "$here" && go test -tags integration -count=1 "${@:-./...}"
