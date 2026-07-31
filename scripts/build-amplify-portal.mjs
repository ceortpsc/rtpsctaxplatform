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
    :root{--ink:#0b1220;--panel:#0f1724;--signal:#0a7ea4;--text:#e8eef6;--muted:#8b9aab}
    *{box-sizing:border-box}body{margin:0;background:radial-gradient(900px 480px at 82% 12%,rgba(26,155,199,.22),transparent 60%),linear-gradient(155deg,#0b1220,#123049 48%,#0a7ea4);color:var(--text);font:16px/1.55 "DM Sans",Avenir Next,Segoe UI,sans-serif;min-height:100vh;display:grid;place-items:center}
    main{width:min(920px,calc(100% - 32px));padding:48px;border:1px solid rgba(184,199,214,.25);border-radius:14px;background:rgba(15,23,36,.92)}
    .eyebrow{font-family:Syne,Bahnschrift,sans-serif;font-weight:800;letter-spacing:.08em;font-size:clamp(2.5rem,8vw,5rem);line-height:.95;color:#fff;margin:0 0 12px}.status{display:inline-block;padding:6px 10px;border:1px solid rgba(184,199,214,.3);border-radius:6px;color:var(--muted);font-size:.8rem;margin-bottom:12px}
    h1{font-family:Syne,Bahnschrift,sans-serif;font-size:clamp(1.4rem,3.5vw,2rem);line-height:1.15;margin:.2em 0 .5em;letter-spacing:-.02em;color:#d7eef7}.lede{font-size:1.05rem;color:var(--muted);max-width:58ch}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}
    a{display:inline-flex;align-items:center;padding:13px 18px;border-radius:6px;text-decoration:none;font-weight:700;min-height:44px}.primary{background:#fff;color:var(--ink)}.secondary{border:1px solid rgba(232,238,246,.35);color:var(--text)}
    .notice{margin-top:32px;padding:18px;border-left:3px solid var(--signal);background:rgba(10,126,164,.08);color:var(--muted)}
  </style>
</head>
<body>
<main>
  <p class="eyebrow">RTPSC</p>
  <span class="status">${escapeHtml(status)}</span>
  <h1>Signal Era Secure Access</h1>
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
