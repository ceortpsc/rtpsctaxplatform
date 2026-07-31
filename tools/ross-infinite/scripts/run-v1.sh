#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
node src/cli.mjs doctor .
node src/cli.mjs plan default --taskfile ross.tasks.json --json >/dev/null
# Run a reduced local gate (unit+seo+advanced) without requiring full nested smoke recursion
node --test tests/*.test.mjs
bash scripts/smoke-test.sh
node scripts/verify-advanced.mjs
INDEXNOW_KEY="${INDEXNOW_KEY:-$(python3 - <<'PY'
import hashlib,os; print(hashlib.sha256(os.urandom(32)).hexdigest()[:64])
PY
)}"
export INDEXNOW_KEY
node src/cli.mjs seo generate config/seo/ross.co.ownership.json --json >/dev/null
node src/cli.mjs seo prevalidate config/seo/ross.co.ownership.json --json >/dev/null
bash scripts/build-v1-evidence.sh
echo "ROSS.CO Infinite local v1 gate passed"
