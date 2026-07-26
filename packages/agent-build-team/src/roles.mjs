export { DESIGN_STYLE_GUIDANCE } from './design-style.mjs';

/**
 * Agent Build Engineering Team — role roster.
 *
 * Each role owns a slice of build-engineering responsibility across every
 * developmental project and module in the monorepo. Roles are pure metadata
 * plus an assess(module, context) function; the orchestrator runs them in
 * pipeline order and consolidates findings.
 */

export const TEAM_NAME = 'Agent Build Engineering Team';
export const TEAM_ID = 'agent-build-engineering-team';
export const TEAM_VERSION = '0.1.1';

/**
 * @typedef {object} Finding
 * @property {'ok'|'info'|'warning'|'blocker'} severity
 * @property {string} code
 * @property {string} message
 * @property {string} [module]
 * @property {string} [path]
 */

/**
 * @typedef {object} RoleAssessment
 * @property {string} roleId
 * @property {string} roleName
 * @property {'pass'|'warn'|'fail'} status
 * @property {Finding[]} findings
 * @property {object} [metrics]
 */

function finding(severity, code, message, extra = {}) {
  return { severity, code, message, ...extra };
}

function statusFromFindings(findings) {
  if (findings.some((f) => f.severity === 'blocker')) return 'fail';
  if (findings.some((f) => f.severity === 'warning')) return 'warn';
  return 'pass';
}

/** Platform Architect — topology, sectors, dependency shape. */
export const architect = Object.freeze({
  id: 'architect',
  name: 'Platform Architect',
  order: 10,
  focus: ['topology', 'dependencies', 'sectors'],
  description: 'Maps every developmental project and module; validates sector coverage and dependency declarations.',
  assess(module, context = {}) {
    const findings = [];
    if (!module.sector) {
      findings.push(finding('blocker', 'ARCH_NO_SECTOR', 'Module is missing a sector assignment.', { module: module.name }));
    }
    if (!module.packageName) {
      findings.push(finding('warning', 'ARCH_NO_PACKAGE', 'Module has no package.json name.', { module: module.name, path: module.location }));
    }
    if (module.kind === 'service' && (!module.dependencies || module.dependencies.length === 0)) {
      findings.push(
        finding('info', 'ARCH_SERVICE_DEPS', 'Service declares no workspace dependencies yet (scaffold baseline).', {
          module: module.name
        })
      );
    }
    if (context.requiredSectors && !context.requiredSectors.includes(module.sector)) {
      findings.push(
        finding('warning', 'ARCH_UNKNOWN_SECTOR', `Sector "${module.sector}" is outside the known developmental map.`, {
          module: module.name
        })
      );
    }
    findings.push(
      finding('ok', 'ARCH_MAPPED', `Mapped ${module.name} under ${module.sector}.`, { module: module.name, path: module.location })
    );
    return {
      roleId: this.id,
      roleName: this.name,
      status: statusFromFindings(findings),
      findings,
      metrics: {
        dependencyCount: module.dependencies?.length ?? 0,
        hasEntry: Boolean(module.entry)
      }
    };
  }
});

/** Build Engineer — entrypoints, importability, build readiness. */
export const buildEngineer = Object.freeze({
  id: 'build-engineer',
  name: 'Build Engineer',
  order: 20,
  focus: ['entrypoints', 'imports', 'manifest'],
  description: 'Verifies each module has a buildable entrypoint and contributes to the platform manifest.',
  assess(module) {
    const findings = [];
    if (!module.entryExists) {
      findings.push(
        finding('blocker', 'BUILD_NO_ENTRY', 'Missing src/index.mjs entrypoint.', {
          module: module.name,
          path: module.entry || `${module.location}/src/index.mjs`
        })
      );
    } else {
      findings.push(
        finding('ok', 'BUILD_ENTRY_OK', 'Entrypoint present.', { module: module.name, path: module.entry })
      );
    }
    if (!module.packageJsonExists) {
      findings.push(
        finding('blocker', 'BUILD_NO_PACKAGE_JSON', 'Missing package.json.', {
          module: module.name,
          path: `${module.location}/package.json`
        })
      );
    }
    if (module.packageJsonExists && module.type !== 'module') {
      findings.push(
        finding('warning', 'BUILD_NOT_ESM', 'package.json should set "type": "module".', { module: module.name })
      );
    }
    return {
      roleId: this.id,
      roleName: this.name,
      status: statusFromFindings(findings),
      findings,
      metrics: { entryExists: module.entryExists, packageJsonExists: module.packageJsonExists }
    };
  }
});

/** QA Engineer — tests, scripts, quality-gate readiness. */
export const qaEngineer = Object.freeze({
  id: 'qa-engineer',
  name: 'QA Engineer',
  order: 30,
  focus: ['tests', 'scripts', 'quality-gates'],
  description: 'Checks test/script surface and quality-gate readiness for each module.',
  assess(module) {
    const findings = [];
    const scripts = module.scripts || {};
    if (module.kind === 'service' || module.kind === 'worker') {
      if (!scripts.start) {
        findings.push(
          finding('warning', 'QA_NO_START', `${module.kind} should expose a start script.`, { module: module.name })
        );
      } else {
        findings.push(finding('ok', 'QA_START_OK', 'Start script present.', { module: module.name }));
      }
    }
    if (Object.keys(scripts).length === 0 && module.kind !== 'package') {
      findings.push(
        finding('info', 'QA_NO_SCRIPTS', 'No package scripts declared (acceptable for pure descriptors).', {
          module: module.name
        })
      );
    }
    findings.push(
      finding('ok', 'QA_SCOPED', `QA scope recorded for ${module.name}.`, { module: module.name })
    );
    return {
      roleId: this.id,
      roleName: this.name,
      status: statusFromFindings(findings),
      findings,
      metrics: { scriptCount: Object.keys(scripts).length }
    };
  }
});

/** Compliance Officer — secrets, scraping bans, governance markers. */
export const complianceOfficer = Object.freeze({
  id: 'compliance-officer',
  name: 'Compliance Officer',
  order: 40,
  focus: ['secrets', 'scraping', 'governance'],
  description: 'Enforces compliance boundaries: no embedded secrets, no scraping flows, stub gates for sensitive adapters.',
  assess(module) {
    const findings = [];
    const blob = `${module.name} ${module.summary || ''} ${(module.tags || []).join(' ')}`.toLowerCase();

    if (/\bscrap(e|ing)\b/.test(blob) && !blob.includes('no scraping')) {
      findings.push(
        finding('blocker', 'COMPLY_SCRAPE', 'Module language suggests scraping — forbidden on this platform.', {
          module: module.name
        })
      );
    } else {
      findings.push(
        finding('ok', 'COMPLY_NO_SCRAPE', 'No scraping indicators in module metadata.', { module: module.name })
      );
    }

    if (module.name.includes('secure-tunnel') && module.status === 'stub') {
      findings.push(
        finding(
          'info',
          'COMPLY_TUNNEL_STUB',
          'Secure tunnel remains a stub — implement only after legal/security approval.',
          { module: module.name }
        )
      );
    }

    if (module.hasHardcodedSecretHint) {
      findings.push(
        finding('blocker', 'COMPLY_SECRET', 'Possible hardcoded secret pattern detected in module metadata.', {
          module: module.name
        })
      );
    }

    findings.push(
      finding('ok', 'COMPLY_ENV_SECRETS', 'Secrets must remain environment-based.', { module: module.name })
    );

    return {
      roleId: this.id,
      roleName: this.name,
      status: statusFromFindings(findings),
      findings,
      metrics: { stub: module.status === 'stub' }
    };
  }
});

/** Docs Steward — README / descriptor documentation coverage. */
export const docsSteward = Object.freeze({
  id: 'docs-steward',
  name: 'Docs Steward',
  order: 50,
  focus: ['readme', 'descriptors', 'runbooks'],
  description: 'Ensures each developmental module ships with operator-facing documentation.',
  assess(module) {
    const findings = [];
    if (!module.readmeExists) {
      findings.push(
        finding('warning', 'DOCS_NO_README', 'Missing README.md for module.', {
          module: module.name,
          path: `${module.location}/README.md`
        })
      );
    } else {
      findings.push(finding('ok', 'DOCS_README_OK', 'README.md present.', { module: module.name }));
    }
    return {
      roleId: this.id,
      roleName: this.name,
      status: statusFromFindings(findings),
      findings,
      metrics: { readmeExists: module.readmeExists }
    };
  }
});

/**
 * Design Style & Presentation — brand, visual language, and operator-facing polish.
 *
 * Applies to UI surfaces (public/, CSS/HTML/SVG) and to how modules present
 * themselves in README/branding copy. Flags common AI-default visual clichés
 * when style assets exist.
 */
export const designStylist = Object.freeze({
  id: 'design-stylist',
  name: 'Design Style & Presentation',
  order: 55,
  focus: ['brand', 'visual-language', 'presentation', 'operator-polish'],
  description:
    'Guards design style and presentation: brand-first signals, presentation-surface quality, and avoidance of generic AI visual defaults.',
  assess(module) {
    const findings = [];
    const presentation = module.presentation || {};
    const hasSurface = Boolean(presentation.hasSurface);

    if (module.readmeExists) {
      if (presentation.readmeHasHeading) {
        findings.push(
          finding('ok', 'DESIGN_README_HEADING', 'README opens with a clear presentation heading.', {
            module: module.name
          })
        );
      } else {
        findings.push(
          finding('warning', 'DESIGN_README_NO_HEADING', 'README should open with a clear # heading for presentation.', {
            module: module.name,
            path: `${module.location}/README.md`
          })
        );
      }

      if (presentation.brandMentioned) {
        findings.push(
          finding('ok', 'DESIGN_BRAND_SIGNAL', 'Brand or product identity is present in module presentation copy.', {
            module: module.name
          })
        );
      } else if (module.kind === 'service' || module.kind === 'tool' || hasSurface) {
        findings.push(
          finding(
            'info',
            'DESIGN_BRAND_SOFT',
            'Consider naming RTPSC / product identity in operator-facing presentation copy.',
            { module: module.name }
          )
        );
      }
    }

    if (hasSurface) {
      findings.push(
        finding('ok', 'DESIGN_SURFACE_FOUND', 'Presentation surface detected (public UI and/or style assets).', {
          module: module.name,
          path: presentation.publicDir || presentation.styleFiles?.[0]
        })
      );

      if (!presentation.hasCssVariables && presentation.styleFiles?.length > 0) {
        findings.push(
          finding(
            'warning',
            'DESIGN_NO_TOKENS',
            'Presentation CSS should define a clear visual direction via CSS variables.',
            { module: module.name }
          )
        );
      } else if (presentation.hasCssVariables) {
        findings.push(
          finding('ok', 'DESIGN_TOKENS_OK', 'CSS variables establish a presentation design direction.', {
            module: module.name
          })
        );
      }

      for (const hit of presentation.styleAntiPatterns || []) {
        findings.push(
          finding('warning', `DESIGN_LOOK_${hit.id.toUpperCase().replace(/-/g, '_')}`, hit.message, {
            module: module.name,
            path: hit.path
          })
        );
      }

      if ((presentation.styleAntiPatterns || []).length === 0 && presentation.styleFiles?.length > 0) {
        findings.push(
          finding('ok', 'DESIGN_LOOK_CLEAR', 'No banned default AI visual looks detected in style assets.', {
            module: module.name
          })
        );
      }
    } else {
      findings.push(
        finding(
          'ok',
          'DESIGN_NO_UI',
          'No dedicated UI presentation surface — style agent scoped to operator docs polish.',
          { module: module.name }
        )
      );
    }

    return {
      roleId: this.id,
      roleName: this.name,
      status: statusFromFindings(findings),
      findings,
      metrics: {
        hasSurface,
        brandMentioned: Boolean(presentation.brandMentioned),
        styleFileCount: presentation.styleFiles?.length ?? 0,
        antiPatternCount: presentation.styleAntiPatterns?.length ?? 0
      }
    };
  }
});

/** Release Lead — consolidates module readiness for ship/build decisions. */
export const releaseLead = Object.freeze({
  id: 'release-lead',
  name: 'Release Lead',
  order: 70,
  focus: ['readiness', 'roll-up', 'ship-gate'],
  description: 'Rolls up peer findings into a per-module ship/build readiness verdict.',
  assess(module, context = {}) {
    const peer = context.peerAssessments || [];
    const findings = [];
    const failed = peer.filter((a) => a.status === 'fail');
    const warned = peer.filter((a) => a.status === 'warn');

    if (failed.length > 0) {
      findings.push(
        finding(
          'blocker',
          'REL_BLOCKED',
          `Blocked by ${failed.map((a) => a.roleName).join(', ')}.`,
          { module: module.name }
        )
      );
    } else if (warned.length > 0) {
      findings.push(
        finding(
          'warning',
          'REL_WARN',
          `Ready with warnings from ${warned.map((a) => a.roleName).join(', ')}.`,
          { module: module.name }
        )
      );
    } else {
      findings.push(
        finding('ok', 'REL_READY', 'Module cleared by Agent Build Engineering Team.', { module: module.name })
      );
    }

    return {
      roleId: this.id,
      roleName: this.name,
      status: statusFromFindings(findings),
      findings,
      metrics: {
        peerFail: failed.length,
        peerWarn: warned.length,
        peerPass: peer.filter((a) => a.status === 'pass').length
      }
    };
  }
});

/** Ordered roster used by the orchestrator. */
export const TEAM_ROLES = Object.freeze([
  architect,
  buildEngineer,
  qaEngineer,
  complianceOfficer,
  docsSteward,
  designStylist,
  releaseLead
]);

export function listRoles() {
  return TEAM_ROLES.map((role) => ({
    id: role.id,
    name: role.name,
    order: role.order,
    focus: [...role.focus],
    description: role.description
  }));
}

export function getRole(id) {
  return TEAM_ROLES.find((role) => role.id === id) ?? null;
}
