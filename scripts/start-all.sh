#!/usr/bin/env bash
# Start the full RTPSC Tax Platform under tmux (services + one-shot workers).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION="${RTP_TMUX_SESSION:-rtp-platform}"
TMUX_CONF="${TMUX_CONF:-/exec-daemon/tmux.portal.conf}"

resolve_tmux() {
  if [[ -n "${TMUX_BIN:-}" && -x "${TMUX_BIN}" ]]; then
    printf '%s\n' "$TMUX_BIN"
    return 0
  fi
  if command -v tmux >/dev/null 2>&1; then
    command -v tmux
    return 0
  fi
  for candidate in /exec-daemon/tmux /usr/bin/tmux /usr/local/bin/tmux; do
    if [[ -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

if ! TMUX_BIN="$(resolve_tmux)"; then
  echo "[start-all] ERROR: tmux not found." >&2
  echo "[start-all] Install tmux (see .cursor/Dockerfile) or set TMUX_BIN=/path/to/tmux." >&2
  echo "[start-all] Fallback without tmux: ./scripts/aol run start:all:fg" >&2
  echo "[start-all] Diagnose: ./rtpsc cloud doctor" >&2
  exit 127
fi

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
  echo "[start-all] reuse: $TMUX_BIN attach -t $SESSION"
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

echo "[start-all] tmux binary: $TMUX_BIN"
echo "[start-all] tmux session: $SESSION"
node "$ROOT/scripts/start-all.mjs" --check-only || true
if [[ -f "$TMUX_CONF" ]]; then
  echo "[start-all] attach: $TMUX_BIN -f $TMUX_CONF attach -t $SESSION"
  echo "[start-all] stop:   $TMUX_BIN -f $TMUX_CONF kill-session -t $SESSION"
else
  echo "[start-all] attach: $TMUX_BIN attach -t $SESSION"
  echo "[start-all] stop:   $TMUX_BIN kill-session -t $SESSION"
fi
