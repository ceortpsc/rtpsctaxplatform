import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const modules = [
  '../packages/platform-core/src/index.mjs',
  '../packages/client-config/src/index.mjs',
  '../packages/secure-tunnel/src/index.mjs',
  '../services/api-gateway/src/index.mjs',
  '../services/refund-status-service/src/index.mjs',
  '../services/transcript-service/src/index.mjs',
  '../services/analytics-service/src/index.mjs',
  '../workers/tds-worker/src/index.mjs',
  '../workers/transcript-pull-worker/src/index.mjs',
  '../workers/live-source-fetcher/src/index.mjs',
  '../pipelines/transmission-pipeline/src/index.mjs',
  '../pipelines/masterfile-pipeline/src/index.mjs',
  '../pipelines/refund-status-pipeline/src/index.mjs',
  '../engines/refund-intelligence-engine/src/index.mjs',
  '../engines/analytics-center/src/index.mjs',
  '../engines/tc-code-engine/src/index.mjs',
  '../tools/aol/src/index.mjs'
];

const manifest = [];
for (const modulePath of modules) {
  const imported = await import(new URL(modulePath, import.meta.url));
  manifest.push({ modulePath, exports: Object.keys(imported) });
}

await mkdir(path.join(process.cwd(), 'build'), { recursive: true });
await writeFile(
  path.join(process.cwd(), 'build/platform-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
);
console.log('Build scaffold verification passed.');
