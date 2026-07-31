import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { ownershipPlan, resolveToken } from './ownership.mjs';
import { writeEvidenceReceipt } from './evidence.mjs';

export async function generateSeoAssets(root, config, { env = process.env } = {}) {
  const plan = ownershipPlan(config);
  const publicDir = path.join(root, config.output.publicDir);
  await mkdir(publicDir, { recursive: true });

  const googleMeta = resolveToken(plan.verification.googleMetaEnv, env) || 'PROVIDER_ISSUED_TOKEN';
  const bingMeta = resolveToken(plan.verification.bingMetaEnv, env) || 'PROVIDER_ISSUED_TOKEN';
  const indexNowKey =
    resolveToken(plan.verification.indexNowKeyEnv, env) ||
    createHash('sha256').update(randomBytes(32)).digest('hex').slice(0, 64);

  const urls = config.properties.map((p) => p.url.replace(/\/?$/, '/'));
  const primary = plan.primaryProperty;

  const head = `<!-- ROSS.CO Infinite SEO ownership head injection -->
<link rel="canonical" href="${config.brand.canonical}" />
<title>${escapeHtml(config.brand.title)}</title>
<meta name="description" content="${escapeHtml(config.brand.description)}" />
<meta name="google-site-verification" content="${escapeHtml(googleMeta)}" />
<meta name="msvalidate.01" content="${escapeHtml(bingMeta)}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeHtml(config.brand.title)}" />
<meta property="og:description" content="${escapeHtml(config.brand.description)}" />
<meta property="og:url" content="${escapeHtml(config.brand.canonical)}" />
<meta property="og:locale" content="${escapeHtml(config.brand.locale || 'en_US')}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(config.brand.title)}" />
<meta name="twitter:description" content="${escapeHtml(config.brand.description)}" />
<script type="application/ld+json">
${JSON.stringify(buildJsonLd(config), null, 2)}
</script>
`;

  const robots = `User-agent: *
Allow: /

Sitemap: https://${primary.host}/sitemap.xml
`;

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url}</loc>
    <changefreq>weekly</changefreq>
    <priority>${url === primary.url || url === `${primary.url}` ? '1.0' : '0.8'}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;

  const jsonld = `${JSON.stringify(buildJsonLd(config), null, 2)}\n`;
  const indexNowFile = `${indexNowKey}.txt`;

  const files = {
    'seo-head.html': head,
    'robots.txt': robots,
    'sitemap.xml': sitemap,
    'software-application.jsonld': jsonld,
    [indexNowFile]: `${indexNowKey}\n`
  };

  const written = [];
  for (const [name, body] of Object.entries(files)) {
    const outPath = path.join(publicDir, name);
    await writeFile(outPath, body, 'utf8');
    written.push(path.relative(root, outPath));
  }

  const receipt = await writeEvidenceReceipt(root, config.output.evidenceDir, 'seo-generate', {
    state: 'ASSERTED',
    owner: config.owner,
    files: written,
    indexNowKeyLocation: `https://${primary.host}/${indexNowFile}`,
    tokensPresent: {
      googleMeta: Boolean(resolveToken(plan.verification.googleMetaEnv, env)),
      bingMeta: Boolean(resolveToken(plan.verification.bingMetaEnv, env)),
      indexNow: Boolean(resolveToken(plan.verification.indexNowKeyEnv, env))
    }
  });

  return {
    publicDir: path.relative(root, publicDir),
    files: written,
    indexNowKey,
    receipt,
    plan
  };
}

function buildJsonLd(config) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: config.brand.title,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Linux, macOS, Windows',
    url: config.brand.canonical,
    description: config.brand.description,
    publisher: {
      '@type': 'Organization',
      name: config.owner.organization || config.owner.legalName,
      email: config.owner.contactEmail || undefined
    }
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
