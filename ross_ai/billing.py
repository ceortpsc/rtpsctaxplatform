"""Billing — payment method on file and autopay (tokenized scaffold)."""

from __future__ import annotations

import hashlib
import re
import secrets
import time
from typing import Any

from ross_ai.membership import get_tier
from ross_ai.store import JsonStore

# Never store raw PAN. We accept demo card input, tokenize, keep last4/brand/exp only.
BRAND_PREFIXES = (
    ("4", "visa"),
    ("5", "mastercard"),
    ("3", "amex"),
    ("6", "discover"),
)


def _brand_for(number: str) -> str:
    for prefix, brand in BRAND_PREFIXES:
        if number.startswith(prefix):
            return brand
    return "card"


def _luhn_ok(number: str) -> bool:
    digits = [int(c) for c in number if c.isdigit()]
    if len(digits) < 13:
        return False
    checksum = 0
    parity = len(digits) % 2
    for i, d in enumerate(digits):
        if i % 2 == parity:
            d *= 2
            if d > 9:
                d -= 9
        checksum += d
    return checksum % 10 == 0


def tokenize_card(
    *,
    number: str,
    exp_month: str,
    exp_year: str,
    cvc: str,
    name: str,
    zip_code: str = "",
) -> tuple[bool, str, dict[str, Any] | None]:
    pan = re.sub(r"\D", "", number or "")
    cvc_digits = re.sub(r"\D", "", cvc or "")
    month = re.sub(r"\D", "", exp_month or "")
    year = re.sub(r"\D", "", exp_year or "")

    if not _luhn_ok(pan):
        return False, "Enter a valid card number.", None
    if not (1 <= int(month or 0) <= 12):
        return False, "Enter a valid expiration month (01–12).", None
    if len(year) == 2:
        year = "20" + year
    if len(year) != 4:
        return False, "Enter a valid expiration year.", None
    if len(cvc_digits) < 3 or len(cvc_digits) > 4:
        return False, "Enter a valid security code.", None
    if not (name or "").strip():
        return False, "Enter the name on the card.", None

    # Token = irreversible hash of PAN + random pepper fragment (demo vault).
    pepper = secrets.token_hex(8)
    token = "pm_" + hashlib.sha256(f"{pan}:{pepper}".encode()).hexdigest()[:28]
    method = {
        "id": token,
        "brand": _brand_for(pan),
        "last4": pan[-4:],
        "expMonth": month.zfill(2),
        "expYear": year,
        "name": name.strip(),
        "zip": (zip_code or "").strip(),
        "createdAt": time.time(),
        # Explicitly no raw PAN / CVC retained
    }
    return True, "Payment method tokenized.", method


class BillingService:
    def __init__(self, store: JsonStore) -> None:
        self.store = store

    def attach_membership(
        self,
        email: str,
        *,
        tier_id: str,
        cadence: str,
        autopay: bool,
        payment_method: dict[str, Any],
        zero_refund_accepted: bool,
        disclosures_accepted: bool,
    ) -> tuple[bool, str]:
        if not zero_refund_accepted or not disclosures_accepted:
            return False, "You must accept disclosures and the absolute zero-refund policy."
        tier = get_tier(tier_id)
        if not tier:
            return False, "Select a valid membership tier."
        cadence_n = (cadence or "monthly").strip().lower()
        if cadence_n not in {"monthly", "annual"}:
            return False, "Select monthly or annual billing."

        amount = tier["priceAnnual"] if cadence_n == "annual" else tier["priceMonthly"]

        def mutate(data: dict[str, Any]) -> None:
            users = data.setdefault("users", {})
            user = users.get(email)
            if not user:
                raise KeyError(email)
            user["membership"] = {
                "tierId": tier["id"],
                "tierName": tier["name"],
                "cadence": cadence_n,
                "amount": amount,
                "currency": "USD",
                "autopay": bool(autopay),
                "status": "active",
                "electedAt": time.time(),
                "zeroRefundAccepted": True,
                "disclosuresAccepted": True,
            }
            user["paymentMethod"] = payment_method
            data.setdefault("audit", []).append(
                {
                    "at": time.time(),
                    "action": "membership.elect",
                    "email": email,
                    "tierId": tier["id"],
                    "cadence": cadence_n,
                    "autopay": bool(autopay),
                    "amount": amount,
                    "last4": payment_method.get("last4"),
                }
            )
            data.setdefault("charges", []).append(
                {
                    "at": time.time(),
                    "email": email,
                    "tierId": tier["id"],
                    "amount": amount,
                    "currency": "USD",
                    "status": "captured",
                    "refundable": False,
                    "refundPolicy": "ZERO_REFUNDS_ABSOLUTE",
                    "paymentMethodId": payment_method.get("id"),
                    "last4": payment_method.get("last4"),
                }
            )

        try:
            self.store.update(mutate)
        except KeyError:
            return False, "Account not found."
        return True, "Membership activated. Payment captured. Zero refunds apply."

    def membership_for(self, email: str) -> dict[str, Any] | None:
        user = (self.store.get().get("users") or {}).get(email)
        if not user:
            return None
        return user.get("membership")

    def payment_method_for(self, email: str) -> dict[str, Any] | None:
        user = (self.store.get().get("users") or {}).get(email)
        if not user:
            return None
        return user.get("paymentMethod")

    def charges_for(self, email: str) -> list[dict[str, Any]]:
        return [c for c in (self.store.get().get("charges") or []) if c.get("email") == email]

    def list_members(self) -> list[dict[str, Any]]:
        out = []
        for email, user in (self.store.get().get("users") or {}).items():
            mem = user.get("membership") or {}
            pm = user.get("paymentMethod") or {}
            out.append(
                {
                    "email": email,
                    "name": user.get("name"),
                    "role": user.get("role"),
                    "tierId": mem.get("tierId"),
                    "tierName": mem.get("tierName"),
                    "cadence": mem.get("cadence"),
                    "autopay": mem.get("autopay"),
                    "status": mem.get("status"),
                    "last4": pm.get("last4"),
                    "brand": pm.get("brand"),
                }
            )
        return sorted(out, key=lambda r: r.get("email") or "")
