import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const catalogPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../config/release/channels.json'
);

let cachedCatalog = null;

/** Load the canonical v2.0 channel catalog from config/release/channels.json. */
export function loadChannelCatalog(overrides = null) {
  if (overrides) return normalizeCatalog(overrides);
  if (!cachedCatalog) {
    cachedCatalog = normalizeCatalog(JSON.parse(readFileSync(catalogPath, 'utf8')));
  }
  return cachedCatalog;
}

function normalizeCatalog(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Channel catalog must be an object.');
  if (!Array.isArray(raw.channels) || raw.channels.length === 0) {
    throw new Error('Channel catalog must declare a non-empty channels array.');
  }
  const channels = raw.channels.map((ch) => {
    if (!ch?.id || !ch?.tag) throw new Error(`Invalid channel entry: ${JSON.stringify(ch)}`);
    return Object.freeze({
      id: String(ch.id),
      tag: String(ch.tag),
      label: String(ch.label || ch.id),
      stability: String(ch.stability || 'unknown'),
      productionEligible: ch.productionEligible === true,
      order: Number(ch.order ?? 0)
    });
  });
  return Object.freeze({
    schemaVersion: Number(raw.schemaVersion ?? 1),
    baseVersion: String(raw.baseVersion || '2.0.0'),
    tagPrefix: String(raw.tagPrefix || 'v2.0'),
    defaultChannel: String(raw.defaultChannel || 'dev'),
    product: String(raw.product || 'RTPSC Tax Platform'),
    channels: Object.freeze(channels.slice().sort((a, b) => a.order - b.order))
  });
}

export function listChannels(catalog = loadChannelCatalog()) {
  return catalog.channels;
}

export function getChannel(channelId, catalog = loadChannelCatalog()) {
  const id = String(channelId || '').trim().toLowerCase();
  return catalog.channels.find((ch) => ch.id === id) || null;
}

/**
 * Parse a release tag or channel token into { channel, tag }.
 * Accepts: alpha | v2.0-alpha | 2.0-alpha | v2.0.0-alpha
 */
export function parseReleaseToken(token, catalog = loadChannelCatalog()) {
  const raw = String(token || '').trim();
  if (!raw) return { ok: false, error: 'empty_token' };

  const lower = raw.toLowerCase().replace(/^v/, '');
  // Exact channel id
  const byId = getChannel(lower, catalog);
  if (byId) return { ok: true, channel: byId, tag: byId.tag, input: raw };

  // Tag forms: 2.0-alpha | 2.0.0-alpha | v2.0-rc1
  const tagMatch = lower.match(/^(?:2\.0(?:\.0)?)[-.]([a-z0-9]+)$/);
  if (tagMatch) {
    const bySuffix = getChannel(tagMatch[1], catalog);
    if (bySuffix) return { ok: true, channel: bySuffix, tag: bySuffix.tag, input: raw };
  }

  // Full catalog tag match (case-insensitive)
  const byTag = catalog.channels.find((ch) => ch.tag.toLowerCase() === raw.toLowerCase());
  if (byTag) return { ok: true, channel: byTag, tag: byTag.tag, input: raw };

  return {
    ok: false,
    error: 'unknown_channel',
    input: raw,
    allowed: catalog.channels.map((ch) => ch.id)
  };
}

export function formatReleaseTag(channelId, catalog = loadChannelCatalog()) {
  const channel = getChannel(channelId, catalog);
  if (!channel) {
    throw Object.assign(new Error(`Unknown release channel: ${channelId}`), {
      code: 'unknown_channel',
      allowed: catalog.channels.map((ch) => ch.id)
    });
  }
  return channel.tag;
}

export function isProductionEligible(channelId, catalog = loadChannelCatalog()) {
  const channel = getChannel(channelId, catalog);
  return channel?.productionEligible === true;
}
