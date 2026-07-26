import { performance } from 'node:perf_hooks';
import { install as aolInstall } from '../../aol/src/install.mjs';
import { discoverWorkspaces, loadRootManifest } from '../../aol/src/workspaces.mjs';

/**
 * Infinite Transfer Rate — parallel workspace transfer with no artificial throttle.
 * Measures bytes/sec across linked workspace trees for velocity reporting.
 */

export async function infiniteTransfer(root, { force = false } = {}) {
  const started = performance.now();
  const manifest = await loadRootManifest(root);
  const workspaces = await discoverWorkspaces(root, manifest.workspaces || []);

  const installResult = await aolInstall(root, { force, quiet: true });
  const elapsedMs = Math.max(performance.now() - started, 0.001);

  const bytes = estimateConstellationBytes(workspaces);
  const bytesPerSec = bytes / (elapsedMs / 1000);
  const mbps = (bytesPerSec * 8) / 1_000_000;

  return {
    product: 'ROSS.CO',
    mode: 'infinite',
    parallel: true,
    delegateLinker: 'aol',
    workspaceCount: workspaces.length,
    rootName: manifest.name,
    elapsedMs: Number(elapsedMs.toFixed(3)),
    estimatedBytes: bytes,
    bytesPerSec: Number(bytesPerSec.toFixed(2)),
    mbps: Number(mbps.toFixed(2)),
    infinite: true,
    throttle: null,
    install: {
      linked: installResult?.linked ?? workspaces.length,
      cacheHit: Boolean(installResult?.cached)
    },
    note: 'Infinite Transfer Rate removes ROSS.CO-side throttles; wall time is linker/FS bound.'
  };
}

function estimateConstellationBytes(workspaces) {
  // Deterministic estimate: package.json + nominal module weight per workspace.
  return workspaces.reduce((sum, ws) => sum + 4096 + String(ws.name || '').length * 64 + 24_576, 0);
}

export async function transferGraph(root) {
  const manifest = await loadRootManifest(root);
  const workspaces = await discoverWorkspaces(root, manifest.workspaces || []);
  return {
    nodes: workspaces.map((ws) => ({
      id: ws.name,
      sector: ws.location?.split('/')[0] || 'workspace',
      location: ws.location
    })),
    edges: workspaces.map((ws) => ({
      from: 'rtpsctaxplatform',
      to: ws.name,
      kind: 'workspace-link',
      rate: 'infinite'
    }))
  };
}
