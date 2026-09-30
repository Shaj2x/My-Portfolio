#!/usr/bin/env bash
# Bundles the 3D room into ONE self-contained HTML file (three.js and all code inlined),
# for previewing it as a hosted page (e.g. a claude.ai Artifact) without running the site.
#   usage: tools/room/build-standalone.sh [out.html] [entry-name]   (default: dist/room-standalone.html, entry)
#   entry-name "plain-entry" builds the plain recreation of the real room (with plain-head.html)
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="${1:-dist/room-standalone.html}"
ENTRY="${2:-entry}"
HEAD="tools/room/standalone/head.html"
[ "$ENTRY" = "plain-entry" ] && HEAD="tools/room/standalone/plain-head.html"
TMP="$(mktemp -d)"
npx esbuild "tools/room/standalone/$ENTRY.ts" --bundle --minify --format=iife --outfile="$TMP/room.js" --log-level=warning
if grep -q "</script" "$TMP/room.js"; then echo "bundle contains </script; cannot inline safely" >&2; exit 1; fi
mkdir -p "$(dirname "$OUT")"
{ cat "$HEAD"; cat "$TMP/room.js"; printf '\n</script>\n'; } > "$OUT"
rm -rf "$TMP"
echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
