// XHTML document shell for the web portal. Dynamic text must pass through esc().

import { SITE, NAV, baseUrl } from './content.mjs';

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function attrs(map = {}) {
  return Object.entries(map)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => (value === true ? `${key}="${key}"` : `${key}="${esc(value)}"`))
    .join(' ');
}

function navMarkup(activePath) {
  return NAV.map((item) => {
    const current = item.path === activePath;
    return `<a class="${current ? 'nav-link active' : 'nav-link'}" href="${esc(item.path)}"${current ? ' aria-current="page"' : ''}>${esc(item.label)}</a>`;
  }).join('\n          ');
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
  return `<script type="application/ld+json">/*<![CDATA[*/${JSON.stringify(data)}/*]]>*/</script>`;
}

function accessMarkup(page) {
  if (page.session?.ok) {
    return `<a class="cta-btn" href="/account">Open workspace</a>`;
  }
  if (page.auth?.enabled) {
    if (!page.auth.configured) return `<span class="status blocked">Identity configuration required</span>`;
    return `<a class="cta-btn" href="/auth/login?next=%2Faccount">Secure sign in</a>`;
  }
  return `<a class="cta-btn" href="/register">Get started</a>`;
}

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
    <link rel="icon" type="image/svg+xml" href="/rtp-design/brand/logos/rtpsc-monogram.svg" />
    <link rel="icon" type="image/png" sizes="32x32" href="/rtp-design/brand/logos/rtpsc-favicon.png" />
    <link rel="shortcut icon" href="/rtp-design/brand/logos/rtpsc-favicon.ico" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&amp;family=IBM+Plex+Mono:wght@400;500;600&amp;family=Syne:wght@600;700;800&amp;display=swap" />
    <link rel="stylesheet" href="/rtp-design/theme.css" />
    <link rel="stylesheet" href="/rtp-design/components.css" />
    <link rel="stylesheet" href="/rtp-design/shell.css" />
    <link rel="stylesheet" href="/rtp-design/brand/brand.css" />
    <link rel="stylesheet" href="/static/styles.css" />
    <link rel="alternate" type="application/atom+xml" title="RTPSC updates" href="/feed.xml" />
    ${jsonLd(canonical)}
  </head>
  <body>
    <header class="topbar">
      <a class="brand" href="/"><span class="brand-mark">${esc(SITE.short)}</span><span class="brand-sub">${esc(SITE.product)}</span></a>
      <div class="top-right"><nav class="site-nav" aria-label="Primary">${navMarkup(page.activePath)}</nav>${accessMarkup(page)}</div>
    </header>
    <main class="wrap" id="main">
${page.body}
    </main>
    <footer class="site-footer">
      <div class="footer-inner">
        <span>${esc(SITE.name)} — ${esc(SITE.product)}</span>
        <span class="footer-links"><a href="/status">Status</a><a href="/docs">Docs</a><a href="/sitemap.xml">Sitemap</a><a href="/feed.xml">Feed</a></span>
      </div>
    </footer>
    <div id="toast" class="toast" role="status" aria-live="polite"></div>
    <script src="/rtp-design/shell.js" defer="defer"></script>
    <script src="/static/app.js" defer="defer"></script>
  </body>
</html>
`;
}
