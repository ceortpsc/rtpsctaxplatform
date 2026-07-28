// XML surface generators (sitemap, Atom feed, OpenSearch, robots). All output is
// well-formed XML; text is escaped for XML.

import { SITE, baseUrl } from './content.mjs';

function escXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** XML sitemap from the router's page list. */
export function renderSitemap(routes, config = {}) {
  const base = baseUrl(config);
  const urls = routes
    .map(
      (route) => `  <url>
    <loc>${escXml(base)}${escXml(route.route === '/' ? '' : route.route)}</loc>
    <changefreq>weekly</changefreq>
  </url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/** Atom feed advertising the portal's pages. */
export function renderFeed(routes, config = {}) {
  const base = baseUrl(config);
  const updated = new Date().toISOString();
  const entries = routes
    .map(
      (route) => `  <entry>
    <title>${escXml(route.title)}</title>
    <link href="${escXml(base)}${escXml(route.route === '/' ? '' : route.route)}" />
    <id>${escXml(base)}${escXml(route.route === '/' ? '/home' : route.route)}</id>
    <updated>${escXml(updated)}</updated>
    <summary>${escXml(route.description)}</summary>
  </entry>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escXml(SITE.name)} — ${escXml(SITE.product)}</title>
  <link href="${escXml(base)}/" />
  <link rel="self" href="${escXml(base)}/feed.xml" />
  <id>${escXml(base)}/</id>
  <updated>${escXml(updated)}</updated>
${entries}
</feed>
`;
}

/** OpenSearch description document. */
export function renderOpenSearch(config = {}) {
  const base = baseUrl(config);
  return `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>${escXml(SITE.short)}</ShortName>
  <Description>${escXml(SITE.tagline)}</Description>
  <Url type="text/html" template="${escXml(base)}/platform" />
</OpenSearchDescription>
`;
}

/** robots.txt (plain text, not XML, but a machine surface). */
export function renderRobots(config = {}) {
  const base = baseUrl(config);
  return `User-agent: *
Allow: /
Sitemap: ${base}/sitemap.xml
`;
}
