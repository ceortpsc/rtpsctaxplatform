"""GitHub OAuth integration for create-account / sign-in (stdlib urllib)."""

from __future__ import annotations

import json
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


def github_configured() -> bool:
    return bool(os.environ.get("ROSS_GITHUB_CLIENT_ID") and os.environ.get("ROSS_GITHUB_CLIENT_SECRET"))


def redirect_uri() -> str:
    return os.environ.get("ROSS_GITHUB_REDIRECT_URI") or "http://127.0.0.1:8787/auth/github/callback"


def authorize_url(state: str) -> str:
    params = {
        "client_id": os.environ.get("ROSS_GITHUB_CLIENT_ID", "dev-client"),
        "redirect_uri": redirect_uri(),
        "scope": "read:user user:email",
        "state": state,
        "allow_signup": "true",
    }
    return "https://github.com/login/oauth/authorize?" + urllib.parse.urlencode(params)


def exchange_code(code: str) -> dict[str, Any]:
    payload = urllib.parse.urlencode(
        {
            "client_id": os.environ["ROSS_GITHUB_CLIENT_ID"],
            "client_secret": os.environ["ROSS_GITHUB_CLIENT_SECRET"],
            "code": code,
            "redirect_uri": redirect_uri(),
        }
    ).encode()
    req = urllib.request.Request(
        "https://github.com/login/oauth/access_token",
        data=payload,
        headers={"Accept": "application/json", "User-Agent": "Ross-AI-Runtime-Platform"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode())


def fetch_github_profile(access_token: str) -> dict[str, Any]:
    def _get(url: str) -> Any:
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
                "User-Agent": "Ross-AI-Runtime-Platform",
            },
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode())

    user = _get("https://api.github.com/user")
    emails = []
    try:
        emails = _get("https://api.github.com/user/emails")
    except urllib.error.HTTPError:
        emails = []
    primary = None
    for item in emails or []:
        if item.get("primary") and item.get("verified"):
            primary = item.get("email")
            break
    if not primary:
        for item in emails or []:
            if item.get("verified"):
                primary = item.get("email")
                break
    if not primary:
        primary = user.get("email") or f"{user.get('login')}@users.noreply.github.com"
    return {
        "id": str(user.get("id")),
        "login": user.get("login"),
        "name": user.get("name") or user.get("login"),
        "email": primary,
        "avatarUrl": user.get("avatar_url"),
        "htmlUrl": user.get("html_url"),
    }


def new_oauth_state() -> str:
    return secrets.token_urlsafe(24)


def dev_simulate_profile(login: str = "ross-dev") -> dict[str, Any]:
    """Used when GitHub OAuth env is not configured (local/tests)."""
    return {
        "id": "0",
        "login": login,
        "name": "Ross Dev GitHub",
        "email": f"{login}@users.noreply.github.com",
        "avatarUrl": "",
        "htmlUrl": f"https://github.com/{login}",
        "dev": True,
    }
