#!/usr/bin/env node
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planTasks, loadTaskfile } from '../src/task/engine.mjs';
import { doctor } from '../src/policy/doctor.mjs';
import { policyCheck } from '../src/policy/check.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceDir = path.join(root, 'release-evidence/v1');
await mkdir(evidenceDir, { recursive: true });

const taskfile = loadTaskfile(JSON.parse(await readFile(path.join(root, 'ross.tasks.json'), 'utf8')));
const plan = await planTasks(taskfile, 'default', { root, jobs: 2 });
const health = await doctor(root);
const policy = await policyCheck(root, 'package.json', 'config/production-policy.json');

const report = {
  ok: health.ok && policy.ok,
  generatedAt: new Date().toISOString(),
  doctor: health,
  policy,
  analysis: {
    order: plan.order,
    criticalPath: plan.criticalPath,
    parallelWidth: plan.parallelWidth
  }
};

await writeFile(path.join(evidenceDir, 'advanced-verification.json'), `${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, evidence: 'release-evidence/v1/advanced-verification.json' }, null, 2));
