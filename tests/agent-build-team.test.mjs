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
  formatTeamReport,
  designStylist
} from '../packages/agent-build-team/src/index.mjs';

test('team roster exposes seven engineering roles in order', () => {
  const roles = listRoles();
  assert.equal(TEAM_NAME, 'Agent Build Engineering Team');
  assert.equal(roles.length, 7);
  assert.deepEqual(
    roles.map((role) => role.id),
    [
      'architect',
      'build-engineer',
      'qa-engineer',
      'compliance-officer',
      'docs-steward',
      'design-stylist',
      'release-lead'
    ]
  );
  assert.equal(getRole('design-stylist')?.name, 'Design Style & Presentation');
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

test('assessModule rolls up Release Lead from peer roles including design stylist', async () => {
  const modules = await inventModules(process.cwd());
  const gateway = modules.find((module) => module.name === 'api-gateway');
  assert.ok(gateway);

  const report = assessModule(gateway);
  assert.equal(report.module.name, 'api-gateway');
  assert.ok(['pass', 'warn', 'fail'].includes(report.status));
  assert.equal(report.assessments.length, 7);
  assert.equal(report.assessments.at(-2).roleId, 'design-stylist');
  assert.equal(report.assessments.at(-1).roleId, 'release-lead');
});

test('planTeamCoverage targets every inventoried module', async () => {
  const modules = await inventModules(process.cwd());
  const plan = planTeamCoverage(modules);
  assert.equal(plan.moduleTargets.length, modules.length);
  assert.ok(plan.objectives.length >= 3);
  assert.equal(plan.roles.length, 7);
  assert.match(plan.objectives.join(' '), /Design Style/);
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
  assert.match(text, /Design Style & Presentation/);
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

test('design stylist flags purple-gradient AI defaults on presentation surfaces', () => {
  const assessment = designStylist.assess({
    name: 'modules-dashboard',
    kind: 'service',
    readmeExists: true,
    presentation: {
      hasSurface: true,
      publicDir: 'services/modules-dashboard/public',
      styleFiles: ['public/theme.css'],
      hasCssVariables: true,
      readmeHasHeading: true,
      brandMentioned: true,
      styleAntiPatterns: [
        {
          id: 'purple-gradient',
          message: 'Avoid default purple/indigo gradient AI themes.',
          path: 'services/modules-dashboard/public/theme.css'
        }
      ]
    }
  });
  assert.equal(assessment.status, 'warn');
  assert.ok(assessment.findings.some((finding) => finding.code === 'DESIGN_LOOK_PURPLE_GRADIENT'));
});

test('design stylist passes operator-doc modules without UI surfaces', () => {
  const assessment = designStylist.assess({
    name: 'platform-core',
    kind: 'package',
    readmeExists: true,
    presentation: {
      hasSurface: false,
      styleFiles: [],
      readmeHasHeading: true,
      brandMentioned: true,
      styleAntiPatterns: []
    }
  });
  assert.equal(assessment.status, 'pass');
  assert.ok(assessment.findings.some((finding) => finding.code === 'DESIGN_NO_UI'));
});
