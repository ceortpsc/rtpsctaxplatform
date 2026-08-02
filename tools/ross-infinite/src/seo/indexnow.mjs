import { ownershipPlan, resolveToken } from './ownership.mjs';
import { writeEvidenceReceipt } from './evidence.mjs';

/**
 * IndexNow adapter. Dry-run by default; --execute posts the payload.
 */
export async function indexNowSubmit(root, config, {
  execute = false,
  env = process.env,
  fetchImpl = globalThis.fetch
} = {}) {
  const plan = ownershipPlan(config);
  const keyEnv = plan.verification.indexNowKeyEnv;
  const key = resolveToken(keyEnv, env);
  const primary = plan.primaryProperty;
  const endpoint = config.verification?.indexNow?.endpoint || 'https://api.indexnow.org/indexnow';

  if (!key) {
    throw new Error(`Missing ${keyEnv}. Generate assets first or export a production key.`);
  }

  const payload = {
    host: primary.host,
    key,
    keyLocation: `https://${primary.host}/${key}.txt`,
    urlList: config.properties.map((p) => p.url.replace(/\/?$/, '/'))
  };

  if (!execute) {
    const receipt = await writeEvidenceReceipt(root, config.output.evidenceDir, 'seo-indexnow-dry-run', {
      state: 'PREVALIDATED',
      endpoint,
      payload: { ...payload, key: redact(key) },
      note: 'Dry-run only. Re-run with --execute to submit.'
    });
    return { ok: true, dryRun: true, endpoint, payload, receipt };
  }

  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is unavailable in this runtime');
  }

  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload)
  });
  const body = await res.text();
  const receipt = await writeEvidenceReceipt(root, config.output.evidenceDir, 'seo-indexnow-execute', {
    state: res.ok ? 'INDEXING_ENABLED' : 'PREVALIDATED',
    endpoint,
    status: res.status,
    body,
    payload: { ...payload, key: redact(key) }
  });

  return {
    ok: res.ok,
    dryRun: false,
    endpoint,
    status: res.status,
    body,
    payload,
    receipt
  };
}

function redact(key) {
  if (!key || key.length < 8) return '***';
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}
