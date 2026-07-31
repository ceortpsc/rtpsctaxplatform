#!/usr/bin/env node

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ACTIVE_RELEASE_CHANNEL,
  RELEASE_CHANNELS,
  RELEASE_PRODUCT,
  activeRelease,
  createReleaseManifest,
  evaluatePromotion,
  getReleaseChannel,
  listReleaseChannels,
  releaseCatalogHash,
  validateReleaseCatalog
} from '../packages/release-core/src/index.mjs';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function parseOptions(args) {
  const positional = [];
  const options = { json: false, evidence: [] };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--clean') options.clean = true;
    else if (arg === '--commit') options.commitSha = args[++index];
    else if (arg.startsWith('--commit=')) options.commitSha = arg.slice('--commit='.length);
    else if (arg === '--build-number') options.buildNumber = args[++index];
    else if (arg.startsWith('--build-number=')) options.buildNumber = arg.slice('--build-number='.length);
    else if (arg === '--app-env') options.appEnv = args[++index];
    else if (arg.startsWith('--app-env=')) options.appEnv = arg.slice('--app-env='.length);
    else if (arg === '--gate') options.evidence.push(args[++index]);
    else if (arg.startsWith('--gate=')) options.evidence.push(arg.slice('--gate='.length));
    else if (arg === '--evidence') options.evidence.push(...String(args[++index] ?? '').split(','));
    else if (arg.startsWith('--evidence=')) options.evidence.push(...arg.slice('--evidence='.length).split(','));
    else positional.push(arg);
  }
  options.evidence = options.evidence.map((item) => String(item).trim()).filter(Boolean);
  return { positional, options };
}

function print(value, json = false) {
  if (json || typeof value !== 'string') console.log(JSON.stringify(value, null, 2));
  else console.log(value);
}

function usage() {
  return [
    `${RELEASE_PRODUCT} release manager`,
    '',
    'Usage:',
    '  ./rtpsc version [--json]',
    '  ./rtpsc release current [--json]',
    '  ./rtpsc release list [--json]',
    '  ./rtpsc release show [channel] [--json]',
    '  ./rtpsc release validate [channel|all] [--json]',
    '  ./rtpsc release build [channel|all] [--clean] [--commit SHA] [--build-number N]',
    '  ./rtpsc release promote <from> <to> --evidence gate1,gate2 [--json]',
    '',
    `Active channel: ${activeRelease().tag}`
  ].join('\n');
}

function profileProjection(channel) {
  return {
    key: channel.key,
    publicTag: channel.tag,
    semver: channel.semver,
    stage: channel.stage,
    description: channel.description,
    stability: channel.stability,
    productionEligible: channel.productionEligible,
    supportPolicy: channel.supportPolicy,
    requiredGates: channel.requiredGates,
    allowedPromotionTargets: channel.allowedPromotionTargets
  };
}

async function buildManifests(selection, options) {
  const outputRoot = path.join(repoRoot, 'build', 'releases');
  if (options.clean) await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  const channels = selection === 'all' ? RELEASE_CHANNELS : [getReleaseChannel(selection)];
  const commitSha = options.commitSha ?? process.env.GITHUB_SHA ?? process.env.GIT_COMMIT_SHA ?? 'local-unresolved';
  const buildNumber = options.buildNumber ?? process.env.GITHUB_RUN_NUMBER ?? null;
  const appEnv = options.appEnv ?? process.env.APP_ENV ?? 'local';
  const generated = [];
  const checksums = [];

  for (const channel of channels) {
    const manifest = createReleaseManifest({
      channel: channel.key,
      commitSha,
      buildNumber,
      appEnv,
      evidence: options.evidence
    });
    const channelDir = path.join(outputRoot, channel.tag);
    await mkdir(channelDir, { recursive: true });
    const manifestPath = path.join(channelDir, 'manifest.json');
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    generated.push(path.relative(repoRoot, manifestPath));
    checksums.push(`${manifest.integrity.digest}  ${path.relative(outputRoot, manifestPath).replaceAll('\\', '/')}`);
  }

  const catalog = {
    schemaVersion: '2.0',
    product: RELEASE_PRODUCT,
    activeChannel: ACTIVE_RELEASE_CHANNEL,
    catalogHash: releaseCatalogHash(),
    generatedAt: new Date().toISOString(),
    channels: listReleaseChannels().map(profileProjection)
  };
  await writeFile(path.join(outputRoot, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  await writeFile(path.join(outputRoot, 'SHA256SUMS'), `${checksums.join('\n')}\n`, 'utf8');

  return {
    ok: true,
    selection,
    activeChannel: activeRelease().tag,
    outputRoot: path.relative(repoRoot, outputRoot),
    generated,
    catalog: path.relative(repoRoot, path.join(outputRoot, 'catalog.json')),
    checksums: path.relative(repoRoot, path.join(outputRoot, 'SHA256SUMS')),
    externalDeploymentClaimed: false
  };
}

async function main() {
  const [command = 'current', ...rest] = process.argv.slice(2);
  const { positional, options } = parseOptions(rest);

  try {
    if (['help', '--help', '-h'].includes(command)) {
      console.log(usage());
      return;
    }

    if (command === 'current') {
      print(profileProjection(activeRelease()), options.json);
      return;
    }

    if (command === 'list') {
      if (options.json) print(listReleaseChannels().map(profileProjection), true);
      else {
        const lines = listReleaseChannels().map(
          (channel) => `${channel.tag.padEnd(18)} ${channel.semver.padEnd(28)} ${channel.description}`
        );
        console.log(lines.join('\n'));
      }
      return;
    }

    if (command === 'show') {
      print(profileProjection(getReleaseChannel(positional[0] ?? ACTIVE_RELEASE_CHANNEL)), options.json);
      return;
    }

    if (command === 'validate') {
      const selection = positional[0] ?? 'all';
      const catalog = validateReleaseCatalog();
      const channels = selection === 'all' ? RELEASE_CHANNELS : [getReleaseChannel(selection)];
      const result = {
        ok: catalog.ok,
        catalog,
        channels: channels.map((channel) => ({
          ...profileProjection(channel),
          definitionValid: channel.requiredGates.length > 0 && channel.allowedPromotionTargets.every((target) => getReleaseChannel(target))
        }))
      };
      print(result, true);
      if (!result.ok) process.exitCode = 1;
      return;
    }

    if (command === 'build') {
      const result = await buildManifests(positional[0] ?? ACTIVE_RELEASE_CHANNEL, options);
      print(result, true);
      return;
    }

    if (command === 'promote') {
      if (positional.length < 2) throw new Error('promote requires <from> and <to> channels.');
      const result = evaluatePromotion({ from: positional[0], to: positional[1], evidence: options.evidence });
      print(result, true);
      if (!result.ok) process.exitCode = 2;
      return;
    }

    throw new Error(`Unknown release command "${command}".\n\n${usage()}`);
  } catch (error) {
    console.error(JSON.stringify({ ok: false, code: error.code ?? 'release_command_failed', message: error.message }, null, 2));
    process.exitCode = 1;
  }
}

await main();
