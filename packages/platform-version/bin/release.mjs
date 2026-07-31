#!/usr/bin/env node
/**
 * RTPSC v2.0 release channel CLI.
 *
 * Usage:
 *   ./rtpsc release list
 *   ./rtpsc release status [--json]
 *   ./rtpsc release set <channel> [--json]
 *   ./rtpsc release stamp [channel] [--json] [--note "..."]
 *   ./rtpsc release develop [--json] [--keep-last]
 *   ./rtpsc release tag <channel>
 *   ./rtpsc version
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  describeChannels,
  formatReleaseTag,
  loadChannelCatalog,
  parseReleaseToken,
  resolvePlatformRelease,
  stampPlatformRelease
} from '../src/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
const json = args.includes('--json');
const filtered = args.filter((a) => a !== '--json');

function noteFromArgs(argv) {
  const idx = argv.indexOf('--note');
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
  return null;
}

function printHelp() {
  console.log(`RTPSC v2.0 release channels

Usage:
  ./rtpsc release list
  ./rtpsc release status [--json]
  ./rtpsc release set <channel> [--json]
  ./rtpsc release stamp [channel] [--json] [--note "..."]
  ./rtpsc release develop [--json] [--keep-last]
  ./rtpsc release tag <channel>
  ./rtpsc version

Channels:
  alpha       v2.0-alpha       early unstable build
  beta        v2.0-beta        feature-complete but not final
  rc1         v2.0-rc1         release candidate
  stable      v2.0-stable      final production build
  lts         v2.0-lts         long-term support
  enterprise  v2.0-enterprise  enterprise-grade build
  dev         v2.0-dev         developer build
  hotfix      v2.0-hotfix      emergency patch

Env:
  RTPSC_RELEASE_CHANNEL   active channel id (or tag)
  RTPSC_VERSION           semver override (default 2.0.0)
`);
}

const sub = filtered[0] || 'status';

if (sub === 'help' || sub === '--help' || sub === '-h') {
  printHelp();
  process.exit(0);
}

if (sub === 'list' || sub === 'channels') {
  const rows = describeChannels();
  if (json) {
    console.log(JSON.stringify({ baseVersion: loadChannelCatalog().baseVersion, channels: rows }, null, 2));
  } else {
    console.log('RTPSC v2.0 release channels\n');
    for (const row of rows) {
      const prod = row.productionEligible ? 'prod-ok' : 'non-prod';
      console.log(`  ${row.id.padEnd(12)} ${row.tag.padEnd(18)} ${prod.padEnd(9)}  ${row.label}`);
    }
  }
  process.exit(0);
}

if (sub === 'tag') {
  const token = filtered[1];
  if (!token) {
    console.error('release tag requires a channel (e.g. beta or v2.0-beta)');
    process.exit(1);
  }
  const parsed = parseReleaseToken(token);
  if (!parsed.ok) {
    console.error(`Unknown channel "${token}". Allowed: ${parsed.allowed.join(', ')}`);
    process.exit(1);
  }
  console.log(parsed.tag);
  process.exit(0);
}

if (sub === 'set') {
  const token = filtered[1];
  if (!token) {
    console.error('release set requires a channel');
    process.exit(1);
  }
  const result = await stampPlatformRelease(root, {
    channel: token,
    note: noteFromArgs(filtered) || `set ${token}`,
    requestedBy: process.env.USER || 'operator'
  });
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Release set → ${result.release.tag}`);
    console.log(`version=${result.release.version} channel=${result.release.channel} buildId=${result.release.buildId}`);
    console.log(`stamp=${result.outPath}`);
  }
  process.exit(0);
}

if (sub === 'stamp' || sub === 'build') {
  const token = filtered[1] && !filtered[1].startsWith('--') ? filtered[1] : undefined;
  const result = await stampPlatformRelease(root, {
    channel: token,
    note: noteFromArgs(filtered),
    requestedBy: process.env.USER || 'operator'
  });
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Release stamped → ${result.release.tag}`);
    console.log(`version=${result.release.version} channel=${result.release.channel} buildId=${result.release.buildId}`);
    console.log(`digest=${result.digest.slice(0, 12)}…`);
    console.log(`stamp=${result.outPath}`);
  }
  process.exit(0);
}

if (sub === 'develop' || sub === 'matrix') {
  // Build/develop every v2.0 channel stamp into build/release-matrix.json
  const catalog = loadChannelCatalog();
  const rows = [];
  for (const channel of catalog.channels) {
    const result = await stampPlatformRelease(root, {
      channel: channel.id,
      note: noteFromArgs(filtered) || `develop matrix ${channel.id}`,
      requestedBy: process.env.USER || 'operator'
    });
    rows.push({
      id: channel.id,
      tag: result.release.tag,
      label: channel.label,
      productionEligible: channel.productionEligible,
      buildId: result.release.buildId,
      stampedAt: result.release.stampedAt,
      digest: result.digest
    });
  }
  // Leave active stamp on default/dev unless --keep-last
  const keepLast = filtered.includes('--keep-last');
  if (!keepLast) {
    await stampPlatformRelease(root, {
      channel: catalog.defaultChannel,
      note: 'develop matrix complete → restore default',
      requestedBy: process.env.USER || 'operator'
    });
  }
  const matrix = {
    product: catalog.product,
    baseVersion: catalog.baseVersion,
    kind: 'platform-release-matrix',
    generatedAt: new Date().toISOString(),
    channels: rows
  };
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  await mkdir(path.join(root, 'build'), { recursive: true });
  const body = `${JSON.stringify(matrix, null, 2)}\n`;
  const digest = createHash('sha256').update(body).digest('hex');
  await writeFile(path.join(root, 'build/release-matrix.json'), body, 'utf8');
  await writeFile(path.join(root, 'build/release-matrix.sha256'), `${digest}  release-matrix.json\n`, 'utf8');
  if (json) console.log(JSON.stringify({ ...matrix, digest }, null, 2));
  else {
    console.log('RTPSC v2.0 release develop matrix\n');
    for (const row of rows) {
      console.log(`  ✓ ${row.tag.padEnd(18)} buildId=${row.buildId}`);
    }
    console.log(`\nmatrix → build/release-matrix.json (${digest.slice(0, 12)}…)`);
    if (!keepLast) console.log(`active channel restored → ${catalog.defaultChannel}`);
  }
  process.exit(0);
}

// status (default) and version
const release = await resolvePlatformRelease(root);
if (sub === 'version' || sub === '-v' || sub === '--version') {
  if (json) console.log(JSON.stringify({ version: release.version, channel: release.channel, tag: release.tag }, null, 2));
  else console.log(release.tag);
  process.exit(0);
}

if (sub === 'status') {
  if (json) console.log(JSON.stringify(release, null, 2));
  else {
    console.log(`RTPSC release status`);
    console.log(`  tag:                 ${release.tag}`);
    console.log(`  version:             ${release.version}`);
    console.log(`  channel:             ${release.channel}`);
    console.log(`  label:               ${release.label}`);
    console.log(`  stability:           ${release.stability}`);
    console.log(`  productionEligible:  ${release.productionEligible}`);
    console.log(`  source:              ${release.source}`);
    if (release.buildId) console.log(`  buildId:             ${release.buildId}`);
    if (release.stampedAt) console.log(`  stampedAt:           ${release.stampedAt}`);
  }
  process.exit(0);
}

console.error(`Unknown release subcommand: ${sub}`);
printHelp();
process.exit(1);
