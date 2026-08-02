import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_CONFIG = 'config/seo/ross.co.ownership.json';

export async function loadOwnershipConfig(root, configPath = DEFAULT_CONFIG) {
  const abs = path.isAbsolute(configPath) ? configPath : path.join(root, configPath);
  await access(abs);
  const raw = JSON.parse(await readFile(abs, 'utf8'));
  const errors = validateOwnershipConfig(raw);
  if (errors.length) {
    throw new Error(`Invalid ownership config: ${errors.join('; ')}`);
  }
  return { abs, config: raw };
}

export function validateOwnershipConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') return ['config must be an object'];
  if (!config.owner?.legalName) errors.push('owner.legalName required');
  if (config.owner?.ownerAssertion !== true) errors.push('owner.ownerAssertion must be true');
  if (!config.owner?.ownerName) errors.push('owner.ownerName required');
  if (!config.owner?.assertedAt) errors.push('owner.assertedAt required');
  if (!config.brand?.canonical) errors.push('brand.canonical required');
  if (!Array.isArray(config.properties) || config.properties.length === 0) {
    errors.push('properties must be a non-empty array');
  } else {
    for (const [index, property] of config.properties.entries()) {
      if (!property.host || !property.url || !property.propertyType) {
        errors.push(`properties[${index}] requires host, url, propertyType`);
      }
    }
  }
  if (!config.output?.publicDir || !config.output?.evidenceDir) {
    errors.push('output.publicDir and output.evidenceDir required');
  }
  return errors;
}

export function ownershipPlan(config) {
  const primary = config.properties.find((p) => p.primary) || config.properties[0];
  return {
    product: config.product || 'ROSS.CO Infinite',
    owner: config.owner,
    primaryProperty: primary,
    propertyCount: config.properties.length,
    properties: config.properties.map((p) => ({
      host: p.host,
      url: p.url,
      propertyType: p.propertyType,
      role: p.role || null
    })),
    verification: {
      googleMetaEnv: config.verification?.google?.metaEnv || 'GOOGLE_SITE_VERIFICATION_TOKEN',
      googleDnsEnv: config.verification?.google?.dnsEnv || 'GOOGLE_DNS_TXT_TOKEN',
      bingMetaEnv: config.verification?.bing?.metaEnv || 'BING_SITE_AUTH_TOKEN',
      indexNowKeyEnv: config.verification?.indexNow?.keyEnv || 'INDEXNOW_KEY'
    },
    evidenceStates: config.evidenceStates || [
      'ASSERTED',
      'PREVALIDATED',
      'DEPLOYED',
      'PROVIDER_VERIFIED',
      'INDEXING_ENABLED',
      'INDEXED'
    ],
    notes: config.notes || []
  };
}

export function resolveToken(envName, env = process.env) {
  const value = env[envName];
  return value && String(value).trim() ? String(value).trim() : null;
}

export { DEFAULT_CONFIG };
