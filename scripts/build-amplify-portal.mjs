import fs from 'node:fs';
import path from 'node:path';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function validateApiBase(value) {
  const raw = String(value ?? '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  let url;
  try { url = new URL(raw); }
  catch { throw new Error('PORTAL_API_BASE_URL must be a valid absolute URL.'); }
  if (url.protocol !== 'https:') throw new Error('PORTAL_API_BASE_URL must use HTTPS.');
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('PORTAL_API_BASE_URL cannot contain credentials, query parameters, or a fragment.');
  }
  return url.toString().replace(/\/+$/, '');
}

const outDir = path.resolve(process.cwd(), 'build', 'amplify-portal');
const apiBase = validateApiBase(process.env.PORTAL_API_BASE_URL);
const loginUrl = apiBase ? `${apiBase}/auth/login?next=%2Faccount` : '#configuration-required';
const importUrl = apiBase ? `${apiBase}/auth/login?next=%2Fclient-import` : '#configuration-required';
const status = apiBase ? 'READY_FOR_AUTHENTICATED_REDIRECT' : 'BLOCKED_CONFIGURATION_REQUIRED';

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Ross Tax Pro Software Co · Secure Portal</title>
  <style>
    :root{color-scheme:dark;--navy:#06162c;--panel:#0d2442;--gold:#d6ad45;--text:#f4f7fb;--muted:#a9b7ca}
    *{box-sizing:border-box}body{margin:0;background:linear-gradient(145deg,var(--navy),#020814);color:var(--text);font:16px/1.55 Arial,sans-serif;min-height:100vh;display:grid;place-items:center}
    main{width:min(920px,calc(100% - 32px));padding:48px;border:1px solid #294362;border-radius:24px;background:rgba(13,36,66,.94);box-shadow:0 24px 80px rgba(0,0,0,.35)}
    .eyebrow{color:var(--gold);font-weight:800;letter-spacing:.14em;text-transform:uppercase}.status{display:inline-block;padding:6px 10px;border:1px solid #526b88;border-radius:999px;color:var(--muted);font-size:.8rem}
    h1{font-size:clamp(2rem,6vw,4rem);line-height:1.05;margin:.35em 0}.lede{font-size:1.2rem;color:var(--muted);max-width:65ch}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}
    a{display:inline-block;padding:13px 18px;border-radius:10px;text-decoration:none;font-weight:800}.primary{background:var(--gold);color:#101820}.secondary{border:1px solid #526b88;color:var(--text)}
    .notice{margin-top:32px;padding:18px;border-left:4px solid var(--gold);background:#091b31;color:var(--muted)}
  </style>
</head>
<body>
<main>
  <p class="eyebrow">Ross Tax Pro Software Co</p>
  <span class="status">${escapeHtml(status)}</span>
  <h1>Sovereign Ledger Secure Access</h1>
  <p class="lede">Authentication is completed through the protected portal. Credentials, taxpayer records, EFIN documentation, and client imports are never collected on this static landing page.</p>
  <div class="actions">
    <a class="primary" href="${escapeHtml(loginUrl)}">Sign in to workspace</a>
    <a class="secondary" href="${escapeHtml(importUrl)}">Secure client import</a>
  </div>
  <div class="notice">Do not email or text Social Security numbers, tax returns, identity documents, banking data, or unencrypted software exports. ${apiBase ? 'Continue through the authenticated portal.' : 'Deployment is blocked until PORTAL_API_BASE_URL is configured.'}</div>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
fs.writeFileSync(path.join(outDir, '404.html'), html, 'utf8');
fs.writeFileSync(
  path.join(outDir, 'deployment.json'),
  `${JSON.stringify({ schemaVersion: '1.0', status, portalApiConfigured: Boolean(apiBase), generatedAt: new Date().toISOString() }, null, 2)}\n`,
  'utf8'
);
console.log(JSON.stringify({ ok: true, outDir, status }));

export const __testing = { escapeHtml, validateApiBase };
