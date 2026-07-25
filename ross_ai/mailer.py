"""Email delivery for verification / MFA codes (smtplib or dev inbox)."""

from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
from typing import Any


def smtp_configured() -> bool:
    return bool(os.environ.get("ROSS_SMTP_HOST") and os.environ.get("ROSS_SMTP_FROM"))


def send_code_email(*, to_email: str, purpose: str, code: str) -> dict[str, Any]:
    """Attempt SMTP send when configured; otherwise mark as dev-delivered."""
    subject_map = {
        "email_verify": "Ross AI — email verification code",
        "login_mfa": "Ross AI — sign-in MFA code",
        "mfa_email": "Ross AI — MFA email code",
    }
    subject = subject_map.get(purpose, "Ross AI — security code")
    body = (
        f"Your Ross Tax Pro Software Co | RunTime AI Assist 6-digit code is: {code}\n\n"
        f"Purpose: {purpose}\n"
        "This code expires in 10 minutes.\n"
        "If you did not request this, secure your account immediately.\n"
    )

    if not smtp_configured():
        return {
            "delivered": False,
            "channel": "dev-inbox",
            "detail": "SMTP not configured — code stored in control-plane dev inbox.",
        }

    host = os.environ["ROSS_SMTP_HOST"]
    port = int(os.environ.get("ROSS_SMTP_PORT") or 587)
    user = os.environ.get("ROSS_SMTP_USER") or ""
    password = os.environ.get("ROSS_SMTP_PASS") or ""
    from_addr = os.environ["ROSS_SMTP_FROM"]
    use_tls = (os.environ.get("ROSS_SMTP_TLS") or "1") != "0"

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.set_content(body)

    try:
        with smtplib.SMTP(host, port, timeout=15) as smtp:
            if use_tls:
                smtp.starttls()
            if user:
                smtp.login(user, password)
            smtp.send_message(msg)
        return {"delivered": True, "channel": "smtp", "detail": f"sent via {host}"}
    except Exception as err:  # noqa: BLE001
        return {
            "delivered": False,
            "channel": "smtp-error",
            "detail": f"{type(err).__name__}: {err}",
        }
