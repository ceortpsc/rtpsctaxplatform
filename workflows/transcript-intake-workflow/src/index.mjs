import { defineTask, defineWorkflow } from '../../../packages/workflow-engine/src/index.mjs';

// Manually triggered transcript intake workflow. Demonstrates an authorization
// gate that fails the run when consent/authorization is not present, exercising
// the engine's failure path. Operates on simulated transcript data only.

export const receiveRequestTask = defineTask({
  name: 'receive-request',
  description: 'Accept a transcript intake request and capture requested products.',
  run: (context) => {
    const { requestId, products = ['account-transcript'] } = context.input;
    if (!requestId) {
      throw new Error('requestId is required for transcript intake.');
    }
    context.log(`Received transcript request ${requestId}.`);
    return { requestId: String(requestId), products: [...products] };
  }
});

export const validateAuthorizationTask = defineTask({
  name: 'validate-authorization',
  description: 'Enforce that documented taxpayer authorization is present before intake.',
  run: (context) => {
    if (context.input.authorized !== true) {
      throw new Error('Taxpayer authorization is required and was not provided.');
    }
    context.log('Authorization confirmed.');
    return { authorized: true };
  }
});

export const normalizeTranscriptTask = defineTask({
  name: 'normalize-transcript',
  description: 'Normalize requested transcript products into canonical records.',
  run: (context) => {
    const records = context.state.products.map((product) => ({
      product,
      record: `${product}:${context.state.requestId}`,
      normalized: true
    }));
    context.log(`Normalized ${records.length} transcript record(s).`);
    return { records };
  }
});

export const packageTdsPacketTask = defineTask({
  name: 'package-tds-packet',
  description: 'Bundle normalized records into a TDS packet ready for downstream pipelines.',
  run: (context) => ({
    tdsPacket: {
      requestId: context.state.requestId,
      recordCount: context.state.records.length,
      products: context.state.products,
      sealed: true
    }
  })
});

export const transcriptIntakeWorkflow = defineWorkflow({
  name: 'transcript-intake',
  description: 'Validate authorization, normalize transcript products, and package a TDS packet.',
  trigger: { type: 'manual' },
  tags: ['transcript', 'manual', 'authorization-gated'],
  steps: [receiveRequestTask, validateAuthorizationTask, normalizeTranscriptTask, packageTdsPacketTask]
});
