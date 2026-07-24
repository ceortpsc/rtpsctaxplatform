import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';

/**
 * Discover workspaces from root package.json `workspaces` globs.
 * Supports patterns like "packages/*" only (sufficient for this monorepo).
 */
export async function loadRootManifest(root) {
  const raw = await readFile(path.join(root, 'package.json'), 'utf8');
  return JSON.parse(raw);
}

export async function discoverWorkspaces(root, patterns = []) {
  const found = [];
  for (const pattern of patterns) {
    if (!pattern.endsWith('/*')) {
      const abs = path.join(root, pattern);
      const pkg = await readPackage(abs, root);
      if (pkg) found.push(pkg);
      continue;
    }
    const dir = path.join(root, pattern.slice(0, -2));
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pkg = await readPackage(path.join(dir, entry.name), root);
      if (pkg) found.push(pkg);
    }
  }
  found.sort((a, b) => a.name.localeCompare(b.name));
  return found;
}

async function readPackage(dir, root) {
  const file = path.join(dir, 'package.json');
  try {
    await access(file);
  } catch {
    return null;
  }
  const pkg = JSON.parse(await readFile(file, 'utf8'));
  if (!pkg.name) return null;
  return {
    name: pkg.name,
    version: pkg.version || '0.0.0',
    private: Boolean(pkg.private),
    scripts: pkg.scripts || {},
    dependencies: pkg.dependencies || {},
    devDependencies: pkg.devDependencies || {},
    location: path.relative(root, dir).split(path.sep).join('/'),
    dir
  };
}

export function workspaceByName(workspaces, name) {
  return workspaces.find((w) => w.name === name || w.location === name || w.location.endsWith(`/${name}`));
}
