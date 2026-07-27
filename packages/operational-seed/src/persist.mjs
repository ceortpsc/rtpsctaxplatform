import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Durable JSON document store under logs/operational (gitignored). */
export function resolveOperationalDataDir(cwd = process.cwd()) {
  return path.resolve(cwd, 'logs', 'operational');
}

export function resolveSeedManifestPath(cwd = process.cwd()) {
  return path.join(resolveOperationalDataDir(cwd), 'seed-manifest.json');
}

export async function readJsonFile(filePath, fallback = null) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && (error.code === 'ENOENT' || error.name === 'SyntaxError')) return fallback;
    throw error;
  }
}

export async function writeJsonFile(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return filePath;
}

export function createJsonDocumentStore(filePath) {
  return {
    path: filePath,
    async load(fallback = null) {
      return readJsonFile(filePath, fallback);
    },
    async save(data) {
      return writeJsonFile(filePath, data);
    }
  };
}
