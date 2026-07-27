/**
 * IRS Tax Practitioner (ERO) suite facade — integrates API/TDS/IRS client
 * posture, masterfile TC rectification, refund intelligence, AI assist,
 * and custom XHTML/XML builders.
 */

import {
  PLATFORM_IDENTITY,
  evaluateEnvironmentProtection,
  loadRuntimeConfig,
  redactConfig
} from '../../platform-core/src/index.mjs';
import { loadFirmIdentity, resolveServiceWiring } from '../../operational-seed/src/index.mjs';
import { loadIrsConfig, redactIrsConfig } from '../../../services/irs-gateway/src/index.mjs';
import { createClientRegistry } from '../../client-identity/src/index.mjs';
import { createAiAssist, askAssist } from '../../ai-assist/src/index.mjs';
import { buildRefundIntelligence } from '../../../engines/refund-intelligence-engine/src/index.mjs';
import { processMasterfileRecord } from '../../../pipelines/masterfile-pipeline/src/index.mjs';
import { TC_CATALOG, listHoldCodes } from '../../../engines/tc-code-engine/src/index.mjs';
import { createRefundReleaseStore } from '../../refund-release-core/src/index.mjs';
import {
  buildPractitionerAccountXml,
  buildPractitionerSuiteXhtml,
  buildMasterfileRectificationXml,
  isWellFormedXml
} from '../../irs-xml/src/index.mjs';

function configured(value) {
  const s = String(value ?? '').trim();
  return Boolean(s) && s !== 'unset' && !s.startsWith('replace-via-') && !s.startsWith('replace-in-');
}

export function describeIntegrationInterfaces(env = process.env) {
  const runtime = loadRuntimeConfig();
  const irs = loadIrsConfig();
  const wiring = resolveServiceWiring(env);
  return {
    company: PLATFORM_IDENTITY.company,
    interfaces: [
      {
        id: 'api-client',
        title: 'Platform API client',
        clientIdConfigured: configured(runtime.apiClientId),
        secretConfigured: configured(runtime.apiClientSecret),
        scopes: ['api:read', 'api:write', 'refund:read', 'refund:ingest', 'refund:admin'],
        endpoint: wiring.byId['api-gateway']?.baseUrl
      },
      {
        id: 'tds-client',
        title: 'TDS client',
        clientIdConfigured: configured(runtime.tdsClientId),
        secretConfigured: configured(runtime.tdsClientSecret),
        scopes: ['tds:pull', 'tds:normalize', 'refund:ingest'],
        endpoint: wiring.byId['transcript-service']?.baseUrl
      },
      {
        id: 'irs-oauth',
        title: 'IRS OAuth2 / client assertion',
        clientIdConfigured: configured(irs.clientId),
        keyConfigured: configured(irs.keyId) && configured(irs.privateKeyPath),
        tokenUrl: irs.tokenUrl,
        scope: irs.scope,
        endpoint: wiring.byId['irs-gateway']?.baseUrl
      },
      {
        id: 'secure-tunnel',
        title: 'Approved secure tunnel',
        endpointConfigured: configured(runtime.approvedTunnelEndpoint),
        endpoint: runtime.approvedTunnelEndpoint
      }
    ],
    wiring: wiring.services,
    runtime: redactConfig(runtime),
    irs: redactIrsConfig(irs),
    protection: evaluateEnvironmentProtection(runtime)
  };
}

export function createPractitionerSuite({
  env = process.env,
  registry = null,
  releaseStore = null
} = {}) {
  const firm = loadFirmIdentity(env);
  const clients = registry ?? createClientRegistry({ env, persist: false });
  const releases = releaseStore ?? createRefundReleaseStore();
  const assist = createAiAssist();
  const integrations = describeIntegrationInterfaces(env);

  async function ensureClients() {
    await clients.loadPersisted();
    clients.seedFromEnv();
    await clients.ensureLocalClients();
    return clients.status();
  }

  function accountInterface() {
    const clientStatus = clients.status();
    const apiOk = (clientStatus.clients || []).some((c) => c.kind === 'api' && c.status === 'active') ||
      integrations.interfaces.find((i) => i.id === 'api-client')?.clientIdConfigured;
    const tdsOk = (clientStatus.clients || []).some((c) => c.kind === 'tds' && c.status === 'active') ||
      integrations.interfaces.find((i) => i.id === 'tds-client')?.clientIdConfigured;
    const irsOk = integrations.interfaces.find((i) => i.id === 'irs-oauth')?.clientIdConfigured;

    const account = {
      name: firm.operator?.name || firm.company,
      form8821Status: firm.operator ? 'attested-on-file' : 'unset',
      cafRedacted: firm.ero.caf,
      ptinRedacted: firm.ero.ptin,
      efinRedacted: firm.ero.efin,
      etinRedacted: firm.ero.etin,
      state: firm.state,
      apiClientConfigured: Boolean(apiOk),
      tdsClientConfigured: Boolean(tdsOk),
      irsOAuthConfigured: Boolean(irsOk)
    };

    const xml = buildPractitionerAccountXml(account);
    const xhtml = buildPractitionerSuiteXhtml({
      caseId: 'suite',
      taxpayerRef: 'n/a',
      apiClient: account.apiClientConfigured ? 'configured' : 'unset',
      tdsClient: account.tdsClientConfigured ? 'configured' : 'unset',
      irsOAuth: account.irsOAuthConfigured ? 'configured' : 'unset',
      modules: [
        { name: 'tc-code-engine', status: 'ready', detail: '570/810 rectification' },
        { name: 'masterfile-pipeline', status: 'ready', detail: 'rectify → release gate' },
        { name: 'refund-release-core', status: 'ready', detail: 'request / approve / issue / reconcile' },
        { name: 'refund-intelligence-engine', status: 'ready', detail: 'guard + ETA' },
        { name: 'ai-assist', status: 'ready', detail: 'local heuristic' },
        { name: 'irs-xml', status: 'ready', detail: 'XHTML/XML builders' }
      ]
    });

    return {
      firm,
      account,
      xml,
      xhtml,
      xmlWellFormed: isWellFormedXml(xml),
      integrations,
      tcCatalog: TC_CATALOG,
      holdCodes: listHoldCodes()
    };
  }

  function runMasterfileCycle(input = {}) {
    const result = processMasterfileRecord(input);
    const xml = buildMasterfileRectificationXml({
      caseId: result.caseId,
      taxpayerRef: result.taxpayerRef,
      transactionCodes: result.analysis.codes,
      rectificationStatus: result.rectification ? 'rectified' : 'pending',
      resolvedHolds: result.rectification?.analysis.rectifiedHolds.map((c) => c.code) || [],
      operator: input.operator || firm.operator?.name || 'ero',
      liveIrsApplied: false,
      at: new Date().toISOString()
    });
    return { ...result, xml, xmlWellFormed: isWellFormedXml(xml) };
  }

  function assistRefundRelease(prompt) {
    return askAssist(prompt || 'How do I rectify TC 570 / 810 and request refund release after masterfile review?');
  }

  function intelligenceForCase(input = {}) {
    return buildRefundIntelligence({
      signals: {
        wmrStatus: input.wmrStatus || 'HOLD',
        masterfileStatus: input.masterfileStatus || 'HOLD',
        transcriptStatus: input.transcriptStatus || 'ACCEPTED',
        manualReview: input.manualReview === true
      },
      roi: input.roi || {}
    });
  }

  /**
   * Full ERO path: rectify 570+810 → release request → approve → scaffold issue → reconcile.
   */
  function executeRefundReleaseLifecycle(input = {}) {
    const caseId = String(input.caseId || '').trim();
    const taxpayerRef = String(input.taxpayerRef || '').trim();
    if (!caseId || !taxpayerRef) throw new Error('caseId and taxpayerRef are required.');
    const amount = Number(input.amount);
    if (Number.isNaN(amount)) throw new Error('amount is required.');

    const masterfile = runMasterfileCycle({
      caseId,
      taxpayerRef,
      transactionCodes: input.transactionCodes || [
        { code: '150', status: 'posted' },
        { code: '570', status: 'open' },
        { code: '810', status: 'open' },
        { code: '971', status: 'open' }
      ],
      rectifyCodes: input.rectifyCodes || ['570', '810'],
      operator: input.operator || firm.operator?.name || 'ero',
      notes: input.notes || 'ERO rectified masterfile hold/freeze after review.'
    });

    const intel = intelligenceForCase({
      wmrStatus: 'APPROVED',
      masterfileStatus: 'APPROVED',
      transcriptStatus: 'ACCEPTED'
    });

    const release = releases.requestRelease({
      caseId,
      taxpayerRef,
      amount,
      transactionCodes: masterfile.analysis.codes,
      masterfileRectified: true,
      requestedBy: input.operator || firm.operator?.name || 'ero',
      intelligence: intel
    });
    const approved = releases.approveRelease(release.id, { approver: input.operator || 'ero' });
    const issued = releases.issueRefund(approved.id, { issuer: input.operator || 'ero', scaffoldOnly: true });
    const reconciliation = releases.reconcile({
      releaseRequestId: issued.id,
      caseId,
      taxpayerRef,
      amount
    });

    return {
      company: PLATFORM_IDENTITY.company,
      masterfile,
      intelligence: intel,
      assist: assistRefundRelease(),
      release: issued,
      reconciliation,
      events: [
        masterfile.releaseEvent,
        { type: 'refund.release.requested', requestId: release.id, caseId },
        { type: 'refund.release.approved', requestId: issued.id, status: issued.status },
        { type: 'refund.reconciled', reconciliationId: reconciliation.id, balanced: reconciliation.balanced }
      ].filter(Boolean)
    };
  }

  return {
    firm,
    integrations,
    clients,
    releases,
    assist,
    ensureClients,
    accountInterface,
    runMasterfileCycle,
    assistRefundRelease,
    intelligenceForCase,
    executeRefundReleaseLifecycle,
    describe: () => ({
      name: 'irs-tax-practitioner-suite',
      company: PLATFORM_IDENTITY.company,
      application: PLATFORM_IDENTITY.application,
      modules: [
        '@rtp/irs-practitioner',
        '@rtp/irs-xml',
        '@rtp/refund-release-core',
        '@rtp/tc-code-engine',
        '@rtp/masterfile-pipeline',
        '@rtp/refund-intelligence-engine',
        '@rtp/ai-assist',
        '@rtp/client-identity',
        '@rtp/irs-gateway'
      ]
    })
  };
}
