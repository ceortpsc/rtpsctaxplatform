"""Start the Ross Tax Pro Software Co | RunTime AI Assist HTTP server (dev / start)."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Sequence

from ross_ai.manifest import load_manifest
from ross_ai.paths import DEFAULT_HOST, DEFAULT_PORT
from ross_ai.platform_server import serve
from ross_ai.util import info, ok


def _env_host_port(man: dict) -> tuple[str, int]:
    platform = (man.get("runtime") or {}).get("platform") or {}
    host = os.environ.get("ROSS_HOST") or platform.get("host") or DEFAULT_HOST
    port_raw = os.environ.get("ROSS_PORT") or platform.get("port") or DEFAULT_PORT
    return str(host), int(port_raw)


def run_dev(root: Path, argv: Sequence[str]) -> int:
    # Ensure initialized
    man = load_manifest(root)
    host, port = _env_host_port(man)

    for i, arg in enumerate(argv):
        if arg == "--host" and i + 1 < len(argv):
            host = argv[i + 1]
        if arg == "--port" and i + 1 < len(argv):
            port = int(argv[i + 1])

    ok(f"Starting {man.get('product') or 'Ross Tax Pro Software Co | RunTime AI Assist'}")
    info(f"Open http://{host}:{port}")
    info("Ctrl+C to stop")
    serve(root, host=host, port=port, manifest=man)
    return 0
