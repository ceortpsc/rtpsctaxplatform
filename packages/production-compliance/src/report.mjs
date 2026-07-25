import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { CHECKLIST_VERSION, checklistSummary, CHECKLIST_SECTIONS } from './checklist.mjs';

export const REPORT_JSON = 'build/production-compliance-report.json';
export const REPORT_MD = 'build/production-compliance-report.md';
export const CHECKLIST_LOG = 'build/production-compliance-checklist.log';

const STATUS_RANK = {
  fail: 0,
  pending_signoff: 1,
  warn: 2,
  skipped: 3,
  pending: 4,
  skip: 5,
  pass: 6
};

export function summarizeResults(results) {
  const counts = {
    pass: 0,
    fail: 0,
    warn: 0,
    skipped: 0,
    pending_signoff: 0,
    pending: 0,
    skip: 0
  };
  for (const item of results) {
    counts[item.status] = (counts[item.status] || 0) + 1;
  }

  const blockers = results.filter((item) => item.status === 'fail' && item.severity === 'blocker');
  const warnings = results.filter((item) => item.status === 'fail' || item.status === 'warn').filter((item) => item.severity === 'warning' || item.status === 'warn');
  const pendingSignoff = results.filter((item) => item.status === 'pending_signoff');

  let overall = 'pass';
  if (blockers.length > 0) overall = 'fail';
  else if (warnings.length > 0) overall = 'warn';
  else if (pendingSignoff.length > 0) overall = 'ready_scaffold';

  return { counts, blockers, warnings, pendingSignoff, overall };
}

export function buildReport({ root, results, gateResults, live, options = {} }) {
  const startedAt = options.startedAt || new Date().toISOString();
  const finishedAt = new Date().toISOString();
  const summary = summarizeResults(results);
  const checklist = checklistSummary();

  return {
    product: 'RTPSC Tax Platform',
    report: 'production-compliance',
    checklistVersion: CHECKLIST_VERSION,
    generatedAt: finishedAt,
    startedAt,
    finishedAt,
    root,
    options: {
      skipGates: Boolean(options.skipGates),
      live: Boolean(live),
      strictProduction: Boolean(options.strictProduction)
    },
    checklist,
    overall: summary.overall,
    summary: {
      ...summary.counts,
      blockerFailures: summary.blockers.length,
      warningFindings: summary.warnings.length,
      pendingSignoff: summary.pendingSignoff.length
    },
    qualityGates: gateResults,
    sections: CHECKLIST_SECTIONS.map((section) => ({
      id: section.id,
      title: section.title,
      items: results.filter((item) => item.sectionId === section.id)
    })),
    results,
    blockers: summary.blockers,
    warnings: summary.warnings,
    pendingSignoff: summary.pendingSignoff,
    artifacts: {
      reportJson: REPORT_JSON,
      reportMarkdown: REPORT_MD,
      checklistLog: CHECKLIST_LOG
    },
    verdict:
      summary.overall === 'pass'
        ? 'All automated checks passed; no pending sign-offs.'
        : summary.overall === 'ready_scaffold'
          ? 'Scaffold compliance gates passed. Manual production sign-offs remain before live cutover.'
          : summary.overall === 'warn'
            ? 'Compliance report completed with warnings. Review warning findings before live production.'
            : 'Compliance report failed. Resolve blocker findings before live production.'
  };
}

export function formatMarkdownReport(report) {
  const lines = [];
  lines.push('# Production Compliance Report');
  lines.push('');
  lines.push(`- Product: ${report.product}`);
  lines.push(`- Checklist version: ${report.checklistVersion}`);
  lines.push(`- Overall: **${report.overall}**`);
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Live probes: ${report.options.live ? 'enabled' : 'skipped'}`);
  lines.push(`- Strict production: ${report.options.strictProduction ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Verdict');
  lines.push('');
  lines.push(report.verdict);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(
    [
      `pass=${report.summary.pass}`,
      `fail=${report.summary.fail}`,
      `warn=${report.summary.warn}`,
      `pending_signoff=${report.summary.pending_signoff}`,
      `skipped=${report.summary.skipped}`
    ].join(' · ')
  );
  lines.push('');

  if (report.blockers.length > 0) {
    lines.push('## Blockers');
    lines.push('');
    for (const item of report.blockers) {
      lines.push(`- [${item.id}] ${item.title} — ${item.message}`);
    }
    lines.push('');
  }

  if (report.pendingSignoff.length > 0) {
    lines.push('## Pending production sign-off');
    lines.push('');
    for (const item of report.pendingSignoff) {
      lines.push(`- [${item.id}] ${item.title} — evidence: ${item.evidence}`);
    }
    lines.push('');
  }

  lines.push('## Checklist by section');
  lines.push('');
  for (const section of report.sections) {
    lines.push(`### ${section.title}`);
    lines.push('');
    for (const item of section.items) {
      lines.push(`- [${item.status.toUpperCase()}] ${item.id} ${item.title}`);
      lines.push(`  - ${item.message}`);
    }
    lines.push('');
  }

  if (report.qualityGates) {
    lines.push('## Quality gates');
    lines.push('');
    lines.push(`ok=${report.qualityGates.ok}`);
    for (const [name, gate] of Object.entries(report.qualityGates.gates || {})) {
      lines.push(`- ${name}: ${gate.ok ? 'ok' : `failed (exit ${gate.code})`}`);
    }
    lines.push('');
  }

  lines.push('## Artifacts');
  lines.push('');
  lines.push(`- ${report.artifacts.reportJson}`);
  lines.push(`- ${report.artifacts.reportMarkdown}`);
  lines.push(`- ${report.artifacts.checklistLog}`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

export function formatChecklistLog(report) {
  const lines = [];
  lines.push(`# RTPSC Production Compliance Checklist Log`);
  lines.push(`generatedAt=${report.generatedAt}`);
  lines.push(`overall=${report.overall}`);
  lines.push(`checklistVersion=${report.checklistVersion}`);
  lines.push('');
  for (const section of report.sections) {
    lines.push(`## ${section.id} — ${section.title}`);
    for (const item of section.items) {
      lines.push(
        [
          item.id,
          item.mode,
          item.severity,
          item.status,
          JSON.stringify(item.title),
          JSON.stringify(item.message)
        ].join('\t')
      );
    }
    lines.push('');
  }
  lines.push(`verdict=${JSON.stringify(report.verdict)}`);
  return `${lines.join('\n')}\n`;
}

export async function writeReportArtifacts(root, report) {
  const buildDir = path.join(root, 'build');
  await mkdir(buildDir, { recursive: true });

  const jsonPath = path.join(root, REPORT_JSON);
  const mdPath = path.join(root, REPORT_MD);
  const logPath = path.join(root, CHECKLIST_LOG);

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, formatMarkdownReport(report));
  await writeFile(logPath, formatChecklistLog(report));

  return { jsonPath, mdPath, logPath };
}

export async function readLatestLog(root) {
  const logPath = path.join(root, CHECKLIST_LOG);
  await access(logPath);
  return readFile(logPath, 'utf8');
}

export function exitCodeForReport(report, { strictProduction = false } = {}) {
  if (report.overall === 'fail') return 1;
  if (strictProduction && report.summary.pending_signoff > 0) return 2;
  if (report.overall === 'warn') return 0;
  return 0;
}

export { STATUS_RANK };
