"""Advanced SEO — meta tags, Open Graph, Twitter, JSON-LD, sitemap, robots."""

from __future__ import annotations

import html
import json
import os
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin

from ross_ai import __version__
from ross_ai.brand import (
    APP_FULL_NAME,
    APP_NAME,
    APPLICATION_CATEGORY,
    COMPANY,
    COMPANY_LEGAL,
    DESCRIPTION,
    KEYWORDS,
    LOCALE,
    LONG_DESCRIPTION,
    PRIMARY_COLOR,
    SUPPORT_EMAIL,
    TAGLINE,
    THEME_COLOR,
    TWITTER_HANDLE,
)


def public_base_url() -> str:
    return (os.environ.get("ROSS_PUBLIC_URL") or "http://127.0.0.1:8787").rstrip("/")


def abs_url(path: str) -> str:
    return urljoin(public_base_url() + "/", path.lstrip("/"))


def esc(value: Any) -> str:
    return html.escape("" if value is None else str(value), quote=True)


# Public routes intended for indexing
PUBLIC_ROUTES: list[dict[str, Any]] = [
    {"path": "/", "changefreq": "weekly", "priority": "1.0", "title": f"{APP_NAME} — {APP_FULL_NAME}"},
    {"path": "/marketplace", "changefreq": "weekly", "priority": "0.9", "title": f"Membership Marketplace · {APP_NAME}"},
    {"path": "/legal", "changefreq": "monthly", "priority": "0.7", "title": f"Policy & Disclosures · {APP_NAME}"},
    {"path": "/signup", "changefreq": "monthly", "priority": "0.8", "title": f"Create Account · {APP_NAME}"},
    {"path": "/signin", "changefreq": "monthly", "priority": "0.6", "title": f"Sign In · {APP_NAME}"},
]


def page_seo(
    *,
    title: str,
    description: str | None = None,
    path: str = "/",
    index: bool = True,
    og_type: str = "website",
    image_path: str = "/static/og-default.svg",
    breadcrumbs: list[tuple[str, str]] | None = None,
) -> dict[str, Any]:
    desc = description or DESCRIPTION
    canonical = abs_url(path)
    return {
        "title": title,
        "description": desc,
        "canonical": canonical,
        "path": path,
        "index": index,
        "robots": "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
        if index
        else "noindex,nofollow",
        "ogType": og_type,
        "image": abs_url(image_path),
        "locale": LOCALE,
        "keywords": ", ".join(KEYWORDS),
        "breadcrumbs": breadcrumbs or [("Home", "/")],
    }


def render_head(seo: dict[str, Any]) -> str:
    title = esc(seo.get("title") or APP_FULL_NAME)
    desc = esc(seo.get("description") or DESCRIPTION)
    canonical = esc(seo.get("canonical") or abs_url("/"))
    robots = esc(seo.get("robots") or "index,follow")
    image = esc(seo.get("image") or abs_url("/static/og-default.svg"))
    keywords = esc(seo.get("keywords") or ", ".join(KEYWORDS))
    og_type = esc(seo.get("ogType") or "website")
    locale = esc(seo.get("locale") or LOCALE)
    site_name = esc(APP_FULL_NAME)
    json_ld = structured_data(seo)

    return f"""
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <meta name="description" content="{desc}" />
  <meta name="keywords" content="{keywords}" />
  <meta name="author" content="{esc(COMPANY_LEGAL)}" />
  <meta name="application-name" content="{esc(APP_NAME)}" />
  <meta name="apple-mobile-web-app-title" content="{esc(APP_NAME)}" />
  <meta name="theme-color" content="{esc(THEME_COLOR)}" />
  <meta name="color-scheme" content="dark" />
  <meta name="robots" content="{robots}" />
  <meta name="googlebot" content="{robots}" />
  <meta name="bingbot" content="{robots}" />
  <meta name="rating" content="general" />
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <link rel="canonical" href="{canonical}" />
  <link rel="alternate" hreflang="en" href="{canonical}" />
  <link rel="alternate" hreflang="x-default" href="{canonical}" />

  <!-- Open Graph -->
  <meta property="og:site_name" content="{site_name}" />
  <meta property="og:locale" content="{locale}" />
  <meta property="og:type" content="{og_type}" />
  <meta property="og:title" content="{title}" />
  <meta property="og:description" content="{desc}" />
  <meta property="og:url" content="{canonical}" />
  <meta property="og:image" content="{image}" />
  <meta property="og:image:alt" content="{esc(APP_FULL_NAME)} — {esc(TAGLINE)}" />
  <meta property="og:image:type" content="image/svg+xml" />

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="{esc(TWITTER_HANDLE)}" />
  <meta name="twitter:creator" content="{esc(TWITTER_HANDLE)}" />
  <meta name="twitter:title" content="{title}" />
  <meta name="twitter:description" content="{desc}" />
  <meta name="twitter:image" content="{image}" />
  <meta name="twitter:image:alt" content="{esc(APP_FULL_NAME)}" />

  <!-- Discovery / crawlers -->
  <link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap.xml" />
  <meta name="format-detection" content="telephone=no" />
  <meta name="geo.region" content="US" />
  <meta name="language" content="English" />
  <meta name="revisit-after" content="7 days" />
  <meta name="distribution" content="global" />
  <meta name="coverage" content="Worldwide" />
  <meta name="target" content="all" />
  <meta name="HandheldFriendly" content="true" />
  <meta name="MobileOptimized" content="320" />

  <!-- Icons & PWA presence -->
  <link rel="icon" href="/static/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/static/favicon.svg" />
  <link rel="manifest" href="/site.webmanifest" />
  <meta name="msapplication-TileColor" content="{esc(PRIMARY_COLOR)}" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />

  <link rel="stylesheet" href="/static/app.css" />
  <script type="application/ld+json">{json_ld}</script>
""".strip()


def structured_data(seo: dict[str, Any]) -> str:
    base = public_base_url()
    org = {
        "@type": "Organization",
        "@id": f"{base}/#organization",
        "name": COMPANY,
        "legalName": COMPANY_LEGAL,
        "url": base,
        "email": SUPPORT_EMAIL,
        "logo": abs_url("/static/favicon.svg"),
        "sameAs": [
            "https://github.com/ceortpsc",
        ],
        "brand": {
            "@type": "Brand",
            "name": APP_NAME,
            "slogan": TAGLINE,
        },
    }
    website = {
        "@type": "WebSite",
        "@id": f"{base}/#website",
        "url": base,
        "name": APP_FULL_NAME,
        "alternateName": [APP_NAME, "Ross Runtime", COMPANY],
        "description": DESCRIPTION,
        "publisher": {"@id": f"{base}/#organization"},
        "inLanguage": "en-US",
        "potentialAction": {
            "@type": "SearchAction",
            "target": f"{base}/marketplace?q={{search_term_string}}",
            "query-input": "required name=search_term_string",
        },
    }
    software = {
        "@type": "SoftwareApplication",
        "@id": f"{base}/#software",
        "name": APP_FULL_NAME,
        "alternateName": APP_NAME,
        "applicationCategory": APPLICATION_CATEGORY,
        "operatingSystem": "Web, Linux, macOS, Windows",
        "softwareVersion": __version__,
        "description": LONG_DESCRIPTION,
        "url": base,
        "image": abs_url("/static/og-default.svg"),
        "author": {"@id": f"{base}/#organization"},
        "publisher": {"@id": f"{base}/#organization"},
        "offers": {
            "@type": "AggregateOffer",
            "priceCurrency": "USD",
            "lowPrice": "149",
            "highPrice": "2499",
            "offerCount": "4",
            "url": abs_url("/marketplace"),
        },
        "featureList": [
            "Command package (.rpkg) builds",
            "Operator control plane",
            "Membership tiers and autopay",
            "MFA / 2FA and GitHub sign-in",
            "Strict RBAC",
            "Transparent code execution",
        ],
    }
    page = {
        "@type": "WebPage",
        "@id": f"{seo.get('canonical')}#webpage",
        "url": seo.get("canonical"),
        "name": seo.get("title"),
        "description": seo.get("description"),
        "isPartOf": {"@id": f"{base}/#website"},
        "about": {"@id": f"{base}/#software"},
        "inLanguage": "en-US",
    }
    crumbs = seo.get("breadcrumbs") or [("Home", "/")]
    breadcrumb = {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": i + 1,
                "name": name,
                "item": abs_url(path),
            }
            for i, (name, path) in enumerate(crumbs)
        ],
    }
    graph = {
        "@context": "https://schema.org",
        "@graph": [org, website, software, page, breadcrumb],
    }
    # Compact JSON for script tag (escape </ to be safe in HTML)
    raw = json.dumps(graph, separators=(",", ":"), ensure_ascii=True)
    return raw.replace("<", "\\u003c")


def robots_txt() -> str:
    base = public_base_url()
    return (
        "User-agent: *\n"
        "Allow: /\n"
        "Allow: /marketplace\n"
        "Allow: /legal\n"
        "Allow: /signup\n"
        "Allow: /signin\n"
        "Allow: /static/\n"
        "Allow: /site.webmanifest\n"
        "Allow: /sitemap.xml\n"
        "Disallow: /dashboard\n"
        "Disallow: /billing\n"
        "Disallow: /users\n"
        "Disallow: /rbac\n"
        "Disallow: /execute\n"
        "Disallow: /membership\n"
        "Disallow: /payment\n"
        "Disallow: /verify-email\n"
        "Disallow: /set-password\n"
        "Disallow: /setup-mfa\n"
        "Disallow: /mfa\n"
        "Disallow: /api/\n"
        "Disallow: /auth/\n"
        "Disallow: /workspace/\n"
        f"Sitemap: {base}/sitemap.xml\n"
        f"Host: {base.replace('https://', '').replace('http://', '')}\n"
    )


def sitemap_xml() -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    urls = []
    for route in PUBLIC_ROUTES:
        loc = abs_url(route["path"])
        urls.append(
            "  <url>\n"
            f"    <loc>{esc(loc)}</loc>\n"
            f"    <lastmod>{now}</lastmod>\n"
            f"    <changefreq>{esc(route['changefreq'])}</changefreq>\n"
            f"    <priority>{esc(route['priority'])}</priority>\n"
            "  </url>"
        )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )


def webmanifest() -> dict[str, Any]:
    return {
        "name": APP_FULL_NAME,
        "short_name": APP_NAME,
        "description": DESCRIPTION,
        "start_url": "/",
        "display": "standalone",
        "background_color": THEME_COLOR,
        "theme_color": THEME_COLOR,
        "lang": "en-US",
        "categories": ["business", "finance", "productivity"],
        "icons": [
            {
                "src": "/static/favicon.svg",
                "sizes": "any",
                "type": "image/svg+xml",
                "purpose": "any maskable",
            }
        ],
    }
