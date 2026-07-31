import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createMcpServer } from '../server/mcp-lite.mjs';

export async function doctor(root) {
  const checks = [];
  const required = [
    'package.json',
    'src/cli.mjs',
    'src/lib/resolver.mjs',
    'src/lib/transfer.mjs',
    'src/server/registry.mjs',
    'src/server/mcp-lite.mjs',
    'src/seo/ownership.mjs',
    'config/seo/ross.co.ownership.json',
    'ross.tasks.json'
  ];

  for (const rel of required) {
    const abs = path.join(root, rel);
    try {
      await access(abs);
      checks.push({ id: rel, status: 'pass' });
    } catch {
      checks.push({ id: rel, status: 'fail', message: 'missing' });
    }
  }

  try {
    const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    checks.push({
      id: 'package-name',
      status: pkg.name ? 'pass' : 'fail',
      message: pkg.name || 'missing name'
    });
    checks.push({
      id: 'release-status',
      status: pkg.ross?.releaseStatus ? 'pass' : 'warn',
      message: pkg.ross?.releaseStatus || 'unset'
    });
  } catch (error) {
    checks.push({ id: 'package-json-parse', status: 'fail', message: error.message });
  }

  const mcp = createMcpServer();
  const init = mcp.handleMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'doctor', version: '1.0.0' } }
  });
  checks.push({
    id: 'mcp-initialize',
    status: init?.result?.serverInfo?.name ? 'pass' : 'fail',
    message: init?.result?.serverInfo?.name || 'failed'
  });

  const failed = checks.filter((c) => c.status === 'fail');
  return {
    ok: failed.length === 0,
    product: 'ROSS.CO Infinite',
    root,
    passed: checks.filter((c) => c.status === 'pass').length,
    failed: failed.length,
    checks
  };
}
