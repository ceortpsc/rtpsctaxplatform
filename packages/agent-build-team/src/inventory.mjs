import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

/** Developmental sectors covered by the Agent Build Engineering Team. */
export const DEVELOPMENTAL_SECTORS = Object.freeze([
  'packages',
  'services',
  'workers',
  'pipelines',
  'engines',
  'tools'
]);

const SECTOR_KIND = Object.freeze({
  packages: 'package',
  services: 'service',
  workers: 'worker',
  pipelines: 'pipeline',
  engines: 'engine',
  tools: 'tool'
});

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

/**
 * Discover every developmental project/module under the monorepo sectors.
 * @param {string} [rootDir=process.cwd()]
 */
export async function inventModules(rootDir = process.cwd()) {
  const modules = [];

  for (const sector of DEVELOPMENTAL_SECTORS) {
    const sectorDir = path.join(rootDir, sector);
    if (!(await exists(sectorDir))) continue;

    const entries = await readdir(sectorDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;

      const location = path.join(sector, entry.name);
      const abs = path.join(rootDir, location);
      const packageJsonPath = path.join(abs, 'package.json');
      const entryPath = path.join(abs, 'src', 'index.mjs');
      const readmePath = path.join(abs, 'README.md');

      const packageJsonExists = await exists(packageJsonPath);
      let packageName = null;
      let version = null;
      let type = null;
      let scripts = {};
      let dependencies = [];
      let summary = '';
      let privatePkg = true;

      if (packageJsonExists) {
        const pkg = await readJson(packageJsonPath);
        packageName = pkg.name ?? null;
        version = pkg.version ?? null;
        type = pkg.type ?? null;
        scripts = pkg.scripts ?? {};
        privatePkg = Boolean(pkg.private);
        summary = pkg.description ?? '';
        dependencies = [
          ...Object.keys(pkg.dependencies || {}),
          ...Object.keys(pkg.devDependencies || {})
        ];
      }

      const entryExists = await exists(entryPath);
      const readmeExists = await exists(readmePath);
      let status = 'active';
      if (entry.name.includes('secure-tunnel')) status = 'stub';

      modules.push({
        name: entry.name,
        packageName,
        version,
        type,
        private: privatePkg,
        sector,
        kind: SECTOR_KIND[sector] ?? 'module',
        location,
        entry: entryExists ? path.join(location, 'src', 'index.mjs') : null,
        entryExists,
        packageJsonExists,
        readmeExists,
        scripts,
        dependencies,
        summary,
        tags: [sector, SECTOR_KIND[sector] ?? 'module'],
        status,
        hasHardcodedSecretHint: false
      });
    }
  }

  modules.sort((a, b) => {
    const sectorCmp = a.sector.localeCompare(b.sector);
    return sectorCmp !== 0 ? sectorCmp : a.name.localeCompare(b.name);
  });

  return modules;
}

/** Group inventory by sector for reports and dashboards. */
export function groupBySector(modules) {
  const groups = {};
  for (const sector of DEVELOPMENTAL_SECTORS) {
    groups[sector] = [];
  }
  for (const module of modules) {
    if (!groups[module.sector]) groups[module.sector] = [];
    groups[module.sector].push(module);
  }
  return groups;
}

/** Compact catalog suitable for JSON APIs and manifests. */
export function describeInventory(modules) {
  const bySector = groupBySector(modules);
  return {
    totalModules: modules.length,
    sectors: DEVELOPMENTAL_SECTORS.map((sector) => ({
      sector,
      count: bySector[sector]?.length ?? 0,
      modules: (bySector[sector] ?? []).map((module) => ({
        name: module.name,
        packageName: module.packageName,
        kind: module.kind,
        location: module.location,
        entryExists: module.entryExists,
        readmeExists: module.readmeExists,
        status: module.status
      }))
    }))
  };
}
