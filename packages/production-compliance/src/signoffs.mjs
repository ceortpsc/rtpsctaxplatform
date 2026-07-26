import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

export const SIGNOFF_REGISTRY_PATH = 'policy/procedures/production-signoffs/registry.json';

export async function loadSignoffRegistry(root) {
  const fullPath = path.join(root, SIGNOFF_REGISTRY_PATH);
  try {
    await access(fullPath);
  } catch {
    return null;
  }

  const raw = JSON.parse(await readFile(fullPath, 'utf8'));
  if (!raw || typeof raw !== 'object' || typeof raw.signoffs !== 'object') {
    throw new Error(`Invalid sign-off registry at ${SIGNOFF_REGISTRY_PATH}`);
  }
  return raw;
}

export function evaluateManualSignoff(item, registry, { strictProduction = false } = {}) {
  const entry = registry?.signoffs?.[item.id];

  if (!entry) {
    return {
      status: strictProduction ? 'fail' : 'pending_signoff',
      message: strictProduction
        ? 'Manual sign-off required for live production (--strict-production)'
        : 'Awaiting documented human sign-off',
      signoff: null
    };
  }

  const approved =
    entry.status === 'approved' &&
    typeof entry.approver === 'string' &&
    entry.approver.trim().length > 0 &&
    typeof entry.approvedAt === 'string' &&
    entry.approvedAt.trim().length > 0;

  if (approved) {
    return {
      status: 'pass',
      message: `Signed off by ${entry.approver} at ${entry.approvedAt}`,
      signoff: entry
    };
  }

  if (entry.status === 'open' || entry.status === 'pending') {
    return {
      status: strictProduction ? 'fail' : 'pending_signoff',
      message: `Sign-off pack registered (${entry.evidenceRef || 'no evidence ref'}); awaiting approval`,
      signoff: entry
    };
  }

  return {
    status: strictProduction ? 'fail' : 'pending_signoff',
    message: `Sign-off status=${entry.status}; awaiting approved registry entry`,
    signoff: entry
  };
}
