"""Official product identity — name, presence, and market copy."""

from __future__ import annotations

from typing import Any

# Canonical product identity
# Full name: Ross Tax Pro Software Co | RunTime AI Assist
APP_NAME = "RunTime AI Assist"
APP_FULL_NAME = "Ross Tax Pro Software Co | RunTime AI Assist"
APP_SHORT_NAME = "RunTime"
COMPANY = "Ross Tax Pro Software Co"
COMPANY_LEGAL = "Ross Tax Pro Software Co"
TAGLINE = "Command packages. Live runtime. Governed control."
DESCRIPTION = (
    "RunTime AI Assist from Ross Tax Pro Software Co — "
    "a hardened operator control plane for command package development, "
    "membership, deploy plans, RBAC, and transparent script execution."
)
LONG_DESCRIPTION = (
    "Ross Tax Pro Software Co | RunTime AI Assist gives tax-software operators "
    "a branded control plane to build .rpkg command packages, elect membership "
    "tiers, run deploy plans, enforce MFA and RBAC, and execute personal scripts "
    "with full audit transparency — without scraping or unapproved channels."
)
KEYWORDS = [
    "RunTime AI Assist",
    "Ross Tax Pro Software Co",
    "Ross Tax Pro Software Co | RunTime AI Assist",
    "RunTime",
    "tax software platform",
    "command packages",
    "rpkg",
    "operator control plane",
    "tax practice runtime",
    "deploy plans",
    "RBAC tax software",
    "MFA tax platform",
    "transparent code execution",
]
CATEGORY = "BusinessApplication"
APPLICATION_CATEGORY = "FinanceApplication"
LOCALE = "en_US"
TWITTER_HANDLE = "@rosstaxsoftware"
SUPPORT_EMAIL = "support@rosstaxsoftware.com"
PRIMARY_COLOR = "#122044"
THEME_COLOR = "#0b1220"


def brand_dict() -> dict[str, Any]:
    return {
        "appName": APP_NAME,
        "fullName": APP_FULL_NAME,
        "shortName": APP_SHORT_NAME,
        "company": COMPANY,
        "companyLegal": COMPANY_LEGAL,
        "tagline": TAGLINE,
        "description": DESCRIPTION,
        "longDescription": LONG_DESCRIPTION,
        "keywords": KEYWORDS,
        "category": CATEGORY,
        "applicationCategory": APPLICATION_CATEGORY,
        "locale": LOCALE,
        "twitter": TWITTER_HANDLE,
        "supportEmail": SUPPORT_EMAIL,
        "primaryColor": PRIMARY_COLOR,
        "themeColor": THEME_COLOR,
    }
