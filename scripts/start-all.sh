#!/usr/bin/env bash
# Start the full RTPSC Tax Platform under tmux (services + one-shot workers).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION="${RTP_TMUX_SESSION:-rtp-platform}"
TMUX_BIN="${TMUX_BIN:-tmux}"
TMUX_CONF="/exec-daemon/tmux.portal.conf"

tmux_cmd() {
  if [[ -f "$TMUX_CONF" ]]; then
    "$TMUX_BIN" -f "$TMUX_CONF" "$@"
  else
    "$TMUX_BIN" "$@"
  fi
}

cd "$ROOT"
node ./tools/aol/bin/aol.mjs install --force >/dev/null

if tmux_cmd has-session -t "=$SESSION" 2>/dev/null; then
  echo "[start-all] session '$SESSION' already running — attaching health check"
  node "$ROOT/scripts/start-all.mjs" --check-only || true
  echo "[start-all] reuse: tmux attach -t $SESSION"
  exit 0
fi

tmux_cmd new-session -d -s "$SESSION" -c "$ROOT" -- "${SHELL:-bash}" -lc \
  "node ./scripts/start-all.mjs; echo '[start-all] exited'; exec ${SHELL:-bash} -l"

# Wait for services to come up
for i in $(seq 1 40); do
  if node "$ROOT/scripts/start-all.mjs" --check-only >/tmp/rtp-health.json 2>/dev/null; then
    break
  fi
  sleep 0.25
done

echo "[start-all] tmux session: $SESSION"
node "$ROOT/scripts/start-all.mjs" --check-only || true
echo "[start-all] attach: tmux -f $TMUX_CONF attach -t $SESSION"
echo "[start-all] stop:   tmux -f $TMUX_CONF kill-session -t $SESSION"
