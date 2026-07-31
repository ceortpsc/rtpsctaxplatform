#!/usr/bin/env node
/**
 * RTPSC 02.0V release channel builder.
 *
 *   node scripts/release.mjs list
 *   node scripts/release.mjs describe <channel>
 *   node scripts/release.mjs build [channel|all]
 *   node scripts/release.mjs activate <channel>
 *   node scripts/release.mjs status
 *   node scripts/release.mjs path <channel>
 */

import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  RELEASE_LINE,
  listReleaseChannels,
  resolveReleaseChannel,
  resolveChannelFromEnv,
  describeReleaseChannel,
  buildReleaseManifest,
  assertChannelActivatable,
  promotionPath,
  DEFAULT_RELEASE_CHANNEL
} from '../packages/platform-core/src/release-channels.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releasesRoot = path.join(root, 'build', 'releases');
const activePath = path.join(root, 'build', 'active-release.json');
const catalogPath = path.join(root, 'build', 'release-channels.json');

async function ensurePlatformManifest() {
  const platformManifest = path.join(root, 'build', 'platform-manifest.json');
  try {
    await access(platformManifest);
    return platformManifest;
  } catch {
    // Call the exported builder quietly so release CLI stdout stays pure JSON for CI parsers.
    const buildUrl = pathToFileURL(path.join(root, 'scripts', 'build.mjs')).href;
    const mod = await import(buildUrl);
    if (typeof mod.buildPlatform !== 'function') {
      throw new Error('scripts/build.mjs must export buildPlatform()');
    }
    await mod.buildPlatform({ cwd: root, quiet: true });
    return platformManifest;
  }
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function buildOne(channelId, { modules = null } = {}) {
  const channel = resolveReleaseChannel(channelId);
  const manifest = buildReleaseManifest(channel.id, {
    modules,
    notes: `${channel.description} — ${RELEASE_LINE.product}`
  });
  const outDir = path.join(releasesRoot, channel.tag);
  const outFile = path.join(outDir, 'manifest.json');
  await writeJson(outFile, manifest);
  await writeJson(path.join(outDir, 'BUILD_INFO.json'), {
    tag: channel.tag,
    semver: channel.semver,
    builtAt: manifest.builtAt,
    buildId: manifest.buildId,
    productionReady: channel.productionReady
  });
  return { channel, manifest, outFile };
}

async function buildAll() {
  const platformManifestPath = await ensurePlatformManifest();
  let modules = null;
  try {
    modules = (await readJson(platformManifestPath)).map((entry) => entry.modulePath);
  } catch {
    modules = null;
  }

  const built = [];
  for (const channel of listReleaseChannels()) {
    built.push(await buildOne(channel.id, { modules }));
  }

  const catalog = {
    schema: 'rtpsc-release-channels/v1',
    product: RELEASE_LINE.product,
    brandVersion: RELEASE_LINE.brandVersion,
    defaultChannel: DEFAULT_RELEASE_CHANNEL,
    generatedAt: new Date().toISOString(),
    channels: listReleaseChannels(),
    builds: built.map((entry) => ({
      id: entry.channel.id,
      tag: entry.channel.tag,
      path: path.relative(root, entry.outFile),
      productionReady: entry.channel.productionReady
    }))
  };
  await writeJson(catalogPath, catalog);
  return { catalog, built };
}

async function activate(channelId, { force = false } = {}) {
  const channel = resolveReleaseChannel(channelId);
  const appEnv = process.env.APP_ENV || channel.defaultAppEnv;
  assertChannelActivatable(channel, { appEnv, force });

  // Ensure channel build exists
  const manifestPath = path.join(releasesRoot, channel.tag, 'manifest.json');
  let manifest;
  try {
    manifest = await readJson(manifestPath);
  } catch {
    const built = await buildOne(channel.id);
    manifest = built.manifest;
  }

  const active = {
    schema: 'rtpsc-active-release/v1',
    activatedAt: new Date().toISOString(),
    appEnv,
    channel: manifest.channel,
    display: manifest.display,
    buildId: manifest.buildId,
    brandVersion: RELEASE_LINE.brandVersion,
    product: RELEASE_LINE.product,
    gate: manifest.gate,
    sourceManifest: path.relative(root, manifestPath)
  };
  await writeJson(activePath, active);
  return active;
}

async function status() {
  let active = null;
  try {
    active = await readJson(activePath);
  } catch {
    active = null;
  }
  const envChannel = resolveChannelFromEnv();
  return {
    product: RELEASE_LINE.product,
    brandVersion: RELEASE_LINE.brandVersion,
    defaultChannel: DEFAULT_RELEASE_CHANNEL,
    envChannel,
    active,
    channels: listReleaseChannels().map((c) => ({
      id: c.id,
      tag: c.tag,
      description: c.description,
      productionReady: c.productionReady
    }))
  };
}

function printList() {
  console.log(`${RELEASE_LINE.product} — release channels\n`);
  for (const channel of listReleaseChannels()) {
    const ready = channel.productionReady ? 'prod-ready' : 'pre-prod';
    console.log(
      `  ${channel.tag.padEnd(16)} ${channel.description.padEnd(34)} [${ready}]  semver=${channel.semver}`
    );
  }
  console.log(`\nDefault activate target: ${DEFAULT_RELEASE_CHANNEL}`);
  console.log('Env override: RTP_RELEASE_CHANNEL=<id|tag>');
}

function usage() {
  return `rtpsc release — Ross Tax Pro Software Co 02.0V channel builds

Usage:
  ./rtpsc release list
  ./rtpsc release describe <channel>
  ./rtpsc release build [channel|all]
  ./rtpsc release activate <channel> [--force]
  ./rtpsc release status
  ./rtpsc release path <channel>

Channels: ${listReleaseChannels()
    .map((c) => c.tag)
    .join(', ')}
`;
}

async function main(argv = process.argv.slice(2)) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(usage());
    return;
  }

  if (cmd === 'list') {
    printList();
    return;
  }

  if (cmd === 'describe') {
    const target = rest[0];
    if (!target) throw Object.assign(new Error('describe requires a channel'), { code: 'usage' });
    console.log(JSON.stringify(describeReleaseChannel(target), null, 2));
    return;
  }

  if (cmd === 'path') {
    const target = rest[0];
    if (!target) throw Object.assign(new Error('path requires a channel'), { code: 'usage' });
    console.log(JSON.stringify({ from: target, path: promotionPath(target) }, null, 2));
    return;
  }

  if (cmd === 'build') {
    const target = rest[0] || 'all';
    if (target === 'all') {
      const result = await buildAll();
      console.log(
        JSON.stringify(
          {
            ok: true,
            built: result.built.length,
            catalog: path.relative(root, catalogPath),
            channels: result.built.map((b) => b.channel.tag)
          },
          null,
          2
        )
      );
      return;
    }
    await ensurePlatformManifest();
    const built = await buildOne(target);
    console.log(
      JSON.stringify({ ok: true, channel: built.channel.tag, manifest: path.relative(root, built.outFile) }, null, 2)
    );
    return;
  }

  if (cmd === 'activate') {
    const target = rest[0];
    if (!target) throw Object.assign(new Error('activate requires a channel'), { code: 'usage' });
    const force = rest.includes('--force');
    const active = await activate(target, { force });
    console.log(JSON.stringify({ ok: true, active }, null, 2));
    return;
  }

  if (cmd === 'status') {
    console.log(JSON.stringify(await status(), null, 2));
    return;
  }

  throw Object.assign(new Error(`Unknown release subcommand: ${cmd}\n\n${usage()}`), { code: 'usage' });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = error.code === 'usage' || error.code === 'unknown_release_channel' ? 1 : 1;
  });
}

export { main as runReleaseCli };
