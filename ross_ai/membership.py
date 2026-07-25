"""Membership tiers, election, and plan catalog (4 tiers)."""

from __future__ import annotations

from typing import Any

# Amounts are USD monthly list prices for display / invoicing stubs.
TIERS: dict[str, dict[str, Any]] = {
    "starter": {
        "id": "starter",
        "name": "Starter",
        "tagline": "Solo operators establishing a compliant foothold.",
        "priceMonthly": 149,
        "priceAnnual": 1490,
        "seats": 1,
        "highlight": False,
        "features": [
            "Operator console + WebSocket live feed",
            "Command packages (.rpkg) build & runtime",
            "Deploy plans for local and Docker",
            "Module inventory (read)",
            "Email support (72 business hours)",
        ],
        "limits": {
            "workspaces": 1,
            "deployTargets": ["local", "docker"],
            "apiCallsPerDay": 5_000,
            "auditRetentionDays": 30,
        },
        "explanation": (
            "Starter is for a single licensed operator who needs the Ross AI Runtime "
            "Platform control plane, package tooling, and foundational hardening without "
            "multi-seat collaboration or cloud deploy fabric. Ideal for evaluation and "
            "small practices that already hold required tax-software credentials elsewhere."
        ),
    },
    "professional": {
        "id": "professional",
        "name": "Professional",
        "tagline": "Growing practices with multi-seat ops and cloud plans.",
        "priceMonthly": 399,
        "priceAnnual": 3990,
        "seats": 5,
        "highlight": True,
        "features": [
            "Everything in Starter",
            "Up to 5 operator seats",
            "All eight deploy-plan targets",
            "Hardening posture dashboard",
            "Priority email support (24 business hours)",
            "Autopay with payment method on file",
        ],
        "limits": {
            "workspaces": 3,
            "deployTargets": [
                "local",
                "docker",
                "kubernetes",
                "aws-lambda",
                "aws-ecs",
                "azure-functions",
                "gcp-cloud-run",
                "edge-worker",
            ],
            "apiCallsPerDay": 50_000,
            "auditRetentionDays": 180,
        },
        "explanation": (
            "Professional unlocks collaborative operator seats, the full deploy-plan "
            "matrix, and autopay billing. Built for EROs and small firms that need "
            "governed runtime access, membership election, and payment-on-file continuity "
            "without enterprise contracting."
        ),
    },
    "firm": {
        "id": "firm",
        "name": "Firm",
        "tagline": "Multi-office firms with audit depth and SLA routing.",
        "priceMonthly": 899,
        "priceAnnual": 8990,
        "seats": 25,
        "highlight": False,
        "features": [
            "Everything in Professional",
            "Up to 25 operator seats",
            "Extended audit retention (365 days)",
            "Named technical contact",
            "Change-window coordination",
            "Marketplace add-on eligibility",
        ],
        "limits": {
            "workspaces": 10,
            "deployTargets": "all",
            "apiCallsPerDay": 250_000,
            "auditRetentionDays": 365,
        },
        "explanation": (
            "Firm is sized for multi-office tax practices that require deeper audit "
            "retention, named contacts, and coordinated change windows. Membership "
            "includes marketplace eligibility for optional modules while remaining under "
            "the platform's absolute zero-refund commercial terms."
        ),
    },
    "enterprise": {
        "id": "enterprise",
        "name": "Enterprise",
        "tagline": "Regulated estates needing custom controls and volume.",
        "priceMonthly": 2499,
        "priceAnnual": 24990,
        "seats": 100,
        "highlight": False,
        "features": [
            "Everything in Firm",
            "Up to 100 operator seats (expandable by order form)",
            "Custom hardening controls review",
            "Dedicated success channel",
            "Volume API ceilings by schedule",
            "Executive business reviews (quarterly)",
        ],
        "limits": {
            "workspaces": 50,
            "deployTargets": "all",
            "apiCallsPerDay": 2_000_000,
            "auditRetentionDays": 730,
        },
        "explanation": (
            "Enterprise serves regulated or high-volume estates that need custom control "
            "reviews, dedicated channels, and scheduled volume. Pricing shown is the "
            "standard list; executed order forms may adjust seats and ceilings. All "
            "Enterprise memberships remain subject to absolute zero refunds."
        ),
    },
}

TIER_ORDER = ("starter", "professional", "firm", "enterprise")


def list_tiers() -> list[dict[str, Any]]:
    return [TIERS[tid] for tid in TIER_ORDER]


def get_tier(tier_id: str) -> dict[str, Any] | None:
    return TIERS.get((tier_id or "").strip().lower())


def validate_tier_id(tier_id: str) -> bool:
    return (tier_id or "").strip().lower() in TIERS
