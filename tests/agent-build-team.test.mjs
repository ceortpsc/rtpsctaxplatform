import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TEAM_NAME,
  TEAM_ROLES,
  listRoles,
  getRole,
  inventModules,
  describeInventory,
  DEVELOPMENTAL_SECTORS,
  assessModule,
  planTeamCoverage,
  runTeam,
  formatTeamReport
} from '../packages/agent-build-team/src/index.mjs';

test('team roster exposes six engineering roles in order', () => {
  const roles = listRoles();
  assert.equal(TEAM_NAME, 'Agent Build Engineering Team');
  assert.equal(roles.length, 6);
  assert.deepEqual(
    roles.map((role) => role.id),
    ['architect', 'build-engineer', 'qa-engineer', 'compliance-officer', 'docs-steward', 'release-lead']
  );
  assert.equal(getRole('build-engineer')?.name, 'Build Engineer');
  assert.equal(TEAM_ROLES[0].order < TEAM_ROLES.at(-1).order, true);
});

test('inventory discovers all developmental sectors and modules', async () => {
  const modules = await inventModules(process.cwd());
  const catalog = describeInventory(modules);

  assert.ok(catalog.totalModules >= 17);
  for (const sector of DEVELOPMENTAL_SECTORS) {
    const group = catalog.sectors.find((entry) => entry.sector === sector);
    assert.ok(group, `missing sector ${sector}`);
    assert.ok(group.count > 0, `empty sector ${sector}`);
  }

  const names = modules.map((module) => module.name);
  assert.ok(names.includes('platform-core'));
  assert.ok(names.includes('api-gateway'));
  assert.ok(names.includes('aol'));
  assert.ok(names.includes('agent-build-team'));
});

test('assessModule rolls up Release Lead from peer roles', async () => {
  const modules = await inventModules(process.cwd());
  const gateway = modules.find((module) => module.name === 'api-gateway');
  assert.ok(gateway);

  const report = assessModule(gateway);
  assert.equal(report.module.name, 'api-gateway');
  assert.ok(['pass', 'warn', 'fail'].includes(report.status));
  assert.equal(report.assessments.length, 6);
  assert.equal(report.assessments.at(-1).roleId, 'release-lead');
});

test('planTeamCoverage targets every inventoried module', async () => {
  const modules = await inventModules(process.cwd());
  const plan = planTeamCoverage(modules);
  assert.equal(plan.moduleTargets.length, modules.length);
  assert.ok(plan.objectives.length >= 3);
  assert.equal(plan.roles.length, 6);
});

test('runTeam assesses all modules without recursive quality gates', async () => {
  const report = await runTeam({ includeQualityGates: false });
  assert.equal(report.team.id, 'agent-build-engineering-team');
  assert.equal(report.summary.modulesAssessed, report.moduleReports.length);
  assert.ok(report.summary.modulesAssessed >= 17);
  assert.equal(report.qualityGates, null);
  assert.ok(['pass', 'warn', 'fail'].includes(report.overall));

  const text = formatTeamReport(report, { verbose: false });
  assert.match(text, /Agent Build Engineering Team/);
  assert.match(text, /Inventory by sector/);
});

test('compliance officer flags scraping language as a blocker', () => {
  const role = getRole('compliance-officer');
  const assessment = role.assess({
    name: 'bad-scraper',
    summary: 'scraping refund status from public sites',
    tags: ['worker'],
    status: 'active',
    hasHardcodedSecretHint: false
  });
  assert.equal(assessment.status, 'fail');
  assert.ok(assessment.findings.some((finding) => finding.code === 'COMPLY_SCRAPE'));
});
