import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { IP, copyrightJson } from './ip.mjs';
import { loadConfig } from './config.mjs';

export async function registerProduct(root, { channel = 'internal' } = {}) {
  const config = await loadConfig(root);
  const registeredAt = new Date().toISOString();
  const entry = {
    registry: 'ROSS.CO Product Register',
    channel,
    product: IP.productFull,
    version: IP.version,
    domain: config.brand.domain,
    registeredAt,
    copyright: copyrightJson(),
    transferMode: config.transfer.mode,
    lifecycleStages: config.lifecycle.stages,
    status: 'registered_prototype',
    artifacts: [
      'tools/rossco',
      'rossco.config.json',
      'presence/rossco',
      'docs/rossco-itr-package-manager.md'
    ]
  };

  const outDir = path.join(root, 'build');
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'rossco-registry.json');
  await writeFile(outPath, `${JSON.stringify(entry, null, 2)}\n`);

  return { entry, outPath };
}
