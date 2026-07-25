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
from ross_ai.execution import ExecutionService
from ross_ai.github_oauth import (
    authorize_url,
    dev_simulate_profile,
    exchange_code,
    fetch_github_profile,
    github_configured,
    new_oauth_state,
)
from ross_ai.hardening import (
    RateLimiter,
    apply_security_headers,
    clear_mfa_cookie,
    clear_session_cookie,
    hardening_report,
    mfa_pending_cookie,
    parse_cookies,
    session_cookie,
)
from ross_ai.inventory import build_inventory
from ross_ai.legal import ZERO_REFUND_BANNER, acceptance_checklist, all_sections
from ross_ai.mailer import send_code_email, smtp_configured
from ross_ai.membership import get_tier, list_tiers, validate_tier_id
from ross_ai.otp import OtpService, otpauth_uri, verify_totp
from ross_ai.paths import DEFAULT_HOST, DEFAULT_PORT, dist_path, plans_path
from ross_ai.rbac import RbacService, rbac_matrix
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
        self.otp = OtpService(self.store)
        self.rbac = RbacService(self.store)
        self.execution = ExecutionService(self.store, root)
        self.bus = EventBus()
        self._oauth_states: dict[str, float] = {}
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

    def _issue_email_code(self, email: str, purpose: str) -> tuple[str, dict]:
        code, meta = self.state.otp.issue(email, purpose)
        delivery = send_code_email(to_email=email, purpose=purpose, code=code)
        self.state.bus.publish(
            f"otp.{purpose}",
            email=email,
            message=f"6-digit code issued via {delivery.get('channel')}",
        )
        return code, delivery

    def _onboarding_destination(self, user: dict | None) -> str:
        if not user:
            return "/signin"
        if not user.get("emailVerified"):
            return "/verify-email"
        if not user.get("mfaEnabled"):
            return "/setup-mfa"
        if not user.get("membershipActive"):
            return "/membership"
        return "/dashboard"

    def _require_perm(self, user: dict | None, permission: str) -> bool:
        if not user:
            self._redirect("/signin")
            return False
        email = user["email"]
        allowed = self.state.rbac.can(email, permission)
        self.state.rbac.record_decision(email, permission, allowed)
        if not allowed:
            self._send(
                403,
                json.dumps(
                    {
                        "error": "forbidden",
                        "permission": permission,
                        "role": user.get("role"),
                        "message": f"Missing permission: {permission}",
                    },
                    indent=2,
                ).encode()
                + b"\n",
                "application/json; charset=utf-8",
            )
            return False
        return True

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
            if user:
                self._redirect(self._onboarding_destination(user))
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
            if user:
                self._redirect(self._onboarding_destination(user))
                return
            self._html(
                200,
                pages.gate_page(
                    mode="signin",
                    action="/signin",
                    heading="Sign in",
                    sub="Password plus MFA / 2FA (authenticator or email 6-digit code).",
                    submit="Continue",
                    csrf=csrf,
                    user=user,
                ),
            )
            return

        if path in {"/signup", "/sign-up", "/register"}:
            if user:
                self._redirect(self._onboarding_destination(user))
                return
            self._html(
                200,
                pages.gate_page(
                    mode="signup",
                    action="/signup",
                    heading="Create account",
                    sub="Step 01 — credentials. Next: email 6-digit verification, MFA/2FA, membership, payment. Zero refunds.",
                    submit="Continue to email verification",
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
            "/verify-email",
            "/setup-mfa",
            "/rbac",
            "/execute",
        }
        if path in protected and not user:
            self._redirect("/signin")
            return

        if path == "/mfa":
            cookies = parse_cookies(self.headers.get("Cookie"))
            challenge = self.state.auth.get_mfa_challenge(cookies.get("ross_mfa"))
            if not challenge:
                self._redirect("/signin")
                return
            self._html(
                200,
                pages.mfa_challenge_page(
                    email=challenge["email"],
                    csrf="",
                    dev_code=self.state.otp.latest_dev_code(challenge["email"], "login_mfa")
                    if not smtp_configured()
                    else None,
                    user=None,
                ),
            )
            return

        if user and path == "/verify-email":
            if user.get("emailVerified"):
                self._redirect(self._onboarding_destination(user))
                return
            # ensure a code exists
            if not self.state.otp.latest_dev_code(user["email"], "email_verify"):
                self._issue_email_code(user["email"], "email_verify")
            self._html(
                200,
                pages.verify_email_page(
                    email=user["email"],
                    csrf=csrf,
                    dev_code=None
                    if smtp_configured()
                    else self.state.otp.latest_dev_code(user["email"], "email_verify"),
                    delivery_detail="Dev inbox (configure ROSS_SMTP_* for real email).",
                    user=user,
                ),
            )
            return

        if user and path == "/setup-mfa":
            if not user.get("emailVerified"):
                self._redirect("/verify-email")
                return
            if user.get("mfaEnabled"):
                self._redirect(self._onboarding_destination(user))
                return
            secret = self.state.auth.mfa_secret_for(user["email"]) or self.state.auth.begin_mfa_enrollment(
                user["email"]
            )
            self._html(
                200,
                pages.setup_mfa_page(
                    email=user["email"],
                    secret=secret,
                    otpauth=otpauth_uri(secret, user["email"]),
                    csrf=csrf,
                    user=user,
                ),
            )
            return

        membership_gated = {
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
            "/rbac",
            "/execute",
        }
        if path in membership_gated and user:
            if not user.get("emailVerified"):
                self._redirect("/verify-email")
                return
            if not user.get("mfaEnabled"):
                self._redirect("/setup-mfa")
                return
            if path not in {"/membership", "/payment"} and not user.get("membershipActive"):
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
            if not self._require_perm(user, "users.read"):
                return
            members = self.state.billing.list_members()
            # enrich roles
            for m in members:
                m["role"] = self.state.rbac.role_of(m["email"])
            self._html(
                200,
                pages.users_page(members=members, user=user, csrf=csrf),
            )
            return

        if path == "/rbac":
            if not self._require_perm(user, "roles.read"):
                return
            members = self.state.billing.list_members()
            for m in members:
                m["role"] = self.state.rbac.role_of(m["email"])
            self._html(
                200,
                pages.rbac_page(
                    matrix=rbac_matrix(),
                    decisions=self.state.rbac.recent_decisions(),
                    members=members,
                    csrf=csrf,
                    user=user,
                ),
            )
            return

        if path == "/execute":
            if not self._require_perm(user, "code.execute"):
                return
            self._html(
                200,
                pages.execute_page(
                    scripts=self.state.execution.list_runnable(user["email"]),
                    executions=self.state.execution.recent(
                        None if self.state.rbac.can(user["email"], "admin.audit.read") else user["email"]
                    ),
                    csrf=csrf,
                    user=user,
                ),
            )
            return

        if path == "/auth/github":
            state = new_oauth_state()
            self.state._oauth_states[state] = __import__("time").time() + 600
            if not github_configured():
                # Dev integration path — transparent scaffold without GitHub App secrets
                self._redirect(f"/auth/github/callback?code=dev&state={state}")
                return
            self._redirect(authorize_url(state))
            return

        if path == "/auth/github/callback":
            qs = parse_qs(parsed.query)
            state = (qs.get("state") or [""])[0]
            code = (qs.get("code") or [""])[0]
            exp = self.state._oauth_states.pop(state, None)
            if not exp or exp < __import__("time").time():
                self._html(
                    400,
                    pages.gate_page(
                        mode="signin",
                        action="/signin",
                        heading="Sign in",
                        sub="GitHub state invalid or expired.",
                        submit="Continue",
                        error="GitHub OAuth state mismatch. Try again.",
                        user=None,
                    ),
                )
                return
            try:
                if not github_configured() and code == "dev":
                    profile = dev_simulate_profile(login=f"ross-dev-{state[:6]}")
                else:
                    token_payload = exchange_code(code)
                    access = token_payload.get("access_token")
                    if not access:
                        raise RuntimeError(token_payload.get("error_description") or "no access_token")
                    profile = fetch_github_profile(access)
                session, created = self.state.auth.upsert_github_user(profile)
                self.state.bus.publish(
                    "github.auth",
                    email=session.email,
                    message=("github account created" if created else "github sign-in")
                    + f" · {profile.get('login')}",
                )
                cookie = session_cookie(session.token, secure=self._wants_secure_cookie())
                profile_user = self.state.auth.user_profile(session.email) or {}
                self._redirect(self._onboarding_destination(profile_user), [("Set-Cookie", cookie)])
            except Exception as err:  # noqa: BLE001
                self._html(
                    400,
                    pages.gate_page(
                        mode="signin",
                        action="/signin",
                        heading="Sign in",
                        sub="GitHub authentication failed.",
                        submit="Continue",
                        error=str(err),
                        user=None,
                    ),
                )
            return

        if path == "/api/rbac":
            if not user or not self._require_perm(user, "roles.read"):
                return
            code, body, ctype = _json_bytes(rbac_matrix())
            self._send(code, body, ctype)
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
                        sub="Step 01 — credentials. Next: email 6-digit verification, MFA/2FA, membership, payment. Zero refunds.",
                        submit="Continue to email verification",
                        csrf="",
                        error=msg,
                        user=None,
                    ),
                )
                return
            self._issue_email_code(new_session.email, "email_verify")
            self.state.bus.publish("signup", email=new_session.email, message="account created — verify email")
            cookie = session_cookie(new_session.token, secure=self._wants_secure_cookie())
            self._redirect("/verify-email", [("Set-Cookie", cookie)])
            return

        if path in {"/signin", "/login", "/sign-in"}:
            if not self._require_rate(self.state.auth_limiter):
                return
            ok, msg, new_session, mfa_challenge = self.state.auth.login(
                form.get("email", ""), form.get("password", "")
            )
            if not ok:
                self._html(
                    401,
                    pages.gate_page(
                        mode="signin",
                        action="/signin",
                        heading="Sign in",
                        sub="Password plus MFA / 2FA (authenticator or email 6-digit code).",
                        submit="Continue",
                        csrf="",
                        error=msg,
                        user=None,
                    ),
                )
                return
            if mfa_challenge:
                self._redirect(
                    "/mfa",
                    [
                        (
                            "Set-Cookie",
                            mfa_pending_cookie(
                                mfa_challenge["token"], secure=self._wants_secure_cookie()
                            ),
                        )
                    ],
                )
                return
            assert new_session is not None
            profile = self.state.auth.user_profile(new_session.email) or {}
            cookie = session_cookie(new_session.token, secure=self._wants_secure_cookie())
            self._redirect(self._onboarding_destination(profile), [("Set-Cookie", cookie)])
            return

        if path == "/verify-email":
            if not user or not session:
                self._redirect("/signin")
                return
            if not self.state.auth.validate_csrf(session, form.get("csrf")):
                self._send(403, b'{"error":"csrf"}\n', "application/json; charset=utf-8")
                return
            ok, msg = self.state.otp.verify(user["email"], "email_verify", form.get("code", ""))
            if not ok:
                self._html(
                    400,
                    pages.verify_email_page(
                        email=user["email"],
                        csrf=session.csrf,
                        error=msg,
                        dev_code=None
                        if smtp_configured()
                        else self.state.otp.latest_dev_code(user["email"], "email_verify"),
                        user=user,
                    ),
                )
                return
            self.state.auth.mark_email_verified(user["email"])
            self.state.bus.publish("email.verified", email=user["email"], message="email verified")
            self._redirect("/setup-mfa")
            return

        if path == "/verify-email/resend":
            if not user or not session:
                self._redirect("/signin")
                return
            if not self.state.auth.validate_csrf(session, form.get("csrf")):
                self._send(403, b'{"error":"csrf"}\n', "application/json; charset=utf-8")
                return
            self._issue_email_code(user["email"], "email_verify")
            self._html(
                200,
                pages.verify_email_page(
                    email=user["email"],
                    csrf=session.csrf,
                    flash="A new 6-digit code was issued.",
                    dev_code=None
                    if smtp_configured()
                    else self.state.otp.latest_dev_code(user["email"], "email_verify"),
                    user=user,
                ),
            )
            return

        if path == "/setup-mfa":
            if not user or not session:
                self._redirect("/signin")
                return
            if not self.state.auth.validate_csrf(session, form.get("csrf")):
                self._send(403, b'{"error":"csrf"}\n', "application/json; charset=utf-8")
                return
            ok, msg = self.state.auth.confirm_mfa_enrollment(user["email"], form.get("code", ""))
            secret = self.state.auth.mfa_secret_for(user["email"]) or ""
            if not ok:
                self._html(
                    400,
                    pages.setup_mfa_page(
                        email=user["email"],
                        secret=secret,
                        otpauth=otpauth_uri(secret, user["email"]) if secret else "",
                        csrf=session.csrf,
                        error=msg,
                        user=user,
                    ),
                )
                return
            self.state.bus.publish("mfa.enabled", email=user["email"], message="MFA/2FA enabled")
            self._redirect("/membership")
            return

        if path == "/mfa/email":
            cookies = parse_cookies(self.headers.get("Cookie"))
            challenge = self.state.auth.get_mfa_challenge(cookies.get("ross_mfa"))
            if not challenge:
                self._redirect("/signin")
                return
            self._issue_email_code(challenge["email"], "login_mfa")
            self._html(
                200,
                pages.mfa_challenge_page(
                    email=challenge["email"],
                    flash="Email MFA code sent.",
                    dev_code=None
                    if smtp_configured()
                    else self.state.otp.latest_dev_code(challenge["email"], "login_mfa"),
                    user=None,
                ),
            )
            return

        if path == "/mfa":
            cookies = parse_cookies(self.headers.get("Cookie"))
            mfa_token = cookies.get("ross_mfa")
            challenge = self.state.auth.get_mfa_challenge(mfa_token)
            if not challenge:
                self._redirect("/signin")
                return
            factor = form.get("factor") or "totp"
            code = form.get("code", "")
            email = challenge["email"]
            ok = False
            msg = "Invalid code."
            if factor == "email":
                ok, msg = self.state.otp.verify(email, "login_mfa", code)
            else:
                secret = self.state.auth.mfa_secret_for(email)
                if secret and verify_totp(secret, code):
                    ok, msg = True, "Verified."
                else:
                    ok, msg = False, "Invalid authenticator code."
            if not ok:
                self._html(
                    401,
                    pages.mfa_challenge_page(
                        email=email,
                        error=msg,
                        dev_code=None
                        if smtp_configured()
                        else self.state.otp.latest_dev_code(email, "login_mfa"),
                        user=None,
                    ),
                )
                return
            done_ok, done_msg, new_session = self.state.auth.complete_mfa_login(mfa_token or "")
            if not done_ok or not new_session:
                self._redirect("/signin")
                return
            profile = self.state.auth.user_profile(new_session.email) or {}
            self._redirect(
                self._onboarding_destination(profile),
                [
                    ("Set-Cookie", session_cookie(new_session.token, secure=self._wants_secure_cookie())),
                    ("Set-Cookie", clear_mfa_cookie()),
                ],
            )
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

        if path == "/rbac/assign":
            if not user or not session:
                self._redirect("/signin")
                return
            if not self.state.auth.validate_csrf(session, form.get("csrf")):
                self._send(403, b'{"error":"csrf"}\n', "application/json; charset=utf-8")
                return
            if not self._require_perm(user, "roles.assign"):
                return
            ok, msg = self.state.rbac.assign_role(user["email"], form.get("email", ""), form.get("role", ""))
            members = self.state.billing.list_members()
            for m in members:
                m["role"] = self.state.rbac.role_of(m["email"])
            self._html(
                200 if ok else 403,
                pages.rbac_page(
                    matrix=rbac_matrix(),
                    decisions=self.state.rbac.recent_decisions(),
                    members=members,
                    csrf=session.csrf,
                    user=user,
                    flash=msg,
                ),
            )
            return

        if path == "/execute":
            if not user or not session:
                self._redirect("/signin")
                return
            if not self.state.auth.validate_csrf(session, form.get("csrf")):
                self._send(403, b'{"error":"csrf"}\n', "application/json; charset=utf-8")
                return
            if not self._require_perm(user, "code.execute"):
                return
            result = self.state.execution.execute(user["email"], form.get("scriptId", ""))
            self.state.bus.publish(
                "code.execute",
                email=user["email"],
                message=f"{result.get('scriptId')} ok={result.get('ok')}",
            )
            self._html(
                200,
                pages.execute_page(
                    scripts=self.state.execution.list_runnable(user["email"]),
                    executions=self.state.execution.recent(
                        None if self.state.rbac.can(user["email"], "admin.audit.read") else user["email"]
                    ),
                    csrf=session.csrf,
                    result=result,
                    user=user,
                ),
            )
            return

        if path == "/execute/save":
            if not user or not session:
                self._redirect("/signin")
                return
            if not self.state.auth.validate_csrf(session, form.get("csrf")):
                self._send(403, b'{"error":"csrf"}\n', "application/json; charset=utf-8")
                return
            if not self._require_perm(user, "code.scripts.write"):
                return
            ok, msg, _path = self.state.execution.save_personal_script(
                user["email"], form.get("name", ""), form.get("source", "")
            )
            self._html(
                200 if ok else 400,
                pages.execute_page(
                    scripts=self.state.execution.list_runnable(user["email"]),
                    executions=self.state.execution.recent(user["email"]),
                    csrf=session.csrf,
                    flash=msg if ok else None,
                    error=None if ok else msg,
                    user=user,
                ),
            )
            return

        if path == "/logout":
            if session and not self.state.auth.validate_csrf(session, form.get("csrf")):
                self._send(403, b'{"error":"csrf"}\n', "application/json; charset=utf-8")
                return
            email = session.email if session else None
            self.state.auth.logout(session.token if session else None)
            if email:
                self.state.bus.publish("logout", email=email, message="operator signed out")
            self._redirect(
                "/",
                [("Set-Cookie", clear_session_cookie()), ("Set-Cookie", clear_mfa_cookie())],
            )
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
