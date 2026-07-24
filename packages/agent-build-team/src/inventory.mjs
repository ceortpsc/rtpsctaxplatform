import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { DESIGN_STYLE_GUIDANCE } from './design-style.mjs';

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

async function collectFiles(dir, extensions, acc = [], relativeBase = dir) {
  if (!(await exists(dir))) return acc;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      await collectFiles(abs, extensions, acc, relativeBase);
    } else if (extensions.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
      acc.push(path.relative(relativeBase, abs).split(path.sep).join('/'));
    }
  }
  return acc;
}

async function inspectPresentation(absModuleDir, location, readmeExists) {
  const publicDir = path.join(absModuleDir, 'public');
  const hasPublic = await exists(publicDir);
  const styleRoots = hasPublic ? [publicDir, absModuleDir] : [absModuleDir];
  const styleFiles = [];
  const htmlFiles = [];
  const svgFiles = [];

  for (const root of styleRoots) {
    const css = await collectFiles(root, ['.css'], [], absModuleDir);
    const html = await collectFiles(root, ['.html', '.htm'], [], absModuleDir);
    const svg = await collectFiles(root, ['.svg'], [], absModuleDir);
    for (const file of css) if (!styleFiles.includes(file)) styleFiles.push(file);
    for (const file of html) if (!htmlFiles.includes(file)) htmlFiles.push(file);
    for (const file of svg) if (!svgFiles.includes(file)) svgFiles.push(file);
  }

  const publicStyleFiles = styleFiles.filter((file) => file.startsWith('public/'));
  const publicHtmlFiles = htmlFiles.filter((file) => file.startsWith('public/'));
  const publicSvgFiles = svgFiles.filter((file) => file.startsWith('public/'));
  const hasSurface = hasPublic || publicStyleFiles.length > 0 || publicHtmlFiles.length > 0;

  let readmeHasHeading = false;
  let brandMentioned = false;
  if (readmeExists) {
    const readme = await readFile(path.join(absModuleDir, 'README.md'), 'utf8');
    readmeHasHeading = /^#\s+\S+/m.test(readme);
    const lower = readme.toLowerCase();
    brandMentioned = DESIGN_STYLE_GUIDANCE.brandSignals.some((signal) => lower.includes(signal));
  }

  let hasCssVariables = false;
  const styleAntiPatterns = [];
  for (const relative of publicStyleFiles) {
    const cssText = await readFile(path.join(absModuleDir, relative), 'utf8');
    if (/--[a-z][\w-]*\s*:/i.test(cssText)) hasCssVariables = true;
    for (const look of DESIGN_STYLE_GUIDANCE.avoidedLooks) {
      if (look.pattern.test(cssText)) {
        styleAntiPatterns.push({
          id: look.id,
          message: look.message,
          path: path.join(location, relative)
        });
      }
    }
  }

  return {
    hasSurface,
    publicDir: hasPublic ? path.join(location, 'public') : null,
    styleFiles: publicStyleFiles,
    htmlFiles: publicHtmlFiles,
    svgFiles: publicSvgFiles,
    readmeHasHeading,
    brandMentioned,
    hasCssVariables,
    styleAntiPatterns
  };
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

      const presentation = await inspectPresentation(abs, location, readmeExists);

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
        hasHardcodedSecretHint: false,
        presentation
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
        status: module.status,
        presentationSurface: Boolean(module.presentation?.hasSurface)
      }))
    }))
  };
}
