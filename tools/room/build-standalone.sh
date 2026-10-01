#!/usr/bin/env bash
# Bundles a 3D room into ONE self-contained HTML file (three.js, React, styles and images inlined),
# for previewing it as a hosted page (e.g. a claude.ai Artifact) without running the site.
#   usage: tools/room/build-standalone.sh [out.html] [entry]
#   entry "entry" (default): the original late-night room, with its own head.html
#   entry "plain-app": the real /room/plain page, with the site's Tailwind styles compiled in
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="${1:-dist/room-standalone.html}"
ENTRY="${2:-entry}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
if [ "$ENTRY" = "plain-app" ]; then
  npx tailwindcss -c tailwind.config.ts -i src/index.css -o "$TMP/app.css" --minify 2>/dev/null
  npx esbuild tools/room/standalone/plain-app.tsx --bundle --minify --format=iife --jsx=automatic \
    --loader:.png=dataurl --loader:.jpg=dataurl --define:process.env.NODE_ENV='"production"' \
    --outfile="$TMP/room.js" --log-level=warning
  for f in "$TMP/room.js" "$TMP/app.css"; do
    if grep -qi "</script\|</style" "$f"; then echo "$f contains a closing tag; cannot inline safely" >&2; exit 1; fi
  done
  mkdir -p "$(dirname "$OUT")"
  {
    printf '<title>My Room, Plain</title>\n<style>\n'
    cat "$TMP/app.css"
    printf '\n</style>\n<div id="root"></div>\n<script>\n'
    cat "$TMP/room.js"
    printf '\n</script>\n'
  } > "$OUT"
else
  npx esbuild "tools/room/standalone/$ENTRY.ts" --bundle --minify --format=iife --outfile="$TMP/room.js" --log-level=warning
  if grep -q "</script" "$TMP/room.js"; then echo "bundle contains </script; cannot inline safely" >&2; exit 1; fi
  mkdir -p "$(dirname "$OUT")"
  { cat tools/room/standalone/head.html; cat "$TMP/room.js"; printf '\n</script>\n'; } > "$OUT"
fi
echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
