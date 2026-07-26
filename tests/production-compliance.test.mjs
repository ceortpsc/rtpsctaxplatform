import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  CHECKLIST_VERSION,
  checklistSummary,
  listChecklistItems,
  runComplianceChecks,
  buildReport,
  writeReportArtifacts,
  formatMarkdownReport,
  formatChecklistLog,
  exitCodeForReport,
  runCli
} from '../packages/production-compliance/src/index.mjs';

const root = process.cwd();

test('checklist enumerates automated, manual, and live items', () => {
  const summary = checklistSummary();
  assert.equal(summary.version, CHECKLIST_VERSION);
  assert.equal(summary.version, '2.0.0');
  assert.ok(summary.items >= 60);
  assert.ok(summary.sections >= 10);
  assert.ok(summary.byMode.automated > 0);
  assert.ok(summary.byMode.manual > 0);
  assert.ok(summary.byMode.live > 0);
  assert.ok(listChecklistItems().some((item) => item.id === 'BND-001'));
  assert.ok(listChecklistItems().some((item) => item.id === 'IRS-001'));
  assert.ok(listChecklistItems().some((item) => item.id === 'TDS-001'));
  assert.ok(listChecklistItems().some((item) => item.id === 'AIA-001'));
  assert.ok(listChecklistItems().some((item) => item.id === 'RFD-001'));
  assert.ok(listChecklistItems().some((item) => item.id === 'EFL-001'));
  assert.ok(summary.bySection.irs_api_credentials >= 1);
  assert.ok(summary.bySection.efile_transmission >= 1);
});

test('compliance checks pass scaffold automated gates with skip-gates', async () => {
  const { results } = await runComplianceChecks(root, { skipGates: true, live: false });
  const automated = results.filter((item) => item.mode === 'automated');
  const failures = automated.filter((item) => item.status === 'fail');
  assert.equal(failures.length, 0, JSON.stringify(failures, null, 2));

  const manual = results.filter((item) => item.mode === 'manual');
  assert.ok(manual.every((item) => item.status === 'pending_signoff'));

  const live = results.filter((item) => item.mode === 'live');
  assert.ok(live.every((item) => item.status === 'skipped'));
});

test('report artifacts and checklist log are written', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'prodcheck-'));
  try {
    // Minimal fake tree is not needed — write artifacts into temp by monkeying root paths via writeReportArtifacts
    const { results } = await runComplianceChecks(root, { skipGates: true });
    const report = buildReport({
      root: tmp,
      results,
      gateResults: null,
      live: false,
      options: { skipGates: true, startedAt: new Date().toISOString() }
    });
    assert.equal(report.overall, 'ready_scaffold');
    assert.match(report.verdict, /Manual production sign-offs/);

    const artifacts = await writeReportArtifacts(tmp, report);
    const json = JSON.parse(await readFile(artifacts.jsonPath, 'utf8'));
    assert.equal(json.report, 'production-compliance');
    assert.ok((await readFile(artifacts.mdPath, 'utf8')).includes('# Production Compliance Report'));
    assert.ok((await readFile(artifacts.logPath, 'utf8')).includes('Checklist Log'));
    assert.ok(formatMarkdownReport(report).includes('Pending production sign-off'));
    assert.ok(formatChecklistLog(report).includes('GOV-001'));
    assert.equal(exitCodeForReport(report), 0);
    assert.equal(exitCodeForReport(report, { strictProduction: true }), 2);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('cli checklist --json emits items', async () => {
  const chunks = [];
  await runCli(['checklist', '--json'], {
    cwd: root,
    stdout: (line) => chunks.push(String(line)),
    stderr: () => {}
  });
  const payload = JSON.parse(chunks.join(''));
  assert.ok(payload.summary.items > 0);
  assert.ok(payload.items.some((item) => item.id === 'OPS-003'));
});

test('strict production marks unresolved manual items as fail', async () => {
  const { results } = await runComplianceChecks(root, { skipGates: true, strictProduction: true });
  const manual = results.filter((item) => item.mode === 'manual');
  assert.ok(manual.every((item) => item.status === 'fail'));
});

test('BND-003 does not flag clients.mjs export-env scaffolding', async () => {
  const { results } = await runComplianceChecks(root, { skipGates: true, live: false });
  const bnd = results.find((item) => item.id === 'BND-003');
  assert.ok(bnd, 'BND-003 should be present');
  assert.equal(bnd.status, 'pass', JSON.stringify(bnd, null, 2));
  assert.ok(!(bnd.findings || []).includes('scripts/clients.mjs'));
});
