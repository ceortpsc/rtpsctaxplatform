"""Legal copy — rules, regulations, policy, disclaimers, disclosures.

ZERO REFUNDS: Absolute. No exceptions. No chargebacks courtesy credits.
"""

from __future__ import annotations

from typing import Any

ZERO_REFUND_BANNER = (
    "ZERO REFUNDS — ABSOLUTELY ZERO. All fees, membership dues, tier upgrades, "
    "and autopay charges are final upon authorization. No refunds, no prorations "
    "for convenience, no credits for unused seats, and no exceptions."
)

SECTIONS: dict[str, dict[str, Any]] = {
    "rules": {
        "id": "rules",
        "title": "Platform Rules",
        "summary": "Operator conduct and acceptable use for the Ross Tax Pro Software Co | RunTime AI Assist.",
        "body": [
            "Operators must authenticate with individual credentials; shared passwords are prohibited.",
            "Use is limited to lawful tax-practice operations and approved integration patterns only.",
            "Scraping, unauthorized IRS or non-public channel access, and credential stuffing are forbidden.",
            "Operators must not attempt to bypass rate limits, CSRF controls, or session hardening.",
            "Membership election and payment method on file are required before console access beyond public landing pages.",
            ZERO_REFUND_BANNER,
        ],
    },
    "regulations": {
        "id": "regulations",
        "title": "Regulations Alignment",
        "summary": "Regulatory posture statements for commercial use of the platform scaffold.",
        "body": [
            "Customers remain solely responsible for IRS, state, and professional licensing compliance.",
            "The platform provides tooling and control-plane scaffolding; it does not constitute legal, tax, or filing advice.",
            "Transmission to tax authorities requires separately approved credentials, certificates, and operating procedures.",
            "Data handling must follow the customer's written information security program and applicable privacy laws.",
            "Export controls and sanctions screening remain the customer's obligation for any cross-border use.",
            ZERO_REFUND_BANNER,
        ],
    },
    "policy": {
        "id": "policy",
        "title": "Commercial & Membership Policy",
        "summary": "Billing, tiers, autopay, and absolute zero-refund commercial policy.",
        "body": [
            "Four membership tiers are offered: Starter, Professional, Firm, and Enterprise.",
            "Membership begins when account creation completes with a selected tier and a payment method on file.",
            "Autopay charges the payment method on file for the selected billing cadence (monthly or annual).",
            "Failed autopay may suspend operator access until a valid payment method is restored.",
            "Tier changes apply prospectively; upgrades bill the delta immediately; downgrades apply at next renewal.",
            ZERO_REFUND_BANNER,
            "By creating an account you irrevocably waive any claim for refund, chargeback, or equitable credit related to membership fees.",
        ],
    },
    "disclaimers": {
        "id": "disclaimers",
        "title": "Disclaimers",
        "summary": "No warranties; scaffold and demo payment surfaces.",
        "body": [
            "THE PLATFORM IS PROVIDED AS-IS WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.",
            "Ross Tax Pro Software Co does not warrant uninterrupted availability, error-free operation, or fitness for a particular purpose.",
            "Payment method capture in this control plane is a tokenized scaffold; production card processing requires an approved processor integration.",
            "Dashboard metrics and inventory reflect local monorepo state and operator activity — not tax-authority acknowledgements.",
            "No outcome regarding refunds, transcripts, or filings is guaranteed by use of this software.",
            ZERO_REFUND_BANNER,
        ],
    },
    "disclosures": {
        "id": "disclosures",
        "title": "Disclosures",
        "summary": "Material disclosures presented at membership election and payment selection.",
        "body": [
            "You authorize Ross Tax Pro Software Co (or its processor) to store a payment method on file for membership dues.",
            "You authorize recurring autopay charges for your elected tier until you cancel prospectively per policy.",
            "Cancellation stops future renewals only; it does not entitle you to any refund of amounts already charged.",
            "Displayed prices are USD list prices and exclude applicable taxes unless stated on an order form.",
            "Enterprise terms may be supplemented by a signed order form; zero-refund terms still apply unless a signed amendment expressly states otherwise (none are granted by default).",
            ZERO_REFUND_BANNER,
        ],
    },
}


def all_sections() -> list[dict[str, Any]]:
    return [SECTIONS[k] for k in ("rules", "regulations", "policy", "disclaimers", "disclosures")]


def get_section(section_id: str) -> dict[str, Any] | None:
    return SECTIONS.get((section_id or "").strip().lower())


def acceptance_checklist() -> list[str]:
    return [
        "I have read the Platform Rules, Regulations, Policy, Disclaimers, and Disclosures.",
        "I elect a membership tier and authorize a payment method on file for autopay.",
        "I understand and agree: ZERO REFUNDS — ABSOLUTELY ZERO — no exceptions.",
        "I will not file chargebacks for membership fees; disputes must follow the commercial policy.",
    ]
