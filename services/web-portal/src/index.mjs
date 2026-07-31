import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createServiceDescriptor,
  evaluateEnvironmentProtection,
  loadRuntimeConfig,
  PLATFORM_IDENTITY,
  redactConfig,
  serveStaticFile,
  packageDir
} from '../../../packages/platform-core/src/index.mjs';
import { createDatabase } from '../../../packages/rtp-datastore/src/index.mjs';
import { createEfinRegistry, PROVIDER_TYPES } from '../../../packages/sri-efin/src/index.mjs';
import { createAccountsService } from './accounts.mjs';
import { createRouter } from './router.mjs';
import { probeServices } from './status.mjs';
import { renderSitemap, renderFeed, renderOpenSearch, renderRobots } from './xml.mjs';
import { FEATURES, SITE, baseUrl } from './content.mjs';
import { createCognitoAuth, loadCognitoConfig } from './cognito.mjs';
import { createCognitoSessionService } from './cognito-session.mjs';
import { buildClientImportMessage, CLIENT_IMPORT_SOURCE_TYPES, evaluateImportRequest } from './client-import.mjs';

const DEFAULT_PORT = 3011;
const publicDir = packageDir(import.meta.url, '../public');
const pagesDir = packageDir(import.meta.url, 'pages');
const COOKIE_NAME = 'rtp_portal';
const PROTECTED_PAGES = new Set(['/account', '/efin', '/client-import']);

export const webPortalDescriptor = createServiceDescriptor({
  name: 'web-portal',
  domain: 'presence',
  responsibilities: [
    'Serve the multi-page XHTML/XML marketing and authenticated onboarding site.',
    'Enforce local development or Cognito authorization-code authentication.',
    'Register and track IRS EFIN provider identities through authenticated sessions.',
    'Prepare secure client-import messaging and validation gates.'
  ],
  dependencies: ['@rtp/platform-core', '@rtp/rtp-datastore', '@rtp/sri-efin']
});

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body, null, 2));
}
function sendXml(response, statusCode, contentType, body) {
  response.writeHead(statusCode, { 'content-type': contentType });
  response.end(body);
}
function sendXhtml(response, statusCode, body) {
  response.writeHead(statusCode, { 'content-type': 'application/xhtml+xml; charset=utf-8' });
  response.end(body);
}
function redirect(response, location, cookie, statusCode = 303) {
  const headers = { location };
  if (cookie) headers['set-cookie'] = cookie;
  response.writeHead(statusCode, headers);
  response.end();
}
function parseCookies(header = '') {
  const jar = {};
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    try { jar[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim()); } catch { /* ignore */ }
  }
  return jar;
}
function sessionCookie(token, secure = false, maxAgeSec = 8 * 60 * 60) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`;
}
function clearCookie(secure = false) {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}
function isSecureRequest(request, config) {
  return config.appEnv === 'production' || String(request.headers['x-forwarded-proto'] ?? '').toLowerCase() === 'https';
}
function boolField(value) {
  return value === true || value === 'true' || value === 'on' || value === '1';
}
function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > 400_000) {
        reject(new Error('Request body too large.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      const contentType = String(request.headers['content-type'] ?? '');
      if (raw === '') return resolve({ fields: {}, isJson: contentType.includes('application/json') });
      if (contentType.includes('application/json')) {
        try { return resolve({ fields: JSON.parse(raw), isJson: true }); }
        catch { return reject(new Error('Request body must be valid JSON.')); }
      }
      const params = new URLSearchParams(raw);
      const fields = {};
      for (const key of new Set(params.keys())) {
        const values = params.getAll(key);
        fields[key] = values.length > 1 ? values : values[0];
      }
      resolve({ fields, isJson: false });
    });
    request.on('error', reject);
  });
}
function wantsJson(request, body) {
  return body.isJson || String(request.headers.accept ?? '').includes('application/json') || request.headers['x-requested-with'] === 'fetch';
}
function render404() {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" lang="en"><head><meta charset="utf-8" /><title>Not found · ${SITE.short}</title><link rel="stylesheet" href="/static/styles.css" /></head><body><main class="wrap"><section class="form-card"><h1>404 — not found</h1><p class="lede">That page does not exist.</p><a class="cta-btn" href="/">Back home</a></section></main></body></html>`;
}

export async function createPortalServer({ dbDir, persist = true, env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const config = loadRuntimeConfig({ servicePort: DEFAULT_PORT });
  const db = createDatabase({ name: persist ? 'portal' : `portal-test-${Date.now()}-${Math.random()}`, dir: dbDir, persist });
  const accounts = createAccountsService({ db, auditPath: persist ? path.resolve(process.cwd(), 'logs', 'web-portal-audit.jsonl') : null });
  const efin = createEfinRegistry({ db });
  const router = await createRouter({ pagesDir });
  const authConfig = loadCognitoConfig({ env, appEnv: config.appEnv });
  const cognito = createCognitoAuth({ db, config: authConfig, fetchImpl });
  const cognitoSessions = createCognitoSessionService({ db });
  const clientImport = Object.freeze({
    sourceTypes: CLIENT_IMPORT_SOURCE_TYPES,
    buildMessage: buildClientImportMessage,
    evaluate: evaluateImportRequest
  });
  const services = { accounts, efin, cognito, clientImport };

  function resolveSession(request) {
    const token = parseCookies(request.headers.cookie)[COOKIE_NAME];
    return { token, session: accounts.session(token) };
  }
  function loginLocation(pathname) {
    const next = encodeURIComponent(cognito.safeNext(pathname));
    return authConfig.enabled ? `/auth/login?next=${next}` : `/signin?next=${next}`;
  }
  function requireSession(request, response) {
    const resolved = resolveSession(request);
    if (!resolved.session.ok) {
      sendJson(response, 401, { ok: false, code: 'authentication_required', login: loginLocation('/account') });
      return null;
    }
    return resolved;
  }

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const { pathname } = url;
    const method = request.method || 'GET';
    const secure = isSecureRequest(request, config);

    try {
      if (method === 'GET' && pathname === '/health') {
        const blocked = authConfig.enabled && !authConfig.configured;
        return sendJson(response, blocked ? 503 : 200, {
          status: blocked ? 'blocked_configuration' : 'ok',
          service: webPortalDescriptor.name,
          environment: config.appEnv,
          authentication: cognito.describe()
        });
      }
      if (method === 'GET' && pathname === '/metadata') {
        return sendJson(response, 200, {
          identity: PLATFORM_IDENTITY,
          service: webPortalDescriptor,
          runtime: redactConfig(config),
          environmentProtection: evaluateEnvironmentProtection(config),
          metadata: {
            baseUrl: baseUrl(config), pages: router.list().map((page) => page.route),
            accounts: accounts.describe(), efinProviders: efin.count(), authentication: cognito.describe()
          }
        });
      }

      if (method === 'GET' && pathname === '/auth/login') {
        const result = cognito.begin(url.searchParams.get('next') || '/account');
        if (!result.ok) return redirect(response, '/signin');
        return redirect(response, result.location, null, 302);
      }
      if (method === 'GET' && pathname === '/auth/callback') {
        if (url.searchParams.get('error')) return sendJson(response, 401, { error: 'cognito_authorization_failed', detail: url.searchParams.get('error_description') || url.searchParams.get('error') });
        const result = await cognito.callback({ code: url.searchParams.get('code'), state: url.searchParams.get('state') });
        if (!result.ok) return sendJson(response, 401, result);
        const issued = cognitoSessions.issue(result.identity);
        if (!issued.ok) return sendJson(response, 401, issued);
        return redirect(response, result.next, sessionCookie(issued.token, secure), 303);
      }
      if (method === 'GET' && pathname === '/auth/logout') {
        const { token } = resolveSession(request);
        accounts.signout(token);
        return redirect(response, cognito.logoutLocation(), clearCookie(secure), 302);
      }

      if (method === 'GET' && pathname === '/sitemap.xml') return sendXml(response, 200, 'application/xml; charset=utf-8', renderSitemap(router.list(), config));
      if (method === 'GET' && pathname === '/feed.xml') return sendXml(response, 200, 'application/atom+xml; charset=utf-8', renderFeed(router.list(), config));
      if (method === 'GET' && pathname === '/opensearch.xml') return sendXml(response, 200, 'application/opensearchdescription+xml; charset=utf-8', renderOpenSearch(config));
      if (method === 'GET' && pathname === '/robots.txt') return sendXml(response, 200, 'text/plain; charset=utf-8', renderRobots(config));
      if (method === 'GET' && pathname.startsWith('/rtp-design/')) {
        const { serveDesignSystemAsset } = await import('../../../packages/ui-design-system/src/index.mjs');
        if (serveDesignSystemAsset(response, pathname)) return;
      }
      if (method === 'GET' && pathname.startsWith('/static/')) {
        if (serveStaticFile(response, publicDir, pathname.replace(/^\/static/, ''))) return;
        return sendJson(response, 404, { error: 'not_found', path: pathname });
      }

      if (pathname === '/api/auth/status' && method === 'GET') return sendJson(response, 200, cognito.describe());
      if (pathname === '/api/register' && method === 'POST') {
        if (authConfig.enabled) return sendJson(response, 409, { ok: false, code: 'managed_authentication_required', login: '/auth/login' });
        const body = await readBody(request);
        const result = accounts.register(body.fields);
        if (!result.ok) return wantsJson(request, body) ? sendJson(response, 400, result) : redirect(response, '/register');
        const cookie = sessionCookie(result.token, secure);
        if (wantsJson(request, body)) {
          response.writeHead(201, { 'content-type': 'application/json; charset=utf-8', 'set-cookie': cookie });
          return response.end(JSON.stringify({ ok: true, account: result.account }, null, 2));
        }
        return redirect(response, '/account', cookie);
      }
      if (pathname === '/api/signin' && method === 'POST') {
        if (authConfig.enabled) return sendJson(response, 409, { ok: false, code: 'managed_authentication_required', login: '/auth/login' });
        const body = await readBody(request);
        const result = accounts.signin(body.fields);
        if (!result.ok) return wantsJson(request, body) ? sendJson(response, 401, result) : redirect(response, '/signin');
        const cookie = sessionCookie(result.token, secure);
        if (wantsJson(request, body)) {
          response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'set-cookie': cookie });
          return response.end(JSON.stringify({ ok: true, account: result.account }, null, 2));
        }
        return redirect(response, '/account', cookie);
      }
      if (pathname === '/api/signout' && method === 'POST') {
        const { token } = resolveSession(request);
        accounts.signout(token);
        const body = await readBody(request);
        if (wantsJson(request, body)) {
          response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'set-cookie': clearCookie(secure) });
          return response.end(JSON.stringify({ ok: true }, null, 2));
        }
        return redirect(response, '/', clearCookie(secure));
      }
      if (pathname === '/api/session' && method === 'GET') {
        const { session } = resolveSession(request);
        return sendJson(response, session.ok ? 200 : 401, session);
      }
      if (pathname === '/api/efin' && method === 'GET') {
        const resolved = requireSession(request, response); if (!resolved) return;
        return sendJson(response, 200, { providers: efin.list({ accountId: resolved.session.account.id }) });
      }
      if (pathname === '/api/efin' && method === 'POST') {
        const resolved = requireSession(request, response); if (!resolved) return;
        const body = await readBody(request);
        const fields = body.fields;
        const providerTypes = Array.isArray(fields.providerTypes) ? fields.providerTypes : fields.providerTypes ? [fields.providerTypes] : undefined;
        const result = efin.register({
          efin: fields.efin, etin: fields.etin, firmName: fields.firmName, providerTypes,
          responsibleOfficial: { name: fields.responsibleName, title: fields.responsibleTitle, email: fields.responsibleEmail },
          accountId: resolved.session.account.id
        });
        if (!result.ok) return wantsJson(request, body) ? sendJson(response, 400, result) : redirect(response, '/efin');
        return wantsJson(request, body) ? sendJson(response, 201, result) : redirect(response, '/efin');
      }
      const transitionMatch = pathname.match(/^\/api\/efin\/([^/]+)\/transition$/);
      if (transitionMatch && method === 'POST') {
        const resolved = requireSession(request, response); if (!resolved) return;
        const provider = efin.get(decodeURIComponent(transitionMatch[1]));
        if (!provider || provider.accountId !== resolved.session.account.id) return sendJson(response, 404, { error: 'not_found' });
        const body = await readBody(request);
        const result = efin.transition(provider.id, body.fields.to, { note: body.fields.note });
        return sendJson(response, result.ok ? 200 : 400, result);
      }
      if (pathname === '/api/client-import/message' && method === 'GET') {
        const resolved = requireSession(request, response); if (!resolved) return;
        return sendJson(response, 200, { ok: true, message: buildClientImportMessage({ firmName: resolved.session.account.org || SITE.name, portalUrl: `${baseUrl(config)}/client-import` }) });
      }
      if (pathname === '/api/client-import/evaluate' && method === 'POST') {
        const resolved = requireSession(request, response); if (!resolved) return;
        const body = await readBody(request);
        const result = evaluateImportRequest({
          sourceType: body.fields.sourceType,
          recordCount: body.fields.recordCount,
          taxpayerConsent: boolField(body.fields.taxpayerConsent),
          encryptedTransfer: boolField(body.fields.encryptedTransfer)
        });
        return sendJson(response, result.ok ? 200 : 400, result);
      }
      if (pathname === '/api/status' && method === 'GET') return sendJson(response, 200, { services: await probeServices() });
      if (pathname === '/api/platform' && method === 'GET') return sendJson(response, 200, { product: `${SITE.name} — ${SITE.product}`, features: FEATURES, providerTypes: PROVIDER_TYPES });

      if (method === 'GET') {
        const page = router.match(pathname);
        if (page) {
          const { session } = resolveSession(request);
          if (PROTECTED_PAGES.has(pathname) && !session.ok) return redirect(response, loginLocation(pathname), null, 302);
          const html = await router.render(page, { url, config, session, services, auth: cognito.describe() });
          return sendXhtml(response, 200, html);
        }
        return sendXhtml(response, 404, render404());
      }
      return sendJson(response, 405, { error: 'method_not_allowed', method, path: pathname });
    } catch (error) {
      return sendJson(response, 400, { error: 'bad_request', message: error.message });
    }
  });
  return { server, config, db, accounts, efin, router, cognito, clientImport };
}

export async function start() {
  const context = await createPortalServer();
  context.server.listen(context.config.servicePort, () => {
    console.log(`web-portal listening on http://localhost:${context.config.servicePort} (${context.config.appEnv})`);
  });
  return context;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) start();
