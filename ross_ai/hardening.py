"""Security hardening helpers — headers, rate limits, cookie flags."""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from typing import Iterable


SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "connect-src 'self' ws: wss:; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    ),
}


class RateLimiter:
    """Sliding-window limiter keyed by client identity."""

    def __init__(self, limit: int = 60, window_sec: float = 60.0) -> None:
        self.limit = limit
        self.window = window_sec
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.time()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > self.window:
                q.popleft()
            if len(q) >= self.limit:
                return False
            q.append(now)
            return True


def apply_security_headers(handler, extra: dict[str, str] | None = None) -> None:
    for k, v in SECURITY_HEADERS.items():
        handler.send_header(k, v)
    if extra:
        for k, v in extra.items():
            handler.send_header(k, v)


def session_cookie(token: str, *, secure: bool = False, max_age: int = 43200) -> str:
    parts = [
        f"ross_session={token}",
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        f"Max-Age={max_age}",
    ]
    if secure:
        parts.append("Secure")
    return "; ".join(parts)


def mfa_pending_cookie(token: str, *, secure: bool = False, max_age: int = 600) -> str:
    parts = [
        f"ross_mfa={token}",
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        f"Max-Age={max_age}",
    ]
    if secure:
        parts.append("Secure")
    return "; ".join(parts)


def clear_session_cookie() -> str:
    return "ross_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"


def clear_mfa_cookie() -> str:
    return "ross_mfa=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"


def parse_cookies(header: str | None) -> dict[str, str]:
    out: dict[str, str] = {}
    if not header:
        return out
    for part in header.split(";"):
        if "=" in part:
            k, v = part.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def hardening_report(root_checks: Iterable[dict]) -> dict:
    checks = list(root_checks)
    failed = [c for c in checks if not c.get("ok")]
    return {
        "ok": len(failed) == 0,
        "score": max(0, 100 - 8 * len(failed)),
        "checks": checks,
        "controls": [
            "PBKDF2-SHA256 password hashing (210k iterations)",
            "HttpOnly + SameSite session cookies",
            "CSRF tokens on mutating forms",
            "Security response headers (CSP, XFO, nosniff, COOP/CORP)",
            "Per-IP sliding-window rate limiting",
            "WebSocket origin checks + authenticated channels",
            "Audit log for signup/login/logout",
            "Secrets never returned in metadata payloads",
        ],
    }
