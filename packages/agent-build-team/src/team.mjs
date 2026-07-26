import { spawn } from 'node:child_process';
import path from 'node:path';
import { DEVELOPMENTAL_SECTORS, inventModules, describeInventory } from './inventory.mjs';
import { TEAM_ID, TEAM_NAME, TEAM_VERSION, TEAM_ROLES, listRoles } from './roles.mjs';

function aggregateStatus(statuses) {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('warn')) return 'warn';
  return 'pass';
}

function flattenFindings(moduleReports) {
  return moduleReports.flatMap((report) =>
    report.assessments.flatMap((assessment) =>
      assessment.findings.map((finding) => ({
        ...finding,
        roleId: assessment.roleId,
        roleName: assessment.roleName,
        module: finding.module ?? report.module.name
      }))
    )
  );
}

/**
 * Run every team role against a single module.
 * Release Lead receives peer assessments from earlier roles.
 */
export function assessModule(module, context = {}) {
  const assessments = [];
  const baseContext = {
    requiredSectors: DEVELOPMENTAL_SECTORS,
    ...context
  };

  for (const role of TEAM_ROLES) {
    if (role.id === 'release-lead') {
      assessments.push(role.assess(module, { ...baseContext, peerAssessments: assessments.slice() }));
    } else {
      assessments.push(role.assess(module, baseContext));
    }
  }

  return {
    module: {
      name: module.name,
      packageName: module.packageName,
      sector: module.sector,
      kind: module.kind,
      location: module.location,
      status: module.status
    },
    status: aggregateStatus(assessments.map((a) => a.status)),
    assessments
  };
}

/**
 * Full team run across all developmental projects and modules.
 * @param {{ rootDir?: string, includeQualityGates?: boolean }} [options]
 */
export async function runTeam(options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  const includeQualityGates = options.includeQualityGates !== false;
  const startedAt = new Date().toISOString();

  const modules = await inventModules(rootDir);
  const moduleReports = modules.map((module) => assessModule(module));
  const inventory = describeInventory(modules);

  let qualityGates = null;
  if (includeQualityGates) {
    qualityGates = await runQualityGates(rootDir);
  }

  const findings = flattenFindings(moduleReports);
  const blockers = findings.filter((f) => f.severity === 'blocker');
  const warnings = findings.filter((f) => f.severity === 'warning');

  const moduleStatus = aggregateStatus(moduleReports.map((r) => r.status));
  const gateStatus = qualityGates
    ? aggregateStatus(
        Object.values(qualityGates.gates).map((gate) => (gate.ok ? 'pass' : 'fail'))
      )
    : 'pass';

  const overall = aggregateStatus([moduleStatus, gateStatus]);
  const finishedAt = new Date().toISOString();

  return {
    team: {
      id: TEAM_ID,
      name: TEAM_NAME,
      version: TEAM_VERSION,
      roles: listRoles()
    },
    startedAt,
    finishedAt,
    overall,
    inventory,
    summary: {
      modulesAssessed: moduleReports.length,
      modulesPass: moduleReports.filter((r) => r.status === 'pass').length,
      modulesWarn: moduleReports.filter((r) => r.status === 'warn').length,
      modulesFail: moduleReports.filter((r) => r.status === 'fail').length,
      blockerCount: blockers.length,
      warningCount: warnings.length,
      qualityGatesOk: qualityGates ? qualityGates.ok : null
    },
    moduleReports,
    blockers,
    warnings,
    qualityGates
  };
}

function runCommand(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      resolve({ ok: false, code: 1, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on('close', (code) => {
      resolve({ ok: code === 0, code: code ?? 1, stdout, stderr });
    });
  });
}

/**
 * Execute platform quality gates (lint → test → build) via AOL when available,
 * falling back to direct script invocation.
 */
export async function runQualityGates(rootDir = process.cwd()) {
  const aolBin = path.join(rootDir, 'tools', 'aol', 'bin', 'aol.mjs');
  const useAol = await import('node:fs/promises')
    .then(async (fs) => {
      try {
        await fs.access(aolBin);
        return true;
      } catch {
        return false;
      }
    });

  const gates = {};
  const sequence = ['lint', 'test', 'build'];

  for (const gate of sequence) {
    let result;
    if (useAol) {
      result = await runCommand(process.execPath, [aolBin, 'run', gate], rootDir);
    } else if (gate === 'test') {
      result = await runCommand('bash', ['./scripts/test.sh'], rootDir);
    } else {
      result = await runCommand(process.execPath, [`./scripts/${gate}.mjs`], rootDir);
    }

    gates[gate] = {
      ok: result.ok,
      code: result.code,
      stdout: result.stdout.trim().slice(-2000),
      stderr: result.stderr.trim().slice(-2000)
    };
    if (!result.ok) break;
  }

  return {
    ok: Object.values(gates).every((gate) => gate.ok),
    runner: useAol ? 'aol' : 'scripts',
    gates
  };
}

/** Lightweight plan describing what the team will cover. */
export function planTeamCoverage(modules) {
  return {
    team: TEAM_NAME,
    version: TEAM_VERSION,
    objectives: [
      'Inventory every developmental project and module across packages, services, workers, pipelines, engines, and tools.',
      'Run Platform Architect, Build Engineer, QA Engineer, Compliance Officer, Docs Steward, Design Style & Presentation, and Release Lead assessments.',
      'Execute lint, test, and build quality gates for the whole platform.',
      'Produce a consolidated readiness report with blockers and warnings.'
    ],
    roles: listRoles(),
    moduleTargets: modules.map((module) => ({
      name: module.name,
      sector: module.sector,
      kind: module.kind,
      location: module.location
    }))
  };
}
