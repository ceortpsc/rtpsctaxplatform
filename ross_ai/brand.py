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
VERSION = "02.0V"
RELEASE = "Ross Tax Pro Software Co 02.0V"
TAGLINE = "The hierarchy of enterprise-grade tax pro software."
DESCRIPTION = (
    "Ross Tax Pro Software Co 02.0V — the hierarchy of enterprise-grade tax pro software. "
    "RunTime AI Assist is the hardened operator control plane for command package "
    "development, membership, deploy plans, RBAC, and transparent script execution."
)
LONG_DESCRIPTION = (
    "Ross Tax Pro Software Co 02.0V sits at the hierarchy of enterprise-grade tax pro software. "
    "RunTime AI Assist gives tax-software operators a branded control plane to build "
    ".rpkg command packages, elect membership tiers, run deploy plans, enforce MFA and "
    "RBAC, and execute personal scripts with full audit transparency — without scraping "
    "or unapproved channels."
)
KEYWORDS = [
    "RunTime AI Assist",
    "Ross Tax Pro Software Co",
    "Ross Tax Pro Software Co 02.0V",
    "Ross Tax Pro Software Co | RunTime AI Assist",
    "RunTime",
    "02.0V",
    "enterprise tax software",
    "enterprise-grade tax pro software",
    "tax software hierarchy",
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
PRIMARY_COLOR = "#1f6f54"
THEME_COLOR = "#0b1612"


def brand_dict() -> dict[str, Any]:
    return {
        "appName": APP_NAME,
        "fullName": APP_FULL_NAME,
        "shortName": APP_SHORT_NAME,
        "company": COMPANY,
        "companyLegal": COMPANY_LEGAL,
        "version": VERSION,
        "release": RELEASE,
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
