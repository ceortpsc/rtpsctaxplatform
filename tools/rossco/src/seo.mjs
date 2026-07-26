import { ensurePresenceSite, presenceStatus } from './presence.mjs';
import { loadConfig } from './config.mjs';

export async function emitSeo(root) {
  const presence = await ensurePresenceSite(root);
  const status = await presenceStatus(root);
  const config = await loadConfig(root);

  return {
    stage: 'seo',
    domain: config.brand.domain,
    canonical: config.presence.seo.canonical,
    title: config.presence.seo.title,
    description: config.presence.seo.description,
    artifacts: presence.files.map((file) => `${presence.siteRoot}/${file}`),
    checklist: [
      'title + meta description',
      'canonical link',
      'Open Graph tags',
      'robots.txt Allow',
      'sitemap.xml',
      'JSON-LD SoftwareApplication'
    ],
    status
  };
}
