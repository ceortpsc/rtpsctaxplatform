import { ensurePresenceSite, presenceStatus } from './presence.mjs';
import { loadConfig } from './config.mjs';
import { runCli as runInfiniteCli } from '../../ross-infinite/src/cli.mjs';

/** Legacy presence SEO emit used by `rossco seo` with no subcommand. */
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

/**
 * Ownership control-plane subcommands delegate to ROSS.CO Infinite.
 * Usage: rossco seo plan|generate|prevalidate|google|indexnow ...
 */
export async function runSeoOwnership(argv) {
  return runInfiniteCli(['seo', ...argv]);
}
