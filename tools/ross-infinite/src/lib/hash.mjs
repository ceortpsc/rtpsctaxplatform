import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';

export function sha256(bufferOrString) {
  return createHash('sha256').update(bufferOrString).digest('hex');
}

export async function sha256File(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

export async function sha256FileContents(filePath) {
  return sha256(await readFile(filePath));
}

export function digestUri(hex, algorithm = 'sha256') {
  return `${algorithm}:${hex}`;
}
