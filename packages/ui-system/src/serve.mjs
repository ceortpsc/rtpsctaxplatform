import path from 'node:path';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tryServeShared, CONTENT_TYPES as SHARED_TYPES } from './index.mjs';

export const UI_CONTENT_TYPES = {
  ...SHARED_TYPES,
  '.map': 'application/json'
};

/**
 * Serve a static file from a service public directory, falling back to
 * packages/ui-system/public for `/shared/*` assets.
 */
export async function servePublicOrShared(response, pathname, publicDir) {
  if (await tryServeShared(response, pathname)) return true;

  const cleaned = String(pathname || '/').split('?')[0].split('#')[0];
  const relative = cleaned === '/' ? 'index.html' : cleaned.replace(/^\//, '');
  if (relative.includes('..')) {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
    return true;
  }

  const filePath = path.join(publicDir, relative);
  if (!filePath.startsWith(publicDir) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    return false;
  }

  const ext = path.extname(filePath).toLowerCase();
  const type = UI_CONTENT_TYPES[ext] || 'application/octet-stream';
  response.writeHead(200, { 'content-type': type });
  createReadStream(filePath).pipe(response);
  return true;
}

export async function readPublicFile(publicDir, relativePath) {
  return readFile(path.join(publicDir, relativePath), 'utf8');
}

export function sendNotFoundPage(response, { title = 'Page not found', code = '404', homeHref = '/' } = {}) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} · RTPSC</title>
  <link rel="stylesheet" href="/shared/theme.css" />
  <link rel="stylesheet" href="/shared/shell.css" />
  <link rel="stylesheet" href="/shared/components.css" />
  <link rel="icon" href="/shared/brand/icons/favicon.svg" />
</head>
<body>
  <main class="state-page">
    <img src="/shared/illustrations/${code === '403' ? 'access-denied' : code === '503' ? 'service-unavailable' : 'empty-search'}.svg" alt="" />
    <div class="page-header__category">Error ${code}</div>
    <h1>${title}</h1>
    <p>This route is unavailable or the resource could not be found. Your session was not modified.</p>
    <div class="state-page__actions">
      <a class="btn btn--primary" href="${homeHref}">Return to workspace</a>
      <a class="btn btn--secondary" href="/#help">Contact support</a>
    </div>
    <p class="field__hint">Reference: RTPSC-${code}-${Date.now().toString(36).toUpperCase()}</p>
  </main>
</body>
</html>`;
  response.writeHead(Number(code) || 404, { 'content-type': 'text/html; charset=utf-8' });
  response.end(html);
  return true;
}

/**
 * Small design-system showcase for operator services that do not host the full hub.
 * Prefer redirecting modules-dashboard to `/#design` instead.
 */
export function sendDesignSystemPage(response, { serviceName = 'RTPSC', homeHref = '/' } = {}) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Design System · ${serviceName}</title>
  <link rel="stylesheet" href="/shared/theme.css" />
  <link rel="stylesheet" href="/shared/shell.css" />
  <link rel="stylesheet" href="/shared/components.css" />
  <link rel="icon" href="/shared/brand/icons/favicon.svg" />
</head>
<body>
  <main class="app-shell__content" style="max-width:960px;margin:0 auto;padding:var(--sp-8)">
    <header class="page-header">
      <nav class="page-header__crumbs" aria-label="Breadcrumb">
        <a href="${homeHref}">${serviceName}</a><span aria-hidden="true">/</span><span aria-current="page">Design System</span>
      </nav>
      <div class="page-header__category">Platform</div>
      <div class="page-header__row">
        <div class="page-header__titles">
          <h1 class="page-header__title">RTPSC Enterprise UI System</h1>
          <p class="page-header__desc">Shared theme, shell, and components served from <code>/shared/*</code>. Full showcase lives on the modules dashboard.</p>
        </div>
        <div class="page-header__actions">
          <a class="btn btn--secondary" href="${homeHref}">Back to workspace</a>
          <a class="btn btn--primary" href="http://localhost:3010/#design">Open full showcase</a>
        </div>
      </div>
    </header>
    <section class="panel" style="margin-bottom:var(--sp-6)">
      <h2 style="font-family:var(--font-display);margin:0 0 var(--sp-4)">Buttons</h2>
      <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2)">
        <button type="button" class="btn btn--primary">Primary</button>
        <button type="button" class="btn btn--secondary">Secondary</button>
        <button type="button" class="btn btn--tertiary">Tertiary</button>
        <button type="button" class="btn btn--destructive">Destructive</button>
      </div>
    </section>
    <section class="panel" style="margin-bottom:var(--sp-6)">
      <h2 style="font-family:var(--font-display);margin:0 0 var(--sp-4)">Status badges</h2>
      <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2)">
        <span class="badge badge--success">Approved</span>
        <span class="badge badge--warning">Pending</span>
        <span class="badge badge--danger">Rejected</span>
        <span class="badge badge--info">Submitted</span>
        <span class="badge badge--neutral">Draft</span>
      </div>
    </section>
    <section class="panel" style="margin-bottom:var(--sp-6)">
      <h2 style="font-family:var(--font-display);margin:0 0 var(--sp-4)">Form field</h2>
      <div class="field" style="max-width:320px">
        <label class="field__label" for="ds-demo">Client name</label>
        <input class="field__control" id="ds-demo" placeholder="Client legal name" />
        <div class="field__hint">Uses shared <code>.field</code> tokens.</div>
      </div>
    </section>
    <section class="alert alert--info">Shared assets: theme.css · shell.css · components.css · shell.js · brand marks.</section>
  </main>
</body>
</html>`;
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(html);
  return true;
}
