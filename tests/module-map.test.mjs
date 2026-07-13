import test from 'node:test';
import assert from 'node:assert/strict';
import { gatewayDescriptor } from '../services/api-gateway/src/index.mjs';
import { refundStatusDescriptor } from '../services/refund-status-service/src/index.mjs';
import { transcriptDescriptor } from '../services/transcript-service/src/index.mjs';
import { analyticsDescriptor } from '../services/analytics-service/src/index.mjs';
import { transmissionPipeline } from '../pipelines/transmission-pipeline/src/index.mjs';
import { masterfilePipeline } from '../pipelines/masterfile-pipeline/src/index.mjs';
import { refundStatusPipeline } from '../pipelines/refund-status-pipeline/src/index.mjs';
import { refundIntelligenceEngine } from '../engines/refund-intelligence-engine/src/index.mjs';
import { analyticsCenter } from '../engines/analytics-center/src/index.mjs';
import { tcCodeEngine } from '../engines/tc-code-engine/src/index.mjs';
import { clientIdentityPlaceholders } from '../packages/client-config/src/index.mjs';
import { createSecureTunnelAdapter } from '../packages/secure-tunnel/src/index.mjs';

test('scaffold modules expose expected domain metadata', () => {
  assert.equal(gatewayDescriptor.name, 'api-gateway');
  assert.equal(refundStatusDescriptor.domain, 'refund-status');
  assert.equal(transcriptDescriptor.domain, 'transcripts');
  assert.equal(analyticsDescriptor.domain, 'analytics');
  assert.deepEqual(clientIdentityPlaceholders.api, ['API_CLIENT_ID', 'API_CLIENT_SECRET']);
  assert.equal(createSecureTunnelAdapter().status, 'stub');
  assert.ok(transmissionPipeline.stages.includes('handoff-approved-tunnel'));
  assert.ok(masterfilePipeline.stages.includes('normalize-masterfile'));
  assert.ok(refundStatusPipeline.outputs.includes('refund-status-alert'));
  assert.ok(refundIntelligenceEngine.capabilities.includes('risk-flagging'));
  assert.ok(analyticsCenter.outputs.includes('analytics-feed'));
  assert.ok(tcCodeEngine.capabilities.includes('tc-code-catalog'));
});
