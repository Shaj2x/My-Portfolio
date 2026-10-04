#!/usr/bin/env bash
# Go integration tests. Each package gets its own throwaway app + telemetry
# databases so tests can't see each other's data.
#   ./test-integration.sh                         # every package with integration tests
#   ./test-integration.sh -v -run TestX ./internal/ingest/
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
cd "$here"
pkgs=(); flags=()
for a in "$@"; do
  if [[ "$a" == ./* ]]; then pkgs+=("$a"); else flags+=("$a"); fi
done
if [ ${#pkgs[@]} -eq 0 ]; then
  mapfile -t pkgs < <(grep -l '//go:build integration' -r internal | xargs -n1 dirname | sort -u | sed 's#^#./#')
fi
for p in "${pkgs[@]}"; do
  ../scripts/with-test-db.sh go test -tags integration -count=1 "${flags[@]}" "$p"
done
