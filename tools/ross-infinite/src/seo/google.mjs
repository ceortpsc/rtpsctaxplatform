import { ownershipPlan, resolveToken } from './ownership.mjs';
import { writeEvidenceReceipt } from './evidence.mjs';

/**
 * Google Search Console adapter.
 * Dry-run by default; mutations require --execute and GOOGLE_ACCESS_TOKEN.
 */
export async function googleSearchConsole(root, config, action = 'listSites', {
  execute = false,
  env = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  const plan = ownershipPlan(config);
  const token = resolveToken(config.verification?.google?.accessTokenEnv || 'GOOGLE_ACCESS_TOKEN', env);
  const sites = config.properties.map((p) =>
    p.propertyType === 'domain' ? `sc-domain:${p.host}` : p.url
  );
  const primary = plan.primaryProperty;
  const sitemapUrl = `https://${primary.host}/sitemap.xml`;

  const requestPlan = {
    action,
    execute,
    sites,
    sitemapUrl,
    endpoint: actionEndpoint(action, sites[0], sitemapUrl),
    dryRun: !execute
  };

  if (!execute) {
    const receipt = await writeEvidenceReceipt(root, config.output.evidenceDir, 'seo-google-dry-run', {
      state: 'PREVALIDATED',
      requestPlan,
      note: 'No provider mutation performed. Re-run with --execute after authorization.'
    });
    return { ok: true, dryRun: true, requestPlan, receipt };
  }

  if (!token) {
    throw new Error(`Missing ${config.verification?.google?.accessTokenEnv || 'GOOGLE_ACCESS_TOKEN'} for --execute`);
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is unavailable in this runtime');
  }

  const response = await performAction(action, {
    token,
    sites,
    sitemapUrl,
    fetchImpl
  });

  const receipt = await writeEvidenceReceipt(root, config.output.evidenceDir, 'seo-google-execute', {
    state: response.ok ? 'INDEXING_ENABLED' : 'PREVALIDATED',
    requestPlan,
    response,
    providerVerified: false,
    note: 'API success is not equivalent to Search Console UI verification completion.'
  });

  return { ok: response.ok, dryRun: false, requestPlan, response, receipt };
}

function actionEndpoint(action, site, sitemapUrl) {
  switch (action) {
    case 'listSites':
      return 'https://www.googleapis.com/webmasters/v3/sites';
    case 'addSite':
      return `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}`;
    case 'submitSitemap':
      return `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/sitemaps/${encodeURIComponent(sitemapUrl)}`;
    default:
      return null;
  }
}

async function performAction(action, { token, sites, sitemapUrl, fetchImpl }) {
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  if (action === 'listSites') {
    const res = await fetchImpl('https://www.googleapis.com/webmasters/v3/sites', { headers });
    const body = await safeJson(res);
    return { ok: res.ok, status: res.status, body };
  }
  if (action === 'addSite') {
    const results = [];
    for (const site of sites) {
      const res = await fetchImpl(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}`, {
        method: 'PUT',
        headers
      });
      results.push({ site, status: res.status, ok: res.ok, body: await safeJson(res) });
    }
    return { ok: results.every((r) => r.ok), results };
  }
  if (action === 'submitSitemap') {
    const site = sites[0];
    const res = await fetchImpl(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
      { method: 'PUT', headers }
    );
    return { ok: res.ok, status: res.status, body: await safeJson(res) };
  }
  throw new Error(`Unknown google action: ${action}`);
}

async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
