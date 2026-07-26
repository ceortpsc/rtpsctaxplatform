#!/usr/bin/env bash
set -euo pipefail
pnpm install
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node "$ROOT/tools/aol/bin/aol.mjs" install
