import { discoverWorkspaces, loadRootManifest } from './workspaces.mjs';
import { readLockfile } from './lockfile.mjs';

/**
 * Constellation graph — workspace nodes + conceptual edges from location roots.
 */
export async function graph(root = process.cwd()) {
  const manifest = await loadRootManifest(root);
  const workspaces = await discoverWorkspaces(root, manifest.workspaces || []);
  const lock = await readLockfile(root);

  const nodes = workspaces.map((ws) => ({
    id: ws.name,
    version: ws.version,
    location: ws.location,
    sector: ws.location.split('/')[0] || 'root',
    fingerprint: lock?.packages?.[ws.name]?.fingerprint || null,
    scripts: Object.keys(ws.scripts || {})
  }));

  const sectors = [...new Set(nodes.map((n) => n.sector))].sort();
  const edges = [];
  for (const sector of sectors) {
    edges.push({ from: 'rtpsctaxplatform', to: `sector:${sector}`, kind: 'contains' });
    for (const n of nodes.filter((x) => x.sector === sector)) {
      edges.push({ from: `sector:${sector}`, to: n.id, kind: 'workspace' });
    }
  }

  return {
    root: manifest.name,
    version: manifest.version,
    nodeCount: nodes.length,
    sectors,
    nodes,
    edges
  };
}

export async function mailStatus(root = process.cwd()) {
  const g = await graph(root);
  const lock = await readLockfile(root);
  return {
    greeting: "You've got status.",
    root: g.root,
    workspaces: g.nodeCount,
    sectors: g.sectors,
    lockfile: Boolean(lock),
    lockedPackages: lock ? Object.keys(lock.packages || {}).length : 0,
    generator: lock?.generator || null,
    createdAt: lock?.createdAt || null
  };
}
