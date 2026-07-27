import { createReadStream, createWriteStream } from 'node:fs';
import { open, mkdir, rename, access, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { sha256File, digestUri } from './hash.mjs';

const DEFAULT_CHUNK = 1024 * 1024;

export function planChunkRanges(size, chunkSize = DEFAULT_CHUNK) {
  if (!Number.isInteger(size) || size < 0) throw new Error('size must be a non-negative integer');
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) throw new Error('chunkSize must be a positive integer');
  if (size === 0) return [{ index: 0, start: 0, end: 0, length: 0 }];
  const ranges = [];
  let start = 0;
  let index = 0;
  while (start < size) {
    const end = Math.min(size, start + chunkSize);
    ranges.push({ index, start, end, length: end - start });
    start = end;
    index += 1;
  }
  assertCoverage(ranges, size);
  return ranges;
}

export function assertCoverage(ranges, size) {
  if (ranges.length === 0) throw new Error('no ranges');
  let cursor = 0;
  for (const range of ranges) {
    if (range.start !== cursor) throw new Error(`gap or overlap at ${cursor}`);
    cursor = range.end;
  }
  if (cursor !== size) throw new Error(`coverage mismatch: ${cursor} !== ${size}`);
}

/**
 * Verified, resumable local-file transfer with optional concurrency.
 * "Infinite" = adaptive parallel streams up to available capacity; not unlimited bandwidth.
 */
export async function transferFile(sourcePath, destPath, {
  chunkSize = DEFAULT_CHUNK,
  concurrency = 4,
  resume = true
} = {}) {
  const started = Date.now();
  const handle = await open(sourcePath, 'r');
  let size;
  try {
    size = (await handle.stat()).size;
  } finally {
    await handle.close();
  }

  const ranges = planChunkRanges(size, chunkSize);
  await mkdir(path.dirname(destPath), { recursive: true });
  const partialPath = `${destPath}.ross-partial`;
  const statePath = `${destPath}.ross-state.json`;

  let completed = new Set();
  if (resume) {
    try {
      const prior = JSON.parse(await readFile(statePath, 'utf8'));
      if (prior.sourceDigestPending !== true && Array.isArray(prior.completed)) {
        completed = new Set(prior.completed);
      }
    } catch {
      // fresh transfer
    }
  }

  // Ensure partial file exists with correct size
  {
    const fh = await open(partialPath, 'w+');
    try {
      if (size > 0) await fh.truncate(size);
    } finally {
      await fh.close();
    }
  }

  const pending = ranges.filter((r) => !completed.has(r.index));
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, pending.length || 1)) }, async () => {
    while (cursor < pending.length) {
      const idx = cursor;
      cursor += 1;
      const range = pending[idx];
      if (!range) break;
      await copyRange(sourcePath, partialPath, range);
      completed.add(range.index);
      await writeFile(
        statePath,
        JSON.stringify(
          {
            sourcePath,
            destPath,
            size,
            chunkSize,
            completed: [...completed].sort((a, b) => a - b),
            updatedAt: new Date().toISOString()
          },
          null,
          2
        ),
        'utf8'
      );
    }
  });
  await Promise.all(workers);

  const sourceDigest = await sha256File(sourcePath);
  const destDigest = await sha256File(partialPath);
  if (sourceDigest !== destDigest) {
    throw new Error(`digest mismatch: source=${sourceDigest} dest=${destDigest}`);
  }

  await rename(partialPath, destPath);
  try {
    await unlink(statePath);
  } catch {
    // ignore
  }

  const elapsedMs = Date.now() - started;
  const mbps = elapsedMs > 0 ? Number(((size / (1024 * 1024)) / (elapsedMs / 1000)).toFixed(3)) : 0;
  return {
    sourcePath,
    destPath,
    bytes: size,
    chunks: ranges.length,
    concurrency,
    digest: digestUri(sourceDigest),
    elapsedMs,
    mbps,
    note: 'Infinite Transfer Rate approaches available capacity; throughput remains hardware/network bound.'
  };
}

async function copyRange(sourcePath, destPath, range) {
  if (range.length === 0) return;
  const reader = await open(sourcePath, 'r');
  const writer = await open(destPath, 'r+');
  try {
    const buffer = Buffer.alloc(range.length);
    const { bytesRead } = await reader.read(buffer, 0, range.length, range.start);
    if (bytesRead !== range.length) throw new Error(`short read at chunk ${range.index}`);
    await writer.write(buffer, 0, range.length, range.start);
  } finally {
    await reader.close();
    await writer.close();
  }
}

export async function streamCopy(sourcePath, destPath) {
  await mkdir(path.dirname(destPath), { recursive: true });
  const hash = createHash('sha256');
  const input = createReadStream(sourcePath);
  input.on('data', (chunk) => hash.update(chunk));
  await pipeline(input, createWriteStream(destPath));
  return digestUri(hash.digest('hex'));
}
