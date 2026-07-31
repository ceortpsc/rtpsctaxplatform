#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createReleaseManifest,
  loadReleaseConfig
} from './release-channel.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArguments(argv) {
  const options = {
    clean: false,
    outputDir: path.join(repositoryRoot, 'build', 'releases')
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--clean') options.clean = true;
    else if (value === '--output-dir') options.outputDir = path.resolve(repositoryRoot, argv[++index]);
    else if (value.startsWith('--output-dir=')) options.outputDir = path.resolve(repositoryRoot, value.slice('--output-dir='.length));
    else if (value === '--commit') options.commitSha = argv[++index];
    else if (value.startsWith('--commit=')) options.commitSha = value.slice('--commit='.length);
    else if (value === '--branch') options.sourceBranch = argv[++index];
    else if (value.startsWith('--branch=')) options.sourceBranch = value.slice('--branch='.length);
    else if (value === '--repository') options.repository = argv[++index];
    else if (value.startsWith('--repository=')) options.repository = value.slice('--repository='.length);
    else if (value === '--created-at') options.createdAt = argv[++index];
    else if (value.startsWith('--created-at=')) options.createdAt = value.slice('--created-at='.length);
    else throw new Error(`Unknown option: ${value}`);
  }
  return options;
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

export async function buildAllReleaseChannels(options = {}) {
  const config = loadReleaseConfig();
  const outputDir = options.outputDir ?? path.join(repositoryRoot, 'build', 'releases');
  if (options.clean) await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const shared = {
    commitSha: options.commitSha,
    sourceBranch: options.sourceBranch,
    repository: options.repository,
    createdAt: options.createdAt
  };
  const files = [];
  const checksums = [];

  for (const channel of config.channels) {
    const manifest = createReleaseManifest(config, channel.id, shared);
    const filename = `${channel.tag}.json`;
    const content = `${JSON.stringify(manifest, null, 2)}\n`;
    await writeFile(path.join(outputDir, filename), content, 'utf8');
    files.push(filename);
    checksums.push(`${sha256(content)}  ${filename}`);
  }

  const catalog = {
    schemaVersion: 1,
    product: config.product,
    releaseLine: config.majorMinor,
    defaultChannel: config.defaultChannel,
    channelCount: config.channels.length,
    registry: 'config/release-channels.json',
    commitSha: shared.commitSha ?? process.env.GITHUB_SHA ?? 'resolved-per-manifest',
    sourceBranch: shared.sourceBranch ?? process.env.GITHUB_REF_NAME ?? 'resolved-per-manifest',
    generatedAt: options.createdAt ?? new Date().toISOString(),
    files
  };
  const catalogContent = `${JSON.stringify(catalog, null, 2)}\n`;
  await writeFile(path.join(outputDir, 'catalog.json'), catalogContent, 'utf8');
  checksums.push(`${sha256(catalogContent)}  catalog.json`);
  await writeFile(path.join(outputDir, 'SHA256SUMS'), `${checksums.join('\n')}\n`, 'utf8');

  return {
    ok: true,
    product: config.product,
    defaultChannel: config.defaultChannel,
    channelCount: config.channels.length,
    outputDir: path.relative(repositoryRoot, outputDir),
    files: [...files, 'catalog.json', 'SHA256SUMS'],
    gitTagsCreated: false,
    githubReleasesCreated: false,
    externalRuntimeDeploymentClaimed: false
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await buildAllReleaseChannels(parseArguments(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exitCode = 1;
  }
}
