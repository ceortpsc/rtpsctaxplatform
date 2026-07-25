"""HTTP control-plane for Ross AI Runtime Platform (stdlib only)."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from functools import partial
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from ross_ai import __brand__, __product__, __version__
from ross_ai.paths import dist_path

DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ross AI Runtime Platform</title>
  <style>
    :root {
      --ink: #0f1c18;
      --paper: #e8f0ec;
      --accent: #1f6f54;
      --accent-2: #c4a35a;
      --mist: #b7cfc4;
      --panel: rgba(15, 28, 24, 0.72);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
      color: var(--paper);
      background:
        radial-gradient(1200px 600px at 10% -10%, #2a5a46 0%, transparent 55%),
        radial-gradient(900px 500px at 100% 0%, #3d4a2f 0%, transparent 50%),
        linear-gradient(165deg, #0b1612 0%, #14241e 45%, #0f1c18 100%);
    }
    main {
      max-width: 720px;
      margin: 0 auto;
      padding: 12vh 1.5rem 3rem;
    }
    .brand {
      font-size: clamp(2.4rem, 8vw, 4.2rem);
      letter-spacing: -0.03em;
      line-height: 0.95;
      margin: 0 0 0.75rem;
      animation: rise 700ms ease-out both;
    }
    .brand span { color: var(--accent-2); }
    .lede {
      font-family: "Segoe UI", "Helvetica Neue", sans-serif;
      font-size: 1.05rem;
      max-width: 36ch;
      opacity: 0.9;
      margin: 0 0 1.75rem;
      animation: rise 700ms ease-out 120ms both;
    }
    .cta {
      display: inline-flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      animation: rise 700ms ease-out 220ms both;
    }
    a.button {
      font-family: "Segoe UI", "Helvetica Neue", sans-serif;
      text-decoration: none;
      color: var(--ink);
      background: var(--accent-2);
      padding: 0.7rem 1.1rem;
      border-radius: 2px;
      font-weight: 600;
    }
    a.ghost {
      color: var(--paper);
      background: transparent;
      border: 1px solid var(--mist);
    }
    .panel {
      margin-top: 2.5rem;
      padding: 1rem 1.1rem;
      background: var(--panel);
      border: 1px solid rgba(183, 207, 196, 0.25);
      backdrop-filter: blur(6px);
      font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      font-size: 0.85rem;
      animation: rise 700ms ease-out 320ms both;
    }
    .panel div { margin: 0.25rem 0; }
    @keyframes rise {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <main>
    <h1 class="brand">Ross <span>AI</span><br/>Runtime Platform</h1>
    <p class="lede">Command package development, local runtime, and deploy plans — live on this host.</p>
    <div class="cta">
      <a class="button" href="/health">Health</a>
      <a class="button ghost" href="/metadata">Metadata</a>
    </div>
    <div class="panel" id="status">Loading…</div>
  </main>
  <script>
    Promise.all([
      fetch('/health').then(r => r.json()),
      fetch('/metadata').then(r => r.json())
    ]).then(([health, meta]) => {
      const el = document.getElementById('status');
      el.innerHTML = [
        '<div>status: ' + health.status + '</div>',
        '<div>product: ' + meta.product + '</div>',
        '<div>version: ' + meta.version + '</div>',
        '<div>brand: ' + meta.brand + '</div>',
        '<div>time: ' + health.time + '</div>'
      ].join('');
    }).catch(err => {
      document.getElementById('status').textContent = String(err);
    });
  </script>
</body>
</html>
"""


class RossHandler(BaseHTTPRequestHandler):
    root: Path
    manifest: dict[str, Any]

    def log_message(self, fmt: str, *args: object) -> None:
        sys_stderr = __import__("sys").stderr
        print(f"[ross] {self.address_string()} {fmt % args}", file=sys_stderr)

    def _send(self, code: int, body: bytes, content_type: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code: int, payload: dict[str, Any]) -> None:
        raw = (json.dumps(payload, indent=2) + "\n").encode("utf-8")
        self._send(code, raw, "application/json; charset=utf-8")

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path in {"/", "/index.html"}:
            self._send(200, DASHBOARD_HTML.encode("utf-8"), "text/html; charset=utf-8")
            return
        if path == "/health":
            self._json(
                200,
                {
                    "status": "ok",
                    "service": "ross-ai-runtime-platform",
                    "time": datetime.now(timezone.utc).isoformat(),
                },
            )
            return
        if path == "/metadata":
            dist = dist_path(self.root)
            artifacts = []
            if dist.is_dir():
                artifacts = sorted(p.name for p in dist.iterdir() if p.is_file())
            self._json(
                200,
                {
                    "product": self.manifest.get("product") or __product__,
                    "brand": self.manifest.get("brand") or __brand__,
                    "name": self.manifest.get("name"),
                    "version": self.manifest.get("version"),
                    "rossVersion": __version__,
                    "scripts": list((self.manifest.get("scripts") or {}).keys()),
                    "artifacts": artifacts,
                    "env": os.environ.get("ROSS_ENV", "local"),
                },
            )
            return
        self._json(404, {"error": "not_found", "path": path})


def serve(root: Path, *, host: str, port: int, manifest: dict[str, Any]) -> None:
    handler = partial(RossHandler)
    # Bind attributes on class for handler instances
    RossHandler.root = root
    RossHandler.manifest = manifest
    httpd = ThreadingHTTPServer((host, port), handler)
    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()
