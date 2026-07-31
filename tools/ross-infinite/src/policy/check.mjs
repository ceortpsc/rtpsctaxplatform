import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function policyCheck(root, targetPath, policyPath) {
  const targetAbs = path.isAbsolute(targetPath) ? targetPath : path.join(root, targetPath);
  const policyAbs = path.isAbsolute(policyPath) ? policyPath : path.join(root, policyPath);
  const target = JSON.parse(await readFile(targetAbs, 'utf8'));
  const policy = JSON.parse(await readFile(policyAbs, 'utf8'));

  const findings = [];
  const rules = policy.rules || [];

  for (const rule of rules) {
    if (rule.type === 'requiredField') {
      const value = getPath(target, rule.path);
      const ok = value !== undefined && value !== null && value !== '';
      findings.push({
        id: rule.id || rule.path,
        status: ok ? 'pass' : 'fail',
        message: ok ? 'present' : `missing ${rule.path}`
      });
    }
    if (rule.type === 'equals') {
      const value = getPath(target, rule.path);
      const ok = value === rule.value;
      findings.push({
        id: rule.id || rule.path,
        status: ok ? 'pass' : 'fail',
        message: ok ? `equals ${JSON.stringify(rule.value)}` : `expected ${JSON.stringify(rule.value)}, got ${JSON.stringify(value)}`
      });
    }
    if (rule.type === 'forbiddenSubstring') {
      const blob = JSON.stringify(target);
      const hit = blob.includes(rule.value);
      findings.push({
        id: rule.id || rule.value,
        status: hit ? 'fail' : 'pass',
        message: hit ? `forbidden substring present: ${rule.value}` : 'clean'
      });
    }
  }

  const failed = findings.filter((f) => f.status === 'fail');
  return {
    ok: failed.length === 0,
    target: path.relative(root, targetAbs),
    policy: path.relative(root, policyAbs),
    findings,
    failed: failed.length,
    passed: findings.filter((f) => f.status === 'pass').length
  };
}

function getPath(obj, dotted) {
  return String(dotted)
    .split('.')
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}
