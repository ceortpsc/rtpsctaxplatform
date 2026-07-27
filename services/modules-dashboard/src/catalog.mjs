import { createServiceDescriptor } from '../../../packages/platform-core/src/index.mjs';
import { describeWorkflow } from '../../../packages/workflow-engine/src/index.mjs';
import { clientIdentityPlaceholders } from '../../../packages/client-config/src/index.mjs';
import { createSecureTunnelAdapter } from '../../../packages/secure-tunnel/src/index.mjs';
import { gatewayDescriptor } from '../../../services/api-gateway/src/index.mjs';
import { refundStatusDescriptor } from '../../../services/refund-status-service/src/index.mjs';
import { transcriptDescriptor } from '../../../services/transcript-service/src/index.mjs';
import { analyticsDescriptor } from '../../../services/analytics-service/src/index.mjs';
import { enrollmentDescriptor } from '../../../services/enrollment-service/src/index.mjs';
import { invoiceDescriptor } from '../../../services/invoice-service/src/index.mjs';
import { posCrmDescriptor } from '../../../services/pos-crm-service/src/index.mjs';
import { TAX_DATA_NOTICE } from '../../../packages/tax-data/src/index.mjs';
import { listServiceCatalog } from '../../../packages/invoice-core/src/index.mjs';
import { listPhraseTemplates } from '../../../packages/ero-ops/src/index.mjs';
import { tdsWorkerDescriptor } from '../../../workers/tds-worker/src/index.mjs';
import { transcriptPullWorkerDescriptor } from '../../../workers/transcript-pull-worker/src/index.mjs';
import { liveSourceFetcherDescriptor } from '../../../workers/live-source-fetcher/src/index.mjs';
import { transmissionPipeline } from '../../../pipelines/transmission-pipeline/src/index.mjs';
import { masterfilePipeline } from '../../../pipelines/masterfile-pipeline/src/index.mjs';
import { refundStatusPipeline } from '../../../pipelines/refund-status-pipeline/src/index.mjs';
import { refundIntelligenceEngine } from '../../../engines/refund-intelligence-engine/src/index.mjs';
import { analyticsCenter } from '../../../engines/analytics-center/src/index.mjs';
import { tcCodeEngine } from '../../../engines/tc-code-engine/src/index.mjs';
import { refundStatusWorkflow } from '../../../workflows/refund-status-workflow/src/index.mjs';
import { transcriptIntakeWorkflow } from '../../../workflows/transcript-intake-workflow/src/index.mjs';
import { transmissionWorkflow } from '../../../workflows/transmission-workflow/src/index.mjs';
import {
  agentAssignmentDispatchWorkflow,
  agentTaskRequestedWorkflow,
  agentAssignmentCycleWorkflow
} from '../../../workflows/agent-assignment-workflow/src/index.mjs';

// Descriptor for the modules-dashboard itself, defined here to avoid a circular
// import between the catalog and the HTTP service entrypoint.
export const modulesDashboardDescriptor = createServiceDescriptor({
  name: 'modules-dashboard',
  domain: 'operations',
  responsibilities: [
    'Serve a read-only catalog of every platform module.',
    'Surface module category, metadata, and relationships.',
    'Provide module inventory to operators (workflows run in the background).'
  ],
  dependencies: []
});

const SERVICE_PORTS = {
  'api-gateway': 3000,
  'refund-status-service': 3001,
  'transcript-service': 3002,
  'analytics-service': 3003,
  'enrollment-service': 3004,
  'invoice-service': 3005,
  'pos-crm-service': 3006,
  'modules-dashboard': 3010
};

/** Service name/port pairs used for live status checks. */
export const SERVICE_ENDPOINTS = Object.entries(SERVICE_PORTS).map(([name, port]) => ({ name, port }));

function serviceEntry(descriptor) {
  return {
    name: descriptor.name,
    summary: descriptor.responsibilities[0] ?? '',
    tags: [descriptor.domain, `port:${SERVICE_PORTS[descriptor.name] ?? 'n/a'}`],
    detail: {
      responsibilities: descriptor.responsibilities,
      dependencies: descriptor.dependencies
    }
  };
}

function workerEntry(descriptor) {
  return {
    name: descriptor.name,
    summary: descriptor.responsibilities[0] ?? '',
    tags: [descriptor.schedule, descriptor.mode],
    detail: { responsibilities: descriptor.responsibilities }
  };
}

function pipelineEntry(pipeline) {
  return {
    name: pipeline.name,
    summary: `${pipeline.stages.length} stages → ${pipeline.outputs.length} outputs`,
    tags: ['pipeline'],
    detail: { stages: pipeline.stages, outputs: pipeline.outputs }
  };
}

function engineEntry(engine) {
  return {
    name: engine.name,
    summary: `${engine.capabilities.length} capabilities`,
    tags: ['engine'],
    detail: { capabilities: engine.capabilities, outputs: engine.outputs }
  };
}

function workflowEntry(workflow) {
  const described = describeWorkflow(workflow);
  const triggerLabel =
    described.trigger.type === 'event'
      ? `event:${described.trigger.on}`
      : described.trigger.type === 'schedule'
        ? `schedule:${Math.round(described.trigger.everyMs / 1000)}s`
        : 'manual';
  return {
    name: described.name,
    summary: described.description,
    tags: [triggerLabel, ...described.tags],
    detail: {
      trigger: described.trigger,
      steps: described.steps.map((step) => step.name)
    }
  };
}

export function buildModuleCatalog() {
  return [
    {
      category: 'packages',
      description: 'Shared libraries and runtime primitives.',
      modules: [
        {
          name: '@rtp/platform-core',
          summary: 'Runtime config, HTTP/worker helpers, and descriptor factories.',
          tags: ['runtime', 'shared'],
          detail: { helpers: ['loadRuntimeConfig', 'startHttpService', 'runWorker'] }
        },
        {
          name: '@rtp/client-config',
          summary: 'API/TDS/tunnel credential placeholders and governance notes.',
          tags: ['config'],
          detail: { placeholders: clientIdentityPlaceholders }
        },
        {
          name: '@rtp/client-identity',
          summary: 'Full API + TDS client id issuance, authentication, scopes, and auth audit logging.',
          tags: ['identity', 'api-client', 'tds-client'],
          detail: { kinds: ['api', 'tds'], commands: ['./rtpsc clients issue api', './rtpsc clients issue tds'] }
        },
        {
          name: '@rtp/refund-core',
          summary: 'Full refund cases, approved-event ingest, pipeline stages, workflow + intelligence.',
          tags: ['refund', 'pipeline', 'intelligence'],
          detail: { channels: ['refund.status.received', 'refund.status.updated'] }
        },
        {
          name: '@rtp/secure-tunnel',
          summary: 'Compliant secure tunnel adapter interface (stub-safe).',
          tags: ['compliance'],
          detail: { status: createSecureTunnelAdapter().status }
        },
        {
          name: '@rtp/workflow-engine',
          summary: 'Modular task/workflow/trigger engine with run history.',
          tags: ['workflow', 'engine'],
          detail: { primitives: ['defineTask', 'defineWorkflow', 'createWorkflowRunner', 'createTriggerManager'] }
        },
        {
          name: '@rtp/agent-core',
          summary: 'Deployment-assist agent primitives, required-task assignment board, and assignment triggers.',
          tags: ['agents', 'assignments', 'triggers'],
          detail: {
            primitives: ['defineAgent', 'defineAssignment', 'createAssignmentBoard', 'createPlatformAssignmentBoard'],
            commands: ['./rtpsc agents list', './rtpsc agents run required', './rtpsc agents trigger event']
          }
        },
        {
          name: '@rtp/bank-products',
          summary: 'SBTPG products, login clearance/audit logging, disclosures, and the fail-safe payment gate.',
          tags: ['bank-products', 'sbtpg', 'auth', 'audit'],
          detail: {
            provider: 'SBTPG',
            products: ['RA-NF', 'RA-FC', 'RT'],
            auth: ['validateSbtpgLogin', 'createSbtpgClearanceStore', 'evaluateLoginClearance'],
            envKeys: ['SBTPG_USERNAME', 'SBTPG_SECRET', 'SBTPG_ENABLED']
          }
        },
        {
          name: '@rtp/tax-data',
          summary: 'State and county/parish taxation reference data for invoicing calculations.',
          tags: ['tax', 'jurisdiction', 'parish'],
          detail: { notice: TAX_DATA_NOTICE[0], localityKinds: ['county', 'parish'] }
        },
        {
          name: '@rtp/invoice-core',
          summary: 'Invoicing machine core: AI data entry, tax calc, payment approval/confirmation, PDF & receipt export.',
          tags: ['invoicing', 'ai-assist', 'pdf', 'receipt'],
          detail: { catalogSkus: listServiceCatalog().map((s) => s.sku), exports: ['pdf', 'receipt.pdf', 'receipt.txt'] }
        },
        {
          name: '@rtp/crm-core',
          summary: 'CRM contacts, household accounts, and interaction timeline for tax-prep operations.',
          tags: ['crm', 'contacts'],
          detail: { entities: ['contact', 'account', 'interaction'] }
        },
        {
          name: '@rtp/pos-core',
          summary: 'Point of Sale sessions/carts that check out through invoice-core and link sales back to CRM.',
          tags: ['pos', 'checkout', 'crm-linked'],
          detail: { integrates: ['@rtp/crm-core', '@rtp/invoice-core', '@rtp/tax-data'] }
        },
        {
          name: '@rtp/ero-ops',
          summary: 'SBTPG report tracing, automated ERO phrasing, and refund-intelligence scoring.',
          tags: ['ero', 'sbtpg', 'refund-intelligence'],
          detail: { phrases: listPhraseTemplates().map((t) => t.code) }
        },
        {
          name: '@rtp/client-masterfile',
          summary: 'Alphabetical client master file and Full ERO Client Status matrix (CRM · Refund · SBTPG · E-file).',
          tags: ['masterfile', 'ero', 'matrix', 'directory'],
          detail: {
            channels: ['crm', 'refund', 'sbtpg', 'efile', 'overall'],
            apis: ['GET /api/masterfile', 'GET /api/masterfile/lookup', 'GET /api/ero/matrix'],
            sort: 'alphabetical last-name'
          }
        },
        {
          name: '@rtp/party-identity',
          summary: 'Issuance of Client ID # (CL-######) and Customer ID # (CU-######) for tax-party records.',
          tags: ['identity', 'client-id', 'customer-id'],
          detail: {
            prefixes: { client: 'CL', customer: 'CU' },
            commands: ['./rtpsc ids issue pair', './rtpsc ids status'],
            distinctFrom: '@rtp/client-identity'
          }
        },
        {
          name: '@rtp/canvas-core',
          summary: 'Cursor Canvas creation — generate .canvas.tsx artifacts from live platform state.',
          tags: ['canvas', 'cursor', 'devtools'],
          detail: {
            kinds: ['platform', 'compliance', 'agents', 'modules'],
            commands: ['./rtpsc canvas create all', './rtpsc canvas list'],
            output: '.cursor/canvases/*.canvas.tsx'
          }
        }
      ]
    },
    {
      category: 'services',
      description: 'HTTP service surfaces.',
      modules: [
        serviceEntry(gatewayDescriptor),
        serviceEntry(refundStatusDescriptor),
        serviceEntry(transcriptDescriptor),
        serviceEntry(analyticsDescriptor),
        serviceEntry(enrollmentDescriptor),
        serviceEntry(invoiceDescriptor),
        serviceEntry(posCrmDescriptor),
        serviceEntry(modulesDashboardDescriptor)
      ]
    },
    {
      category: 'workers',
      description: 'Background processes (including the workflow runner).',
      modules: [
        workerEntry(tdsWorkerDescriptor),
        workerEntry(transcriptPullWorkerDescriptor),
        workerEntry(liveSourceFetcherDescriptor),
        {
          name: 'workflow-runner',
          summary: 'Runs all modular workflows in the background (schedules + events).',
          tags: ['always-on', 'background'],
          detail: {
            drives: [
              'refund-status-update',
              'transcript-intake',
              'transmission-cycle',
              'agent-assignment-dispatch',
              'agent-task-requested',
              'agent-assignment-cycle'
            ]
          }
        }
      ]
    },
    {
      category: 'pipelines',
      description: 'Staged data processing definitions.',
      modules: [pipelineEntry(transmissionPipeline), pipelineEntry(masterfilePipeline), pipelineEntry(refundStatusPipeline)]
    },
    {
      category: 'engines',
      description: 'Analytical and intelligence engines.',
      modules: [engineEntry(refundIntelligenceEngine), engineEntry(analyticsCenter), engineEntry(tcCodeEngine)]
    },
    {
      category: 'workflows',
      description: 'Modular workflow definitions (executed by the background workflow-runner).',
      modules: [
        workflowEntry(refundStatusWorkflow),
        workflowEntry(transcriptIntakeWorkflow),
        workflowEntry(transmissionWorkflow),
        workflowEntry(agentAssignmentDispatchWorkflow),
        workflowEntry(agentTaskRequestedWorkflow),
        workflowEntry(agentAssignmentCycleWorkflow)
      ]
    }
  ];
}

export function catalogSummary(catalog = buildModuleCatalog()) {
  return {
    totalModules: catalog.reduce((sum, group) => sum + group.modules.length, 0),
    categories: catalog.map((group) => ({ category: group.category, count: group.modules.length }))
  };
}
