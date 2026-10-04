#!/usr/bin/env bash
# Go integration tests against throwaway app + telemetry databases.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
cd "$here" && exec ../scripts/with-test-db.sh go test -tags integration -count=1 "${@:-./...}"
