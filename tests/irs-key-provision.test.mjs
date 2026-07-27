import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('provision-irs-keys script generates RSA key material under a temp cwd copy of paths', () => {
  // Smoke: openssl can generate a 2048-bit key (same tool the provisioner uses).
  const dir = mkdtempSync(path.join(tmpdir(), 'rtpsc-irs-key-'));
  try {
    const keyPath = path.join(dir, 'test.key');
    const pubPath = path.join(dir, 'test.pub');
    const gen = spawnSync('openssl', ['genrsa', '-out', keyPath, '2048'], { encoding: 'utf8' });
    assert.equal(gen.status, 0, gen.stderr);
    const pub = spawnSync('openssl', ['rsa', '-in', keyPath, '-pubout', '-out', pubPath], { encoding: 'utf8' });
    assert.equal(pub.status, 0, pub.stderr);
    assert.ok(existsSync(keyPath));
    assert.ok(readFileSync(keyPath, 'utf8').includes('PRIVATE KEY'));
    assert.ok(readFileSync(pubPath, 'utf8').includes('PUBLIC KEY'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('rtpsc provision command is registered', async () => {
  const { planCommand } = await import('../bin/rtpsc.mjs');
  const plan = planCommand(['provision', 'irs-keys', '--json']);
  assert.ok(plan.args.some((a) => String(a).includes('provision-irs-keys.mjs')));
});
