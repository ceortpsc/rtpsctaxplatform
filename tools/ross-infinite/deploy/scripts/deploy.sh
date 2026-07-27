#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
echo "ROSS.CO Infinite local deploy provisions"
node tools/ross-infinite/src/cli.mjs doctor tools/ross-infinite
node tools/ross-infinite/src/cli.mjs seo deploy config/seo/ross.co.ownership.json
echo "Optional: kubectl apply -f tools/ross-infinite/deploy/k8s/"
