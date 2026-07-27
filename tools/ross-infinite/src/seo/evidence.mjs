import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

export async function writeEvidenceReceipt(root, evidenceDir, kind, payload) {
  const dir = path.join(root, evidenceDir);
  await mkdir(dir, { recursive: true });
  const stamped = {
    kind,
    product: 'ROSS.CO Infinite SEO Ownership Agent',
    generatedAt: new Date().toISOString(),
    ...payload
  };
  const body = `${JSON.stringify(stamped, null, 2)}\n`;
  const digest = sha256Hex(body);
  const fileName = `${kind}-${Date.now()}-${digest.slice(0, 12)}.json`;
  const outPath = path.join(dir, fileName);
  await writeFile(outPath, body, 'utf8');
  const sidecar = `${outPath}.sha256`;
  await writeFile(sidecar, `${digest}  ${fileName}\n`, 'utf8');
  return { outPath: path.relative(root, outPath), sidecar: path.relative(root, sidecar), digest, stamped };
}
