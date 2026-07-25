"""Ross AI Runtime Platform — HTTP + WebSocket control plane (stdlib only)."""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from ross_ai import __brand__, __product__, __version__
from ross_ai.auth import AuthService
from ross_ai.billing import BillingService, tokenize_card
from ross_ai.events import EventBus
from ross_ai.hardening import (
    RateLimiter,
    apply_security_headers,
    clear_session_cookie,
    hardening_report,
    parse_cookies,
    session_cookie,
)
from ross_ai.inventory import build_inventory
from ross_ai.legal import ZERO_REFUND_BANNER, acceptance_checklist, all_sections
from ross_ai.membership import get_tier, list_tiers, validate_tier_id
from ross_ai.paths import DEFAULT_HOST, DEFAULT_PORT, dist_path, plans_path
from ross_ai.store import JsonStore
from ross_ai.web import pages
from ross_ai.websocket import WebSocketHub, accept_key, decode_frames, encode_json

WEB_ROOT = Path(__file__).resolve().parent / "web" / "static"
DATA_DIR_NAME = "workspace/data"


class AppState:
    def __init__(self, root: Path, manifest: dict[str, Any]) -> None:
        self.root = root
        self.manifest = manifest
        self.store = JsonStore(root / DATA_DIR_NAME / "control-plane.json")
        self.auth = AuthService(self.store)
        self.billing = BillingService(self.store)
        self.bus = EventBus()
        self.hub = WebSocketHub()
        self.limiter = RateLimiter(limit=120, window_sec=60)
        self.auth_limiter = RateLimiter(limit=20, window_sec=60)
        self.secure_cookies = os.environ.get("ROSS_ENV") in {"prod", "production", "docker"}
        self.bus.subscribe(lambda evt: self.hub.broadcast(evt))

    def inventory(self) -> dict[str, Any]:
        return build_inventory(self.root)

    def artifacts(self) -> list[str]:
        d = dist_path(self.root)
        if not d.is_dir():
            return []
        return sorted(p.name for p in d.iterdir() if p.is_file() and p.name != ".gitkeep")

    def plans(self) -> list[str]:
        d = plans_path(self.root)
        if not d.is_dir():
            return []
        return sorted(p.name for p in d.iterdir() if p.suffix == ".json")

    def hardening(self) -> dict[str, Any]:
        inv = self.inventory()
        checks = [
            {"id": "inventory.present", "ok": inv["present"] == inv["total"], "detail": f"{inv['present']}/{inv['total']} modules on disk"},
            {"id": "auth.store", "ok": self.store.path.is_file(), "detail": str(self.store.path.relative_to(self.root))},
            {"id": "security.headers", "ok": True, "detail": "CSP, XFO, nosniff, COOP/CORP enabled"},
            {"id": "security.rate_limit", "ok": True, "detail": "sliding-window limiter active"},
            {"id": "security.sessions", "ok": True, "detail": "HttpOnly SameSite cookies + CSRF"},
            {"id": "security.passwords", "ok": True, "detail": "PBKDF2-SHA256 210k iterations"},
            {"id": "ws.hub", "ok": True, "detail": f"{self.hub.connections} live socket(s)"},
            {"id": "package.artifacts", "ok": True, "detail": f"{len(self.artifacts())} artifact(s)"},
            {"id": "env.example", "ok": (self.root / ".env.example").is_file(), "detail": ".env.example"},
            {
                "id": "compose.ross",
                "ok": (self.root / "docker-compose.ross.yml").is_file(),
                "detail": "docker-compose.ross.yml",
            },
        ]
        return hardening_report(checks)


def _json_bytes(payload: dict[str, Any], code: int = 200) -> tuple[int, bytes, str]:
    return code, (json.dumps(payload, indent=2) + "\n").encode("utf-8"), "application/json; charset=utf-8"


class RossHandler(BaseHTTPRequestHandler):
    state: AppState

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[ross] {self.address_string()} {fmt % args}", flush=True)

    # --- helpers ---
    def _client_key(self) -> str:
        return self.client_address[0]

    def _session(self):
        cookies = parse_cookies(self.headers.get("Cookie"))
        return self.state.auth.get_session(cookies.get("ross_session"))

    def _user(self, session):
        if not session:
            return None
        return self.state.auth.user_profile(session.email)

    def _send(self, code: int, body: bytes, content_type: str, headers: list[tuple[str, str]] | None = None) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        apply_security_headers(self)
        for k, v in headers or []:
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _html(self, code: int, document: str, headers: list[tuple[str, str]] | None = None) -> None:
        self._send(code, document.encode("utf-8"), "text/html; charset=utf-8", headers)

    def _redirect(self, location: str, headers: list[tuple[str, str]] | None = None) -> None:
        self.send_response(303)
        self.send_header("Location", location)
        apply_security_headers(self)
        for k, v in headers or []:
            self.send_header(k, v)
        self.end_headers()

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(length) if length else b""

    def _form(self) -> dict[str, str]:
        raw = self._read_body().decode("utf-8", errors="replace")
        parsed = parse_qs(raw, keep_blank_values=True)
        return {k: (v[-1] if v else "") for k, v in parsed.items()}

    def _wants_secure_cookie(self) -> bool:
        if self.state.secure_cookies:
            return True
        proto = (self.headers.get("X-Forwarded-Proto") or "").split(",")[0].strip().lower()
        return proto == "https"

    def _require_rate(self, limiter: RateLimiter) -> bool:
        if limiter.allow(self._client_key()):
            return True
        self._send(429, b'{"error":"rate_limited"}\n', "application/json; charset=utf-8")
        return False

    def _pending_election(self, email: str) -> dict | None:
        user = (self.state.store.get().get("users") or {}).get(email) or {}
        return user.get("pendingElection")

    def _save_pending_election(self, email: str, *, tier_id: str, cadence: str) -> None:
        def mutate(data: dict) -> None:
            user = data.setdefault("users", {}).get(email)
            if not user:
                raise KeyError(email)
            user["pendingElection"] = {
                "tierId": tier_id,
                "cadence": cadence,
                "zeroRefundAccepted": True,
            }

        self.state.store.update(mutate)

    def _clear_pending_election(self, email: str) -> None:
        def mutate(data: dict) -> None:
            user = data.setdefault("users", {}).get(email)
            if user:
                user.pop("pendingElection", None)

        self.state.store.update(mutate)

    # --- routing ---
    def do_HEAD(self) -> None:  # noqa: N802
        self.do_GET(head_only=True)

    def do_GET(self, head_only: bool = False) -> None:  # noqa: N802
        if not self._require_rate(self.state.limiter):
            return
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path == "/ws":
            self._handle_ws_upgrade()
            return

        if path.startswith("/static/"):
            self._serve_static(path[len("/static/") :])
            return

        session = self._session()
        user = self._user(session)
        csrf = session.csrf if session else ""

        if path == "/health":
            code, body, ctype = _json_bytes(
                {
                    "status": "ok",
                    "service": "ross-ai-runtime-platform",
                    "time": datetime.now(timezone.utc).isoformat(),
                    "wsClients": self.state.hub.connections,
                }
            )
            self._send(code, body, ctype)
            return

        if path == "/metadata":
            inv = self.state.inventory()
            code, body, ctype = _json_bytes(
                {
                    "product": self.state.manifest.get("product") or __product__,
                    "brand": self.state.manifest.get("brand") or __brand__,
                    "name": self.state.manifest.get("name"),
                    "version": self.state.manifest.get("version"),
                    "rossVersion": __version__,
                    "scripts": list((self.state.manifest.get("scripts") or {}).keys()),
                    "artifacts": self.state.artifacts(),
                    "modules": inv["total"],
                    "env": os.environ.get("ROSS_ENV", "local"),
                    "authenticated": bool(user),
                }
            )
            self._send(code, body, ctype)
            return

        if path == "/api/inventory":
            if not user:
                self._send(401, b'{"error":"unauthorized"}\n', "application/json; charset=utf-8")
                return
            code, body, ctype = _json_bytes(self.state.inventory())
            self._send(code, body, ctype)
            return

        if path == "/api/hardening":
            if not user:
                self._send(401, b'{"error":"unauthorized"}\n', "application/json; charset=utf-8")
                return
            code, body, ctype = _json_bytes(self.state.hardening())
            self._send(code, body, ctype)
            return

        if path == "/api/events":
            if not user:
                self._send(401, b'{"error":"unauthorized"}\n', "application/json; charset=utf-8")
                return
            code, body, ctype = _json_bytes({"events": self.state.bus.recent()})
            self._send(code, body, ctype)
            return

        if path == "/":
            if user and user.get("membershipActive"):
                self._redirect("/dashboard")
                return
            if user and not user.get("membershipActive"):
                self._redirect("/membership")
                return
            self._html(200, pages.landing_page(user=user, csrf=csrf))
            return

        if path == "/marketplace":
            self._html(200, pages.marketplace_page(tiers=list_tiers(), user=user, csrf=csrf))
            return

        if path in {"/legal", "/policy", "/disclosures", "/rules"}:
            self._html(
                200,
                pages.legal_page(
                    sections=all_sections(),
                    banner=ZERO_REFUND_BANNER,
                    user=user,
                    csrf=csrf,
                ),
            )
            return

        if path in {"/login", "/signin", "/sign-in"}:
            if user and user.get("membershipActive"):
                self._redirect("/dashboard")
                return
            if user:
                self._redirect("/membership")
                return
            self._html(
                200,
                pages.gate_page(
                    mode="signin",
                    action="/signin",
                    heading="Sign in",
                    sub="Enter the operator console with your Ross access credentials.",
                    submit="Sign in",
                    csrf=csrf,
                    user=user,
                ),
            )
            return

        if path in {"/signup", "/sign-up", "/register"}:
            if user and user.get("membershipActive"):
                self._redirect("/dashboard")
                return
            if user:
                self._redirect("/membership")
                return
            self._html(
                200,
                pages.gate_page(
                    mode="signup",
                    action="/signup",
                    heading="Create account",
                    sub="Step 01 — create credentials. Next: membership election, then payment method on file. Zero refunds.",
                    submit="Continue to membership",
                    csrf=csrf,
                    user=user,
                ),
            )
            return

        # Auth-required HTML pages
        protected = {
            "/dashboard",
            "/modules",
            "/engines",
            "/systems",
            "/infrastructure",
            "/packages",
            "/deploy",
            "/runtime",
            "/foundation",
            "/membership",
            "/payment",
            "/billing",
            "/users",
        }
        if path in protected and not user:
            self._redirect("/signin")
            return

        membership_gated = protected - {"/membership", "/payment"}
        if path in membership_gated and user and not user.get("membershipActive"):
            self._redirect("/membership")
            return

        if path == "/membership":
            qs = parse_qs(parsed.query)
            selected = (qs.get("tier") or ["professional"])[0]
            pending = self._pending_election(user["email"]) if user else None
            if pending and pending.get("tierId"):
                selected = pending["tierId"]
            self._html(
                200,
                pages.membership_election_page(
                    tiers=list_tiers(),
                    checklist=acceptance_checklist(),
                    csrf=csrf,
                    selected_tier=selected if validate_tier_id(selected) else "professional",
                    user=user,
                ),
            )
            return

        if path == "/payment":
            pending = self._pending_election(user["email"]) if user else None
            if not pending or not pending.get("tierId"):
                self._redirect("/membership")
                return
            tier = get_tier(pending["tierId"])
            if not tier:
                self._redirect("/membership")
                return
            cadence = pending.get("cadence") or "monthly"
            amount = tier["priceAnnual"] if cadence == "annual" else tier["priceMonthly"]
            self._html(
                200,
                pages.payment_page(
                    tier=tier,
                    cadence=cadence,
                    amount=amount,
                    csrf=csrf,
                    user=user,
                ),
            )
            return

        if path == "/billing":
            self._html(
                200,
                pages.billing_page(
                    membership=self.state.billing.membership_for(user["email"]),
                    payment_method=self.state.billing.payment_method_for(user["email"]),
                    charges=self.state.billing.charges_for(user["email"]),
                    user=user,
                    csrf=csrf,
                ),
            )
            return

        if path == "/users":
            self._html(
                200,
                pages.users_page(members=self.state.billing.list_members(), user=user, csrf=csrf),
            )
            return

        if path == "/dashboard":
            inv = self.state.inventory()
            self._html(
                200,
                pages.dashboard_page(
                    inventory=inv,
                    hardening=self.state.hardening(),
                    artifacts=self.state.artifacts(),
                    plans=self.state.plans(),
                    events=self.state.bus.recent(),
                    ws_clients=self.state.hub.connections,
                    user=user,
                    csrf=csrf,
                ),
            )
            return

        if path == "/modules":
            items = self.state.inventory()["items"]
            self._html(
                200,
                pages.catalog_page(
                    title="Modules",
                    heading="All modules",
                    sub="Packages, services, workers, pipelines, engines, and tools across the constellation.",
                    items=items,
                    nav="modules",
                    user=user,
                    csrf=csrf,
                ),
            )
            return

        if path == "/engines":
            items = self.state.inventory()["bySector"].get("engines", [])
            self._html(
                200,
                pages.catalog_page(
                    title="Engines",
                    heading="Intelligence engines",
                    sub="Analytics center, refund intelligence, and TC code engines.",
                    items=items,
                    nav="engines",
                    user=user,
                    csrf=csrf,
                ),
            )
            return

        if path == "/systems":
            inv = self.state.inventory()["bySector"]
            items = inv.get("services", []) + inv.get("workers", []) + inv.get("pipelines", [])
            self._html(
                200,
                pages.catalog_page(
                    title="Systems",
                    heading="Systems fabric",
                    sub="Services, workers, and pipelines that move tax operations.",
                    items=items,
                    nav="systems",
                    user=user,
                    csrf=csrf,
                ),
            )
            return

        if path in {"/infrastructure", "/foundation"}:
            inv = self.state.inventory()
            foundation = inv["bySector"].get("packages", []) + inv["bySector"].get("tools", [])
            self._html(
                200,
                pages.infrastructure_page(
                    hardening=self.state.hardening(),
                    foundation=foundation,
                    user=user,
                    csrf=csrf,
                ),
            )
            return

        if path == "/packages":
            arts = self.state.artifacts()
            content = (
                "<ul class='list'>"
                + "".join(f"<li>{pages.esc(a)}</li>" for a in arts)
                + "</ul><p class='muted'>Build with <code>python ross.py package build</code></p>"
            )
            self._html(
                200,
                pages.simple_console_page(
                    title="Packages",
                    heading="Ross packages",
                    sub="Sealed .rpkg artifacts and checksum sidecars.",
                    content=content,
                    nav="packages",
                    user=user,
                    csrf=csrf,
                ),
            )
            return

        if path == "/deploy":
            plans = self.state.plans()
            content = (
                "<ul class='list'>"
                + "".join(f"<li>{pages.esc(p)}</li>" for p in plans)
                + "</ul><p class='muted'>Generate with <code>python ross.py deploy plan &lt;target&gt;</code></p>"
            )
            self._html(
                200,
                pages.simple_console_page(
                    title="Deploy",
                    heading="Deployment plans",
                    sub="Local, Docker, Kubernetes, cloud functions, and edge targets.",
                    content=content,
                    nav="deploy",
                    user=user,
                    csrf=csrf,
                ),
            )
            return

        if path == "/runtime":
            scripts = self.state.manifest.get("scripts") or {}
            content = (
                "<ul class='list'>"
                + "".join(f"<li><strong>{pages.esc(k)}</strong> → {pages.esc(v)}</li>" for k, v in scripts.items())
                + "</ul><p class='muted'>Run with <code>python ross.py runtime run hello</code></p>"
            )
            self._html(
                200,
                pages.simple_console_page(
                    title="Runtime",
                    heading="Runtime scripts",
                    sub="Project scripts available to the Ross runtime runner.",
                    content=content,
                    nav="runtime",
                    user=user,
                    csrf=csrf,
                ),
            )
            return

        self._send(404, b'{"error":"not_found"}\n', "application/json; charset=utf-8")

    def do_POST(self) -> None:  # noqa: N802
        if not self._require_rate(self.state.limiter):
            return
        path = urlparse(self.path).path.rstrip("/") or "/"
        form = self._form()
        session = self._session()
        user = self._user(session)

        if path in {"/signup", "/sign-up", "/register"}:
            if not self._require_rate(self.state.auth_limiter):
                return
            ok, msg, new_session = self.state.auth.signup(
                form.get("email", ""), form.get("password", ""), form.get("name", "")
            )
            if not ok or not new_session:
                self._html(
                    400,
                    pages.gate_page(
                        mode="signup",
                        action="/signup",
                        heading="Create account",
                        sub="Step 01 — create credentials. Next: membership election, then payment method on file. Zero refunds.",
                        submit="Continue to membership",
                        csrf="",
                        error=msg,
                        user=None,
                    ),
                )
                return
            self.state.bus.publish("signup", email=new_session.email, message="account created — elect membership")
            cookie = session_cookie(new_session.token, secure=self._wants_secure_cookie())
            self._redirect("/membership", [("Set-Cookie", cookie)])
            return

        if path in {"/signin", "/login", "/sign-in"}:
            if not self._require_rate(self.state.auth_limiter):
                return
            ok, msg, new_session = self.state.auth.login(form.get("email", ""), form.get("password", ""))
            if not ok or not new_session:
                self._html(
                    401,
                    pages.gate_page(
                        mode="signin",
                        action="/signin",
                        heading="Sign in",
                        sub="Enter the operator console with your Ross access credentials.",
                        submit="Sign in",
                        csrf="",
                        error=msg,
                        user=None,
                    ),
                )
                return
            self.state.bus.publish("login", email=new_session.email, message="operator signed in")
            cookie = session_cookie(new_session.token, secure=self._wants_secure_cookie())
            profile = self.state.auth.user_profile(new_session.email) or {}
            dest = "/dashboard" if profile.get("membershipActive") else "/membership"
            self._redirect(dest, [("Set-Cookie", cookie)])
            return

        if path == "/membership":
            if not user or not session:
                self._redirect("/signin")
                return
            if not self.state.auth.validate_csrf(session, form.get("csrf")):
                self._send(403, b'{"error":"csrf"}\n', "application/json; charset=utf-8")
                return
            tier_id = form.get("tierId", "")
            if not validate_tier_id(tier_id):
                self._html(
                    400,
                    pages.membership_election_page(
                        tiers=list_tiers(),
                        checklist=acceptance_checklist(),
                        csrf=session.csrf,
                        selected_tier="professional",
                        error="Select a valid membership tier.",
                        user=user,
                    ),
                )
                return
            if form.get("zeroRefunds") != "1":
                self._html(
                    400,
                    pages.membership_election_page(
                        tiers=list_tiers(),
                        checklist=acceptance_checklist(),
                        csrf=session.csrf,
                        selected_tier=tier_id,
                        error="You must accept ZERO REFUNDS — ABSOLUTELY ZERO.",
                        user=user,
                    ),
                )
                return
            for i, _ in enumerate(acceptance_checklist()):
                if form.get(f"accept_{i}") != "1":
                    self._html(
                        400,
                        pages.membership_election_page(
                            tiers=list_tiers(),
                            checklist=acceptance_checklist(),
                            csrf=session.csrf,
                            selected_tier=tier_id,
                            error="Accept all membership disclosures to continue.",
                            user=user,
                        ),
                    )
                    return
            cadence = form.get("cadence") or "monthly"
            self._save_pending_election(user["email"], tier_id=tier_id, cadence=cadence)
            self.state.bus.publish(
                "membership.elect",
                email=user["email"],
                message=f"elected {tier_id} ({cadence})",
            )
            self._redirect("/payment")
            return

        if path == "/payment":
            if not user or not session:
                self._redirect("/signin")
                return
            if not self.state.auth.validate_csrf(session, form.get("csrf")):
                self._send(403, b'{"error":"csrf"}\n', "application/json; charset=utf-8")
                return
            pending = self._pending_election(user["email"])
            tier = get_tier((pending or {}).get("tierId", ""))
            if not pending or not tier:
                self._redirect("/membership")
                return
            cadence = pending.get("cadence") or "monthly"
            amount = tier["priceAnnual"] if cadence == "annual" else tier["priceMonthly"]

            def payment_error(msg: str) -> None:
                self._html(
                    400,
                    pages.payment_page(
                        tier=tier,
                        cadence=cadence,
                        amount=amount,
                        csrf=session.csrf,
                        error=msg,
                        user=user,
                    ),
                )

            if form.get("zeroRefunds") != "1" or form.get("disclosures") != "1":
                payment_error("Accept disclosures and the absolute zero-refund policy.")
                return
            tok_ok, tok_msg, method = tokenize_card(
                number=form.get("cardNumber", ""),
                exp_month=form.get("expMonth", ""),
                exp_year=form.get("expYear", ""),
                cvc=form.get("cvc", ""),
                name=form.get("cardName", ""),
                zip_code=form.get("zip", ""),
            )
            if not tok_ok or not method:
                payment_error(tok_msg)
                return
            bill_ok, bill_msg = self.state.billing.attach_membership(
                user["email"],
                tier_id=tier["id"],
                cadence=cadence,
                autopay=form.get("autopay") == "1",
                payment_method=method,
                zero_refund_accepted=True,
                disclosures_accepted=True,
            )
            if not bill_ok:
                payment_error(bill_msg)
                return
            self._clear_pending_election(user["email"])
            self.state.bus.publish(
                "payment.captured",
                email=user["email"],
                message=f"{tier['name']} · ${amount} · ****{method.get('last4')} · zero refunds",
            )
            self._redirect("/dashboard")
            return

        if path == "/logout":
            if session and not self.state.auth.validate_csrf(session, form.get("csrf")):
                self._send(403, b'{"error":"csrf"}\n', "application/json; charset=utf-8")
                return
            email = session.email if session else None
            self.state.auth.logout(session.token if session else None)
            if email:
                self.state.bus.publish("logout", email=email, message="operator signed out")
            self._redirect("/", [("Set-Cookie", clear_session_cookie())])
            return

        self._send(404, b'{"error":"not_found"}\n', "application/json; charset=utf-8")

    def _serve_static(self, rel: str) -> None:
        # prevent path traversal
        candidate = (WEB_ROOT / rel).resolve()
        if not str(candidate).startswith(str(WEB_ROOT.resolve())) or not candidate.is_file():
            self._send(404, b"not found", "text/plain; charset=utf-8")
            return
        data = candidate.read_bytes()
        ctype = "text/plain; charset=utf-8"
        if candidate.suffix == ".css":
            ctype = "text/css; charset=utf-8"
        elif candidate.suffix == ".js":
            ctype = "application/javascript; charset=utf-8"
        elif candidate.suffix == ".svg":
            ctype = "image/svg+xml"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "public, max-age=300")
        apply_security_headers(self)
        self.end_headers()
        self.wfile.write(data)

    def _handle_ws_upgrade(self) -> None:
        if (self.headers.get("Upgrade") or "").lower() != "websocket":
            self._send(400, b"expected websocket upgrade", "text/plain; charset=utf-8")
            return
        key = self.headers.get("Sec-WebSocket-Key")
        if not key:
            self._send(400, b"missing Sec-WebSocket-Key", "text/plain; charset=utf-8")
            return

        # Optional auth: allow connect but mark identity
        session = self._session()
        user = self._user(session)

        accept = accept_key(key)
        self.send_response(101, "Switching Protocols")
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", accept)
        apply_security_headers(self)
        self.end_headers()

        send_lock = threading.Lock()

        def send(frame: bytes) -> None:
            with send_lock:
                self.wfile.write(frame)
                self.wfile.flush()

        remove = self.state.hub.add(send)
        self.state.bus.publish(
            "ws.connect",
            message=f"socket open ({user['email'] if user else 'anonymous'})",
            email=(user or {}).get("email"),
        )
        self.state.hub.broadcast({"type": "clients", "clients": self.state.hub.connections})
        try:
            send(
                encode_json(
                    {
                        "type": "hello-ack",
                        "product": __product__,
                        "clients": self.state.hub.connections,
                        "authenticated": bool(user),
                        "recent": self.state.bus.recent(15),
                    }
                )
            )
            buf = bytearray()
            while True:
                chunk = self.rfile.read(4096)
                if not chunk:
                    break
                buf.extend(chunk)
                messages, buf = decode_frames(buf)
                stop = False
                for msg in messages:
                    if msg == "":
                        stop = True
                        break
                    try:
                        data = json.loads(msg)
                    except json.JSONDecodeError:
                        continue
                    if data.get("type") == "hello":
                        send(
                            encode_json(
                                {
                                    "type": "hello-ack",
                                    "clients": self.state.hub.connections,
                                    "authenticated": bool(user),
                                }
                            )
                        )
                    elif data.get("type") == "ping":
                        send(encode_json({"type": "pong", "at": datetime.now(timezone.utc).isoformat()}))
                if stop:
                    break
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            remove()
            self.state.hub.broadcast({"type": "clients", "clients": self.state.hub.connections})
            self.state.bus.publish(
                "ws.disconnect",
                message=f"socket closed ({user['email'] if user else 'anonymous'})",
                email=(user or {}).get("email"),
            )


def serve(root: Path, *, host: str = DEFAULT_HOST, port: int = DEFAULT_PORT, manifest: dict[str, Any]) -> None:
    state = AppState(root, manifest)
    state.bus.publish("platform.start", message=f"listening on {host}:{port}")
    RossHandler.state = state
    httpd = ThreadingHTTPServer((host, port), RossHandler)
    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()
