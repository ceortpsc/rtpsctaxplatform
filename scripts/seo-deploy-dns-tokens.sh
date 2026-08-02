#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Optional local provider tokens (gitignored)
if [[ -f config/seo/tokens.local.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source config/seo/tokens.local.env
  set +a
fi

ARGS=(seo deploy config/seo/ross.co.ownership.json --json)
if [[ "${1:-}" == "--apply-dns" ]]; then
  ARGS+=(--apply-dns)
fi

node tools/ross-infinite/src/cli.mjs "${ARGS[@]}"
echo
echo "DNS package: deploy/seo/dns/"
echo "Presence:    presence/rossco/"
echo "Next: apply TXT at registrar, then:"
echo "  ./scripts/ross-infinite seo prevalidate config/seo/ross.co.ownership.json --live"
