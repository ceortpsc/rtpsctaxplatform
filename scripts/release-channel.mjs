#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDir, '..');
const defaultConfigPath = path.join(repositoryRoot, 'config', 'release-channels.json');
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const TAG = /^v\d+\.\d+-(?:dev|alpha|beta|rc1|stable|lts|enterprise|hotfix)$/;
const REQUIRED_CHANNELS = ['dev', 'alpha', 'beta', 'rc1', 'stable', 'lts', 'enterprise', 'hotfix'];

export function loadReleaseConfig(configPath = defaultConfigPath) {
  const resolved = configPath instanceof URL ? fileURLToPath(configPath) : path.resolve(configPath);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to load release-channel configuration at ${resolved}: ${error.message}`);
  }
  validateReleaseConfig(parsed);
  return parsed;
}

export function validateReleaseConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Release-channel configuration must be a JSON object.');
  }
  if (typeof config.product !== 'string' || config.product.trim().length < 3) errors.push('product must be a non-empty string');
  if (!/^\d+\.\d+$/.test(String(config.majorMinor ?? ''))) errors.push('majorMinor must use major.minor format');
  if (!Array.isArray(config.channels) || config.channels.length === 0) errors.push('channels must be a non-empty array');
  if (errors.length) throw new Error(`Invalid release-channel configuration: ${errors.join('; ')}`);

  const ids = new Set();
  const tags = new Set();
  const semanticVersions = new Set();
  for (const [index, channel] of config.channels.entries()) {
    const prefix = `channels[${index}]`;
    if (!channel || typeof channel !== 'object' || Array.isArray(channel)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    if (!/^[a-z][a-z0-9-]*$/.test(String(channel.id ?? ''))) errors.push(`${prefix}.id is invalid`);
    if (ids.has(channel.id)) errors.push(`${prefix}.id duplicates ${channel.id}`);
    ids.add(channel.id);
    if (!TAG.test(String(channel.tag ?? ''))) errors.push(`${prefix}.tag must match v<major>.<minor>-<channel>`);
    if (tags.has(channel.tag)) errors.push(`${prefix}.tag duplicates ${channel.tag}`);
    tags.add(channel.tag);
    if (!SEMVER.test(String(channel.semanticVersion ?? ''))) errors.push(`${prefix}.semanticVersion is not valid SemVer`);
    if (semanticVersions.has(channel.semanticVersion)) errors.push(`${prefix}.semanticVersion duplicates ${channel.semanticVersion}`);
    semanticVersions.add(channel.semanticVersion);
    if (!Number.isInteger(channel.stability) || channel.stability < 0 || channel.stability > 100) errors.push(`${prefix}.stability must be an integer from 0 to 100`);
    if (!Array.isArray(channel.audience) || channel.audience.length === 0) errors.push(`${prefix}.audience must not be empty`);
    if (!Array.isArray(channel.sourceBranches) || channel.sourceBranches.length === 0) errors.push(`${prefix}.sourceBranches must not be empty`);
    if (!Array.isArray(channel.promotionTargets)) errors.push(`${prefix}.promotionTargets must be an array`);
    if (typeof channel.prerelease !== 'boolean') errors.push(`${prefix}.prerelease must be boolean`);
    if (typeof channel.deploymentEnvironment !== 'string' || !channel.deploymentEnvironment) errors.push(`${prefix}.deploymentEnvironment is required`);
    if (typeof channel.supportPolicy !== 'string' || !channel.supportPolicy) errors.push(`${prefix}.supportPolicy is required`);
  }

  for (const required of REQUIRED_CHANNELS) {
    if (!ids.has(required)) errors.push(`missing required channel ${required}`);
  }
  if (!ids.has(config.defaultChannel)) errors.push(`defaultChannel ${config.defaultChannel} is not defined`);
  for (const channel of config.channels) {
    for (const target of channel.promotionTargets ?? []) {
      if (!ids.has(target)) errors.push(`${channel.id}.promotionTargets references unknown channel ${target}`);
    }
  }
  const stable = config.channels.find((channel) => channel.id === 'stable');
  if (stable?.semanticVersion !== `${config.majorMinor}.0`) errors.push(`stable semanticVersion must equal ${config.majorMinor}.0`);
  if (stable?.prerelease !== false) errors.push('stable must not be marked prerelease');

  if (errors.length) throw new Error(`Invalid release-channel configuration: ${errors.join('; ')}`);
  return true;
}

export function resolveChannel(config, idOrTag) {
  const requested = String(idOrTag ?? config.defaultChannel).trim().toLowerCase();
  const channel = config.channels.find((candidate) => candidate.id === requested || candidate.tag.toLowerCase() === requested);
  if (!channel) throw new Error(`Unknown release channel: ${idOrTag}. Valid channels: ${config.channels.map(({ id }) => id).join(', ')}`);
  return channel;
}

export function canPromote(config, from, to) {
  const source = resolveChannel(config, from);
  const target = resolveChannel(config, to);
  return source.promotionTargets.includes(target.id);
}

function gitValue(args, fallback = 'unknown') {
  try {
    return execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || fallback;
  } catch {
    return fallback;
  }
}

export function createReleaseManifest(config, idOrTag, options = {}) {
  const channel = resolveChannel(config, idOrTag);
  const sourceDate = options.createdAt ?? process.env.SOURCE_DATE_EPOCH;
  let createdAt;
  if (sourceDate && /^\d+$/.test(String(sourceDate))) createdAt = new Date(Number(sourceDate) * 1000).toISOString();
  else if (sourceDate) createdAt = new Date(sourceDate).toISOString();
  else createdAt = new Date().toISOString();

  return {
    schemaVersion: 1,
    product: config.product,
    releaseLine: config.majorMinor,
    channel: channel.id,
    tag: channel.tag,
    semanticVersion: channel.semanticVersion,
    displayName: channel.displayName,
    description: channel.description,
    prerelease: channel.prerelease,
    stability: channel.stability,
    deploymentEnvironment: channel.deploymentEnvironment,
    supportPolicy: channel.supportPolicy,
    audience: [...channel.audience],
    sourceBranches: [...channel.sourceBranches],
    promotionTargets: [...channel.promotionTargets],
    commitSha: options.commitSha ?? process.env.GITHUB_SHA ?? gitValue(['rev-parse', 'HEAD']),
    sourceBranch: options.sourceBranch ?? process.env.GITHUB_REF_NAME ?? gitValue(['branch', '--show-current']),
    repository: options.repository ?? process.env.GITHUB_REPOSITORY ?? 'ceortpsc/rtpsctaxplatform',
    generatedAt: createdAt
  };
}

function writeManifest(manifest, outputPath) {
  const resolved = path.resolve(repositoryRoot, outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
  return resolved;
}

function printList(config, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(config.channels, null, 2)}\n`);
    return;
  }
  const rows = config.channels.map((channel) => ({
    channel: channel.id,
    tag: channel.tag,
    version: channel.semanticVersion,
    environment: channel.deploymentEnvironment,
    prerelease: channel.prerelease ? 'yes' : 'no',
    stability: `${channel.stability}%`
  }));
  console.table(rows);
}

function parseArguments(argv) {
  const positionals = [];
  const flags = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      positionals.push(value);
      continue;
    }
    const [rawName, inlineValue] = value.slice(2).split('=', 2);
    if (inlineValue !== undefined) flags.set(rawName, inlineValue);
    else if (argv[index + 1] && !argv[index + 1].startsWith('--')) flags.set(rawName, argv[++index]);
    else flags.set(rawName, true);
  }
  return { positionals, flags };
}

function usage() {
  return `Usage: node scripts/release-channel.mjs <command> [channel] [options]\n\nCommands:\n  validate                         Validate the complete release-channel registry\n  list [--json]                    List all channels\n  show <channel> [--json]          Show one resolved channel\n  manifest <channel> [--output p]  Generate a signed-input-ready JSON manifest\n  promote <from> <to>              Validate an allowed promotion path\n  github-output <channel>          Emit values for GITHUB_OUTPUT\n`;
}

export function runCli(argv = process.argv.slice(2)) {
  const { positionals, flags } = parseArguments(argv);
  const [command = 'list', first, second] = positionals;
  const configPath = flags.get('config') || defaultConfigPath;
  const config = loadReleaseConfig(configPath);
  const json = flags.has('json');

  switch (command) {
    case 'validate':
      process.stdout.write(`PASS: ${config.channels.length} release channels validated for ${config.product}.\n`);
      return 0;
    case 'list':
      printList(config, json);
      return 0;
    case 'show': {
      const channel = resolveChannel(config, first);
      process.stdout.write(json ? `${JSON.stringify(channel, null, 2)}\n` : `${channel.tag} (${channel.semanticVersion}) — ${channel.description}\n`);
      return 0;
    }
    case 'manifest': {
      const manifest = createReleaseManifest(config, first);
      const output = flags.get('output');
      if (output) {
        const resolved = writeManifest(manifest, output);
        process.stdout.write(`${resolved}\n`);
      } else process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
      return 0;
    }
    case 'promote':
      if (!canPromote(config, first, second)) throw new Error(`Promotion from ${first} to ${second} is not allowed.`);
      process.stdout.write(`PASS: promotion ${resolveChannel(config, first).id} -> ${resolveChannel(config, second).id} is allowed.\n`);
      return 0;
    case 'github-output': {
      const channel = resolveChannel(config, first);
      const lines = [
        `channel=${channel.id}`,
        `tag=${channel.tag}`,
        `semantic_version=${channel.semanticVersion}`,
        `display_name=${channel.displayName}`,
        `deployment_environment=${channel.deploymentEnvironment}`,
        `prerelease=${channel.prerelease}`
      ];
      process.stdout.write(`${lines.join('\n')}\n`);
      return 0;
    }
    case 'help':
    case '--help':
    case '-h':
      process.stdout.write(usage());
      return 0;
    default:
      throw new Error(`Unknown command: ${command}\n${usage()}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runCli();
  } catch (error) {
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exitCode = 1;
  }
}
