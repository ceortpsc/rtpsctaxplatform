#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="${1:-activate}"
shift || true

case "$MODE" in
  activate|run|"")
    exec node packages/production-activation/bin/activate.mjs "$@"
    ;;
  status)
    exec node packages/production-activation/bin/activate.mjs --status "$@"
    ;;
  heartbeat)
    exec node packages/production-activation/bin/activate.mjs --heartbeat "$@"
    ;;
  workflow)
    # Fully automated via workflow runner triggers
    SUB="${1:-emit}"
    shift || true
    if [[ "$SUB" == "emit" ]]; then
      PAYLOAD="${1:-{"mode":"automated","skipGates":false,"requestedBy":"activate-production-script"}}"
      exec node workers/workflow-runner/src/cli.mjs emit production.activation.requested "$PAYLOAD"
    elif [[ "$SUB" == "run" ]]; then
      PAYLOAD="${1:-{"mode":"automated","skipGates":false,"requestedBy":"activate-production-script"}}"
      exec node workers/workflow-runner/src/cli.mjs run production-activation-dispatch "$PAYLOAD"
    else
      echo "usage: $0 workflow emit|run ['json']"
      exit 2
    fi
    ;;
  *)
    echo "usage: $0 [activate|status|heartbeat|workflow emit|workflow run] [args]"
    exit 2
    ;;
esac
