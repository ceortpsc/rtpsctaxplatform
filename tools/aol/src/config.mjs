import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { AolError } from './codes.mjs';

export const CONFIG_FILE_NAME = 'aol.config.json';

/** Default constellation configuration — conceptual AOL PM settings. */
export const DEFAULT_CONFIG = Object.freeze({
  $schema: './tools/aol/aol.config.schema.json',
  brand: {
    name: 'AOL',
    expansion: 'Adaptive Optimized Linker',
    tagline: "You've got packages.",
    chevron: '▲',
    aesthetic: 'instant-messenger-signal'
  },
  install: {
    parallel: true,
    force: false,
    lockfile: 'aol.lock.json',
    cacheHit: true
  },
  ui: {
    color: true,
    buddyList: true,
    handshake: true,
    quiet: false
  },
  bench: {
    rounds: 3,
    compareWith: 'npm'
  },
  workspaces: {
    // null → inherit from package.json workspaces
    patterns: null
  },
  api: {
    version: '0.1.0',
    jsonDefault: false
  },
  ip: {
    copyrightHolder: 'RTPSC / Ross Tax Software',
    copyrightYear: 2026,
    spdxLicense: 'MIT',
    productNotice: 'AOL Adaptive Optimized Linker',
    disclaimer:
      'Not affiliated with, endorsed by, or related to America Online, AOL LLC, or Yahoo.'
  }
});

export async function loadConfig(root = process.cwd()) {
  const file = path.join(root, CONFIG_FILE_NAME);
  let fileConfig = {};
  try {
    await access(file);
    fileConfig = JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT' && !(err instanceof SyntaxError)) {
      // missing is fine; corrupt is not
    }
    if (err instanceof SyntaxError) {
      throw new AolError('CONFIG_INVALID', err.message);
    }
  }
  const envOverlay = envConfig();
  return mergeDeep(clone(DEFAULT_CONFIG), fileConfig, envOverlay);
}

export async function writeConfig(root, config) {
  const file = path.join(root, CONFIG_FILE_NAME);
  const body = { ...config };
  delete body.$schema;
  body.$schema = './tools/aol/aol.config.schema.json';
  await writeFile(file, `${JSON.stringify(body, null, 2)}\n`);
  return file;
}

export async function initConfig(root, { force = false } = {}) {
  const file = path.join(root, CONFIG_FILE_NAME);
  if (!force) {
    try {
      await access(file);
      throw new AolError('CONFIG_INVALID', `${CONFIG_FILE_NAME} already exists (use --force)`);
    } catch (err) {
      if (err instanceof AolError) throw err;
      // ENOENT → ok to create
    }
  }
  return writeConfig(root, clone(DEFAULT_CONFIG));
}

export function getConfigValue(config, dottedKey) {
  const parts = dottedKey.split('.');
  let cur = config;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object' || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function setConfigValue(config, dottedKey, rawValue) {
  const readonly = new Set(['$schema', 'ip.copyrightHolder', 'ip.spdxLicense', 'brand.name']);
  if (readonly.has(dottedKey)) {
    throw new AolError('CONFIG_READONLY', dottedKey);
  }
  const parts = dottedKey.split('.');
  const next = clone(config);
  let cur = next;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const p = parts[i];
    if (typeof cur[p] !== 'object' || cur[p] == null) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = coerce(rawValue);
  return next;
}

function envConfig() {
  const out = {};
  if (process.env.AOL_NO_COLOR === '1' || process.env.NO_COLOR) {
    out.ui = { color: false };
  }
  if (process.env.AOL_QUIET === '1') {
    out.ui = { ...(out.ui || {}), quiet: true };
  }
  if (process.env.AOL_FORCE === '1') {
    out.install = { force: true };
  }
  if (process.env.AOL_BENCH_ROUNDS) {
    out.bench = { rounds: Number(process.env.AOL_BENCH_ROUNDS) || 3 };
  }
  return out;
}

function coerce(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeDeep(a, b, c = {}) {
  return mergeTwo(mergeTwo(a, b), c);
}

function mergeTwo(base, overlay) {
  if (!overlay || typeof overlay !== 'object') return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(overlay)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object' && base[k]) {
      out[k] = mergeTwo(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
