#!/usr/bin/env bash
# Applies the migrations to a throwaway local Postgres and runs the RLS tests.
# Usage: supabase/tests/run.sh   (needs Postgres 15+ server binaries on PATH
# or in /usr/lib/postgresql/*/bin)
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
migrations="$here/../migrations"
pgbin="$(dirname "$(command -v pg_ctl 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")"
work="$(mktemp -d)"
port="${PGTEST_PORT:-54329}"

as_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }

chmod 777 "$work"
as_pg "$pgbin/initdb" -D "$work/data" -U postgres --auth=trust >/dev/null
as_pg "$pgbin/pg_ctl" -D "$work/data" -o "-p $port -k $work -c listen_addresses=''" -l "$work/log" start >/dev/null
trap 'as_pg "$pgbin/pg_ctl" -D "$work/data" stop -m fast >/dev/null; rm -rf "$work"' EXIT

psql_run() { psql -X -q -t -A -v ON_ERROR_STOP=1 -h "$work" -p "$port" -U postgres -d postgres "$@"; }

psql_run -f "$here/supabase_stub.sql"
for f in "$migrations"/*.sql; do
  echo "migrate $(basename "$f")"
  psql_run -f "$f"
done
# Seed must apply cleanly on top of the schema.
if [ -f "$here/../seed.sql" ]; then
  echo "seed"
  psql_run -f "$here/../seed.sql"
fi
for t in "$here"/[0-9]*_*.test.sql; do
  echo "test $(basename "$t")"
  psql_run -f "$t" 2>&1 | grep -v "^$" | sed "s/^psql:[^ ]* NOTICE:  /  /"
done
echo "all database tests passed"
