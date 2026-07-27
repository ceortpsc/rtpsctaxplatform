#!/usr/bin/env bash
set -euo pipefail
# Unit tests must not inherit operator .env (keeps fail-safe defaults deterministic).
export RTPSC_SKIP_ENV_FILE=1
node --test
