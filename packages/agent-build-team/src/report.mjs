/**
 * Human-readable and machine-readable reporting for Agent Build Engineering Team runs.
 */

const STATUS_GLYPH = {
  pass: 'PASS',
  warn: 'WARN',
  fail: 'FAIL',
  ok: 'ok',
  info: 'info',
  warning: 'warn',
  blocker: 'BLOCK'
};

export function formatTeamReport(report, { verbose = false } = {}) {
  const lines = [];
  lines.push(`# ${report.team.name}`);
  lines.push(`version: ${report.team.version}  overall: ${STATUS_GLYPH[report.overall] ?? report.overall}`);
  lines.push(`started: ${report.startedAt}`);
  lines.push(`finished: ${report.finishedAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push(
    [
      `modules=${report.summary.modulesAssessed}`,
      `pass=${report.summary.modulesPass}`,
      `warn=${report.summary.modulesWarn}`,
      `fail=${report.summary.modulesFail}`,
      `blockers=${report.summary.blockerCount}`,
      `warnings=${report.summary.warningCount}`,
      `qualityGates=${report.summary.qualityGatesOk === null ? 'skipped' : report.summary.qualityGatesOk ? 'ok' : 'failed'}`
    ].join('  ')
  );
  lines.push('');

  lines.push('## Inventory by sector');
  for (const sector of report.inventory.sectors) {
    lines.push(`- ${sector.sector}: ${sector.count}`);
    if (verbose) {
      for (const module of sector.modules) {
        lines.push(`  - ${module.name} (${module.kind}) entry=${module.entryExists} readme=${module.readmeExists}`);
      }
    }
  }
  lines.push('');

  lines.push('## Module readiness');
  for (const moduleReport of report.moduleReports) {
    lines.push(`- [${STATUS_GLYPH[moduleReport.status]}] ${moduleReport.module.sector}/${moduleReport.module.name}`);
    if (verbose) {
      for (const assessment of moduleReport.assessments) {
        lines.push(`  - ${assessment.roleName}: ${STATUS_GLYPH[assessment.status]}`);
      }
    }
  }
  lines.push('');

  if (report.blockers.length > 0) {
    lines.push('## Blockers');
    for (const finding of report.blockers) {
      lines.push(`- [${finding.code}] ${finding.module}: ${finding.message}`);
    }
    lines.push('');
  }

  if (report.warnings.length > 0) {
    lines.push('## Warnings');
    for (const finding of report.warnings) {
      lines.push(`- [${finding.code}] ${finding.module}: ${finding.message}`);
    }
    lines.push('');
  }

  if (report.qualityGates) {
    lines.push('## Quality gates');
    lines.push(`runner: ${report.qualityGates.runner}  ok=${report.qualityGates.ok}`);
    for (const [name, gate] of Object.entries(report.qualityGates.gates)) {
      lines.push(`- ${name}: ${gate.ok ? 'ok' : `failed (exit ${gate.code})`}`);
    }
    lines.push('');
  }

  lines.push('## Roles');
  for (const role of report.team.roles) {
    lines.push(`- ${role.name} (${role.id}): ${role.description}`);
  }

  return `${lines.join('\n')}\n`;
}

export function toJsonReport(report) {
  return `${JSON.stringify(report, null, 2)}\n`;
}
