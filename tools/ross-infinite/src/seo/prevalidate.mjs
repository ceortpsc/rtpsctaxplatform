import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import dns from 'node:dns/promises';
import { ownershipPlan, resolveToken } from './ownership.mjs';
import { writeEvidenceReceipt } from './evidence.mjs';
import { EVIDENCE_STATES } from './states.mjs';

export async function prevalidateOwnership(root, config, { live = false, env = process.env } = {}) {
  const plan = ownershipPlan(config);
  const checks = [];

  checks.push({
    id: 'owner-assertion',
    status: config.owner.ownerAssertion === true ? 'pass' : 'fail',
    detail: `${config.owner.ownerName} @ ${config.owner.assertedAt}`
  });

  checks.push({
    id: 'property-map',
    status: config.properties.length > 0 ? 'pass' : 'fail',
    detail: `${config.properties.length} properties`
  });

  const publicDir = path.join(root, config.output.publicDir);
  const requiredAssets = ['seo-head.html', 'robots.txt', 'sitemap.xml', 'software-application.jsonld'];
  for (const asset of requiredAssets) {
    const abs = path.join(publicDir, asset);
    try {
      await access(abs);
      checks.push({ id: `asset:${asset}`, status: 'pass', detail: path.relative(root, abs) });
    } catch {
      checks.push({ id: `asset:${asset}`, status: 'fail', detail: 'missing — run seo generate' });
    }
  }

  const googleMeta = resolveToken(plan.verification.googleMetaEnv, env);
  const googleDns = resolveToken(plan.verification.googleDnsEnv, env);
  const bingMeta = resolveToken(plan.verification.bingMetaEnv, env);
  const indexNow = resolveToken(plan.verification.indexNowKeyEnv, env);

  checks.push({
    id: 'token:google-meta',
    status: googleMeta ? 'pass' : 'warn',
    detail: googleMeta ? 'present' : `set ${plan.verification.googleMetaEnv}`
  });
  checks.push({
    id: 'token:google-dns',
    status: googleDns ? 'pass' : 'warn',
    detail: googleDns ? 'present' : `set ${plan.verification.googleDnsEnv}`
  });
  checks.push({
    id: 'token:bing-meta',
    status: bingMeta ? 'pass' : 'warn',
    detail: bingMeta ? 'present' : `set ${plan.verification.bingMetaEnv}`
  });
  checks.push({
    id: 'token:indexnow',
    status: indexNow ? 'pass' : 'warn',
    detail: indexNow ? 'present' : `set ${plan.verification.indexNowKeyEnv}`
  });

  let dnsResult = null;
  if (live) {
    const primary = plan.primaryProperty;
    try {
      const records = await dns.resolveTxt(primary.host);
      const flat = records.map((row) => row.join(''));
      const expected = googleDns || null;
      const matched = expected ? flat.some((row) => row.includes(expected) || row === expected) : false;
      dnsResult = { host: primary.host, records: flat, matched, expectedConfigured: Boolean(expected) };
      checks.push({
        id: 'live-dns-txt',
        status: matched ? 'pass' : expected ? 'fail' : 'warn',
        detail: matched ? 'verification TXT observed' : expected ? 'expected TXT not observed' : 'no DNS token configured'
      });
    } catch (error) {
      dnsResult = { host: primary.host, error: error.message };
      checks.push({ id: 'live-dns-txt', status: 'fail', detail: error.message });
    }
  } else {
    checks.push({
      id: 'live-dns-txt',
      status: 'skip',
      detail: 'pass --live after DNS deployment'
    });
  }

  // Head injection consistency when assets exist
  try {
    const head = await readFile(path.join(publicDir, 'seo-head.html'), 'utf8');
    checks.push({
      id: 'head-canonical',
      status: head.includes(config.brand.canonical) ? 'pass' : 'fail',
      detail: config.brand.canonical
    });
  } catch {
    // already covered by asset check
  }

  const failed = checks.filter((c) => c.status === 'fail');
  const state =
    failed.length === 0
      ? live && dnsResult?.matched
        ? 'DEPLOYED'
        : 'PREVALIDATED'
      : 'ASSERTED';

  const receipt = await writeEvidenceReceipt(root, config.output.evidenceDir, 'seo-prevalidate', {
    state,
    live,
    checks,
    dnsResult,
    pipeline: EVIDENCE_STATES,
    providerVerified: false,
    note: 'Provider verification cannot be marked complete until Google/Bing confirms ownership.'
  });

  return {
    ok: failed.length === 0,
    state,
    live,
    checks,
    dnsResult,
    receipt,
    plan
  };
}
