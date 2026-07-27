#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
CLI=(node src/cli.mjs)
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "== doctor =="
"${CLI[@]}" doctor . --json >/dev/null

echo "== hash/transfer =="
printf 'ross-infinite-smoke' >"$TMP/in.bin"
"${CLI[@]}" hash "$TMP/in.bin" --json >/dev/null
"${CLI[@]}" transfer "$TMP/in.bin" "$TMP/out.bin" --jobs 2 --json >/dev/null

echo "== resolve =="
cat >"$TMP/ross.package.json" <<'JSON'
{"name":"smoke-app","version":"1.0.0","dependencies":{"ross-core":"1.0.0"}}
JSON
(
  cd "$TMP"
  node "$ROOT/src/cli.mjs" resolve ross.package.json --catalog "$ROOT/tests/registry-fixture.json" --json >/dev/null
)

echo "== seo =="
"${CLI[@]}" seo plan config/seo/ross.co.ownership.json --json >/dev/null
"${CLI[@]}" seo generate config/seo/ross.co.ownership.json --json >/dev/null
"${CLI[@]}" seo prevalidate config/seo/ross.co.ownership.json --json >/dev/null
"${CLI[@]}" seo deploy config/seo/ross.co.ownership.json --json >/dev/null

echo "== mcp initialize =="
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"smoke","version":"0.0.0"}}}' \
  | node src/server/mcp-lite.mjs \
  | grep -q 'ROSS.CO Infinite MCP'

echo "== registry health =="
PORT=4879
ROSS_REGISTRY_DATA="$TMP/registry" PORT="$PORT" node src/server/registry.mjs >/tmp/ross-registry-smoke.log 2>&1 &
PID=$!
sleep 0.4
curl -sf "http://127.0.0.1:${PORT}/health" | grep -q '"ok": true'
kill "$PID" >/dev/null 2>&1 || true

echo "SMOKE PASS"
