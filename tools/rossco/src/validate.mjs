import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig, CONFIG_FILE_NAME } from './config.mjs';
import { LIFECYCLE_STAGES } from './lifecycle.mjs';

export async function validatePrototype(root) {
  const checks = [];
  const required = [
    'tools/rossco/package.json',
    'tools/rossco/bin/rossco.mjs',
    'tools/rossco/NOTICE',
    'tools/rossco/rossco.config.schema.json',
    'docs/rossco-itr-package-manager.md',
    'docs/rossco-intellectual-property.md',
    CONFIG_FILE_NAME,
    'RTPSC-package-lock.json',
    'tools/aol/bin/aol.mjs'
  ];

  for (const relative of required) {
    try {
      await access(path.join(root, relative));
      checks.push({ id: relative, status: 'pass' });
    } catch {
      checks.push({ id: relative, status: 'fail', message: 'missing' });
    }
  }

  const config = await loadConfig(root);
  const stageOk = Array.isArray(config.lifecycle.stages) && config.lifecycle.stages.length === LIFECYCLE_STAGES.length;
  checks.push({
    id: 'lifecycle-stages',
    status: stageOk ? 'pass' : 'fail',
    message: stageOk ? 'complete' : 'incomplete lifecycle map'
  });

  checks.push({
    id: 'transfer-mode',
    status: config.transfer.mode === 'infinite' ? 'pass' : 'warn',
    message: `mode=${config.transfer.mode}`
  });

  try {
    JSON.parse(await readFile(path.join(root, 'tools/rossco/package.json'), 'utf8'));
    checks.push({ id: 'rossco-package-json', status: 'pass' });
  } catch (error) {
    checks.push({ id: 'rossco-package-json', status: 'fail', message: error.message });
  }

  const failed = checks.filter((item) => item.status === 'fail');
  return {
    stage: 'validate',
    ok: failed.length === 0,
    passed: checks.filter((item) => item.status === 'pass').length,
    failed: failed.length,
    checks
  };
}

export async function verifyPrototype(root, { transferFn } = {}) {
  const validation = await validatePrototype(root);
  let transfer = null;
  let transferError = null;
  try {
    if (typeof transferFn === 'function') {
      transfer = await transferFn(root, { quiet: true });
    }
  } catch (error) {
    transferError = error.message;
  }

  return {
    stage: 'verify',
    ok: validation.ok && !transferError,
    validation,
    transfer: transfer
      ? {
          workspaceCount: transfer.workspaceCount,
          elapsedMs: transfer.elapsedMs,
          mbps: transfer.mbps,
          infinite: transfer.infinite
        }
      : null,
    transferError,
    reproduction: {
      commands: ['./scripts/rossco install', './scripts/rossco validate', './scripts/rossco transfer --json']
    }
  };
}
