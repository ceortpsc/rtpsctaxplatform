import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatReleaseTag,
  getChannel,
  isProductionEligible,
  listChannels,
  loadChannelCatalog,
  parseReleaseToken
} from './channels.mjs';

export {
  formatReleaseTag,
  getChannel,
  isProductionEligible,
  listChannels,
  loadChannelCatalog,
  parseReleaseToken
};

const STAMP_RELATIVE = 'build/platform-release.json';

function envChannel() {
  return process.env.RTPSC_RELEASE_CHANNEL || process.env.RELEASE_CHANNEL || null;
}

function envVersion() {
  return process.env.RTPSC_VERSION || process.env.PLATFORM_VERSION || null;
}

/**
 * Resolve the active platform release.
 *
 * Precedence:
 *  1. explicit overrides (channel / version)
 *  2. RTPSC_RELEASE_CHANNEL / RTPSC_VERSION env
 *  3. stamped build/platform-release.json
 *  4. catalog default (dev) on baseVersion 2.0.0
 */
export async function resolvePlatformRelease(root, overrides = {}) {
  const catalog = loadChannelCatalog();
  let channelId = overrides.channel ?? envChannel();
  let version = overrides.version ?? envVersion() ?? catalog.baseVersion;
  let source = overrides.channel || overrides.version ? 'override' : envChannel() || envVersion() ? 'env' : null;
  let stamped = null;

  if (!channelId) {
    stamped = await loadReleaseStamp(root);
    if (stamped?.channel) {
      channelId = stamped.channel;
      version = stamped.version || version;
      source = 'stamp';
    }
  }

  if (!channelId) {
    channelId = catalog.defaultChannel;
    source = source || 'default';
  }

  const parsed = parseReleaseToken(channelId, catalog);
  if (!parsed.ok) {
    throw Object.assign(new Error(`Unknown release channel: ${channelId}`), {
      code: 'unknown_channel',
      allowed: parsed.allowed
    });
  }

  const channel = parsed.channel;
  return freezeRelease({
    product: catalog.product,
    version: String(version),
    channel: channel.id,
    tag: channel.tag,
    label: channel.label,
    stability: channel.stability,
    productionEligible: channel.productionEligible === true,
    source,
    buildId: stamped?.buildId || overrides.buildId || null,
    stampedAt: stamped?.stampedAt || null,
    catalogVersion: catalog.baseVersion
  });
}

/** Synchronous stamp load (for HTTP metadata / health paths). */
export function loadReleaseStampSync(root) {
  if (!root) return null;
  try {
    return JSON.parse(readFileSync(path.join(root, STAMP_RELATIVE), 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Synchronous resolve using override → env → stamp → catalog default.
 * Pass `root` (repo root) so stamped builds show on /metadata without async I/O.
 */
export function resolvePlatformReleaseSync(overrides = {}) {
  const catalog = loadChannelCatalog();
  const stamped =
    overrides.channel || envChannel()
      ? null
      : loadReleaseStampSync(overrides.root ?? findRepoRoot());
  const channelToken =
    overrides.channel ?? envChannel() ?? stamped?.channel ?? catalog.defaultChannel;
  const parsed = parseReleaseToken(channelToken, catalog);
  if (!parsed.ok) {
    throw Object.assign(new Error(`Unknown release channel: ${channelToken}`), {
      code: 'unknown_channel',
      allowed: parsed.allowed
    });
  }
  const channel = parsed.channel;
  let source = 'default';
  if (overrides.channel) source = 'override';
  else if (envChannel()) source = 'env';
  else if (stamped?.channel) source = 'stamp';
  return freezeRelease({
    product: catalog.product,
    version: String(overrides.version ?? envVersion() ?? stamped?.version ?? catalog.baseVersion),
    channel: channel.id,
    tag: channel.tag,
    label: channel.label,
    stability: channel.stability,
    productionEligible: channel.productionEligible === true,
    source,
    buildId: overrides.buildId || stamped?.buildId || null,
    stampedAt: stamped?.stampedAt || null,
    catalogVersion: catalog.baseVersion
  });
}

function findRepoRoot() {
  // packages/platform-version/src → repo root
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
}

function freezeRelease(release) {
  return Object.freeze({ ...release });
}

export async function loadReleaseStamp(root) {
  if (!root) return null;
  try {
    const raw = await readFile(path.join(root, STAMP_RELATIVE), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Stamp the active release into build/platform-release.json (+ sha256 sidecar).
 */
export async function stampPlatformRelease(root, options = {}) {
  const catalog = loadChannelCatalog();
  const prior = options.channel || envChannel() ? null : await loadReleaseStamp(root);
  const channelToken =
    options.channel ?? envChannel() ?? prior?.channel ?? catalog.defaultChannel;
  const parsed = parseReleaseToken(channelToken, catalog);
  if (!parsed.ok) {
    throw Object.assign(new Error(`Unknown release channel: ${channelToken}`), {
      code: 'unknown_channel',
      allowed: parsed.allowed
    });
  }

  const channel = parsed.channel;
  const version = String(
    options.version ?? envVersion() ?? prior?.version ?? catalog.baseVersion
  );
  const stampedAt = new Date().toISOString();
  const buildSeed = [
    catalog.product,
    version,
    channel.id,
    channel.tag,
    stampedAt,
    options.note || '',
    options.requestedBy || process.env.USER || 'operator'
  ].join('|');
  const buildId = createHash('sha256').update(buildSeed).digest('hex').slice(0, 16);

  const release = freezeRelease({
    product: catalog.product,
    kind: 'platform-release',
    schemaVersion: catalog.schemaVersion,
    version,
    channel: channel.id,
    tag: channel.tag,
    label: channel.label,
    stability: channel.stability,
    productionEligible: channel.productionEligible === true,
    buildId,
    stampedAt,
    source: 'stamp',
    catalogVersion: catalog.baseVersion,
    note: options.note || null,
    requestedBy: options.requestedBy || process.env.USER || 'operator',
    channels: catalog.channels.map((ch) => ({
      id: ch.id,
      tag: ch.tag,
      label: ch.label,
      productionEligible: ch.productionEligible
    }))
  });

  const outDir = path.join(root, 'build');
  await mkdir(outDir, { recursive: true });
  const body = `${JSON.stringify(release, null, 2)}\n`;
  const digest = createHash('sha256').update(body).digest('hex');
  const outPath = path.join(outDir, 'platform-release.json');
  await writeFile(outPath, body, 'utf8');
  await writeFile(path.join(outDir, 'platform-release.sha256'), `${digest}  platform-release.json\n`, 'utf8');
  await writeFile(path.join(outDir, 'platform-release-LATEST.json'), body, 'utf8');

  return {
    release,
    digest,
    outPath: path.relative(root, outPath),
    shaPath: 'build/platform-release.sha256',
    latestPath: 'build/platform-release-LATEST.json'
  };
}

/** Human-readable channel matrix for CLI / docs. */
export function describeChannels(catalog = loadChannelCatalog()) {
  return catalog.channels.map((ch) => ({
    id: ch.id,
    tag: ch.tag,
    label: ch.label,
    stability: ch.stability,
    productionEligible: ch.productionEligible
  }));
}

export function releaseMetadataBlock(release) {
  if (!release) return null;
  return {
    version: release.version,
    channel: release.channel,
    tag: release.tag,
    label: release.label,
    stability: release.stability,
    productionEligible: release.productionEligible === true,
    buildId: release.buildId || null,
    stampedAt: release.stampedAt || null,
    source: release.source || null
  };
}
