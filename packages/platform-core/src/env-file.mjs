import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Load KEY=VALUE pairs from a .env file into process.env without overriding
 * values already set in the environment. Dependency-free (no dotenv package).
 */
export function loadEnvFile(filePath, { override = false } = {}) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { loaded: false, path: filePath, keys: [] };
  }
  const keys = [];
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!override && process.env[key] != null && process.env[key] !== '') continue;
    process.env[key] = value;
    keys.push(key);
  }
  return { loaded: true, path: filePath, keys };
}

/**
 * Resolve and load the first existing env file from common RTPSC locations.
 */
export function loadPlatformEnv({ cwd = process.cwd(), override = false } = {}) {
  const candidates = [
    path.join(cwd, '.env'),
    path.join(cwd, 'env', '.env.local'),
    path.join(cwd, 'env', '.env')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return loadEnvFile(candidate, { override });
    }
  }
  return { loaded: false, path: null, keys: [] };
}

/** Convenience: repo-root relative to this package file when used from packages/* */
export function repoRootFrom(importMetaUrl, up = 3) {
  let dir = path.dirname(fileURLToPath(importMetaUrl));
  for (let i = 0; i < up; i += 1) dir = path.dirname(dir);
  return dir;
}
