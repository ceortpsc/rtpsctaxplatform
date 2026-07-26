import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from './config.mjs';
import { IP } from './ip.mjs';

export async function ensurePresenceSite(root) {
  const config = await loadConfig(root);
  const siteRoot = path.join(root, config.presence.siteRoot);
  await mkdir(siteRoot, { recursive: true });

  const indexPath = path.join(siteRoot, 'index.html');
  const cssPath = path.join(siteRoot, 'styles.css');
  const robotsPath = path.join(siteRoot, 'robots.txt');
  const sitemapPath = path.join(siteRoot, 'sitemap.xml');
  const ldPath = path.join(siteRoot, 'structured-data.json');

  await writeFile(indexPath, renderLandingHtml(config));
  await writeFile(cssPath, renderCss());
  await writeFile(robotsPath, `User-agent: *\nAllow: /\nSitemap: https://${config.brand.domain}/sitemap.xml\n`);
  await writeFile(
    sitemapPath,
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `  <url><loc>https://${config.brand.domain}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n` +
      `</urlset>\n`
  );
  await writeFile(
    ldPath,
    `${JSON.stringify(
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: IP.productFull,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Node.js >=22',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        url: `https://${config.brand.domain}/`,
        author: { '@type': 'Organization', name: IP.copyrightHolder },
        description: config.presence.seo.description
      },
      null,
      2
    )}\n`
  );

  return {
    siteRoot: config.presence.siteRoot,
    files: ['index.html', 'styles.css', 'robots.txt', 'sitemap.xml', 'structured-data.json']
  };
}

export async function presenceStatus(root) {
  const config = await loadConfig(root);
  const siteRoot = path.join(root, config.presence.siteRoot);
  const required = ['index.html', 'robots.txt', 'sitemap.xml', 'structured-data.json'];
  const present = [];
  for (const file of required) {
    try {
      await access(path.join(siteRoot, file));
      present.push(file);
    } catch {
      // missing
    }
  }
  return {
    domain: config.brand.domain,
    siteRoot: config.presence.siteRoot,
    present,
    missing: required.filter((file) => !present.includes(file)),
    seo: config.presence.seo
  };
}

function renderLandingHtml(config) {
  const seo = config.presence.seo;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${seo.title}</title>
  <meta name="description" content="${seo.description}" />
  <link rel="canonical" href="${seo.canonical}" />
  <meta property="og:title" content="${seo.title}" />
  <meta property="og:description" content="${seo.description}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${seo.canonical}" />
  <!-- Fonts intentionally local/system stacks (no external runtime deps). -->
  <link rel="stylesheet" href="./styles.css" />
  <script type="application/ld+json" src="./structured-data.json"></script>
</head>
<body>
  <div class="glow" aria-hidden="true"></div>
  <header class="hero">
    <p class="mark">${config.brand.mark} ROSS.CO</p>
    <h1>Infinite Transfer Rate</h1>
    <p class="lede">${config.brand.tagline} Map, plan, scope, stage, test, validate, verify, register — then publish.</p>
    <div class="cta">
      <a href="#lifecycle">Lifecycle</a>
      <a class="ghost" href="#cli">CLI</a>
    </div>
  </header>
  <main>
    <section id="lifecycle">
      <h2>Core lifecycle</h2>
      <ol>
        ${(config.lifecycle.stages || []).map((stage) => `<li>${stage}</li>`).join('\n        ')}
      </ol>
    </section>
    <section id="cli">
      <h2>Prototype CLI</h2>
      <pre>./scripts/rossco install
./scripts/rossco lifecycle
./scripts/rossco transfer
./scripts/rossco register
./scripts/rossco presence
./scripts/rossco seo</pre>
    </section>
  </main>
  <footer>
    <p>© ${config.copyright.year} ${config.copyright.holder}. ${IP.productFull}.</p>
  </footer>
</body>
</html>
`;
}

function renderCss() {
  return `:root {
  --bg: #061018;
  --ink: #e8f4ff;
  --muted: #8fb0c8;
  --accent: #3de0c5;
  --hot: #ffb703;
  --display: "Avenir Next", "Segoe UI", "Helvetica Neue", sans-serif;
  --mono: "SFMono-Regular", "Menlo", "Consolas", "Liberation Mono", monospace;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: var(--mono);
  color: var(--ink);
  background: var(--bg);
}
.glow {
  position: fixed; inset: 0; z-index: -1;
  background:
    radial-gradient(900px 500px at 20% 0%, rgba(61,224,197,.18), transparent 60%),
    radial-gradient(700px 400px at 90% 20%, rgba(255,183,3,.12), transparent 55%),
    linear-gradient(160deg, #061018, #0b2433 50%, #07151f);
}
.hero {
  min-height: 100vh;
  padding: 2rem clamp(1.2rem, 4vw, 4rem);
  display: flex; flex-direction: column; justify-content: center;
}
.mark {
  font-family: var(--display);
  letter-spacing: .18em;
  color: var(--hot);
  font-size: .85rem;
}
h1 {
  font-family: var(--display);
  font-size: clamp(3rem, 10vw, 6.5rem);
  line-height: .95;
  margin: .4rem 0 1rem;
  max-width: 12ch;
}
.lede { color: var(--muted); max-width: 36rem; font-size: 1.05rem; line-height: 1.55; }
.cta { display: flex; gap: .75rem; margin-top: 1.5rem; flex-wrap: wrap; }
.cta a {
  color: #041016; background: var(--accent); text-decoration: none;
  padding: .85rem 1.1rem; font-weight: 700;
}
.cta a.ghost { background: transparent; color: var(--ink); border: 1px solid rgba(232,244,255,.25); }
main { padding: 3rem clamp(1.2rem, 4vw, 4rem) 5rem; }
h2 { font-family: var(--display); font-size: 2rem; }
ol { color: var(--muted); line-height: 1.8; }
pre {
  background: rgba(0,0,0,.35);
  border: 1px solid rgba(255,255,255,.08);
  padding: 1rem; overflow: auto; color: #c6ffe9;
}
footer { padding: 1.5rem clamp(1.2rem, 4vw, 4rem) 2.5rem; color: var(--muted); font-size: .85rem; border-top: 1px solid rgba(255,255,255,.06); }
`;
}
