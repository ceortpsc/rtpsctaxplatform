import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { IP } from './ip.mjs';
import { LIFECYCLE_STAGES } from './lifecycle.mjs';

export const CONFIG_FILE_NAME = 'rossco.config.json';

export const DEFAULT_CONFIG = Object.freeze({
  $schema: './tools/rossco/rossco.config.schema.json',
  brand: {
    name: 'ROSS.CO',
    expansion: 'Infinite Transfer Rate Package Manager',
    tagline: 'Transfer without ceiling.',
    domain: 'ross.co',
    mark: '◈'
  },
  transfer: {
    mode: 'infinite',
    parallel: true,
    delegateLinker: 'aol'
  },
  lifecycle: {
    stages: LIFECYCLE_STAGES.map((stage) => stage.id)
  },
  presence: {
    siteRoot: 'presence/rossco',
    seo: {
      title: 'ROSS.CO — Infinite Transfer Rate Package Manager',
      description:
        'ROSS.CO ITR is the RTPSC package-velocity lifecycle suite: map, plan, scope, stage, test, validate, verify, register, and publish.',
      canonical: 'https://ross.co/'
    }
  },
  copyright: {
    holder: IP.copyrightHolder,
    year: IP.copyrightYear,
    spdx: IP.spdxLicense
  }
});

export async function loadConfig(root) {
  const filePath = path.join(root, CONFIG_FILE_NAME);
  try {
    await access(filePath);
    const raw = JSON.parse(await readFile(filePath, 'utf8'));
    return {
      ...DEFAULT_CONFIG,
      ...raw,
      brand: { ...DEFAULT_CONFIG.brand, ...(raw.brand || {}) },
      transfer: { ...DEFAULT_CONFIG.transfer, ...(raw.transfer || {}) },
      lifecycle: { ...DEFAULT_CONFIG.lifecycle, ...(raw.lifecycle || {}) },
      presence: { ...DEFAULT_CONFIG.presence, ...(raw.presence || {}) },
      copyright: { ...DEFAULT_CONFIG.copyright, ...(raw.copyright || {}) }
    };
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

export async function initConfig(root) {
  const filePath = path.join(root, CONFIG_FILE_NAME);
  await writeFile(filePath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
  return DEFAULT_CONFIG;
}

export async function writeConfig(root, config) {
  const filePath = path.join(root, CONFIG_FILE_NAME);
  await writeFile(filePath, `${JSON.stringify(config, null, 2)}\n`);
  return config;
}
