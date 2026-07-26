#!/usr/bin/env bash
set -euo pipefail
pnpm --filter @rtp/api-gateway start
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node "$ROOT/tools/aol/bin/aol.mjs" run -w @rtp/api-gateway start
