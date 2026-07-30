// XHTML document shell for the web portal. Output is well-formed XML served as
// application/xhtml+xml. All dynamic text must pass through esc(); scripts and
// JSON-LD are externalized or CDATA-wrapped so the XML stays well-formed.

import { SITE, NAV, baseUrl } from './content.mjs';

/** Escape text for XML/XHTML text nodes and attribute values. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Build a safe attribute string from a plain object. */
export function attrs(map = {}) {
  return Object.entries(map)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => (value === true ? `${key}="${key}"` : `${key}="${esc(value)}"`))
    .join(' ');
}

function navMarkup(activePath) {
  const links = NAV.map((item) => {
    const current = item.path === activePath;
    const cls = current ? 'nav-link active' : 'nav-link';
    return `<a class="${cls}" href="${esc(item.path)}"${current ? ' aria-current="page"' : ''}>${esc(item.label)}</a>`;
  }).join('\n          ');

  return `<nav class="site-nav" aria-label="Primary">
          ${links}
        </nav>`;
}

function jsonLd(canonical) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: `${SITE.name} — ${SITE.product}`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: canonical,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
  };
  // CDATA keeps JSON (which may contain reserved chars) well-formed inside XHTML.
  return `<script type="application/ld+json">/*<![CDATA[*/${JSON.stringify(data)}/*]]>*/</script>`;
}

/**
 * Render a complete XHTML document.
 * @param {object} page
 * @param {string} page.title
 * @param {string} page.description
 * @param {string} page.body        Pre-rendered XHTML markup for <main>.
 * @param {string} page.activePath  Current route (for nav highlighting).
 * @param {object} [config]         Runtime config (for base URL).
 */
export function renderDocument(page, config = {}) {
  const canonical = `${baseUrl(config)}${page.activePath === '/' ? '' : page.activePath}`;
  const title = `${page.title} · ${SITE.short}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(page.description)}" />
    <link rel="canonical" href="${esc(canonical)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(page.description)}" />
    <meta property="og:type" content="website" />
    <link rel="icon" type="image/svg+xml" href="/rtp-design/assets/emblem.svg" />
    <link rel="stylesheet" href="/rtp-design/theme.css" />
    <link rel="stylesheet" href="/rtp-design/components.css" />
    <link rel="stylesheet" href="/rtp-design/shell.css" />
    <link rel="stylesheet" href="/static/styles.css" />
    <link rel="alternate" type="application/atom+xml" title="RTPSC updates" href="/feed.xml" />
    ${jsonLd(canonical)}
  </head>
  <body>
    <header class="topbar">
      <a class="brand" href="/">
        <span class="brand-mark">${esc(SITE.short)}</span>
        <span class="brand-sub">${esc(SITE.product)}</span>
      </a>
      <div class="top-right">
        ${navMarkup(page.activePath)}
        <a class="cta-btn" href="/register">Get started</a>
      </div>
    </header>
    <main class="wrap" id="main">
${page.body}
    </main>
    <footer class="site-footer">
      <div class="footer-inner">
        <span>${esc(SITE.name)} — ${esc(SITE.product)}</span>
        <span class="footer-links">
          <a href="/status">Status</a>
          <a href="/docs">Docs</a>
          <a href="/sitemap.xml">Sitemap</a>
          <a href="/feed.xml">Feed</a>
        </span>
      </div>
    </footer>
    <div id="toast" class="toast" role="status" aria-live="polite"></div>
    <script src="/rtp-design/shell.js" defer="defer"></script>
    <script src="/static/app.js" defer="defer"></script>
  </body>
</html>
`;
}
