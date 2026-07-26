import { fileURLToPath } from 'node:url';
import { createWorkerDescriptor, runWorker } from '../../../packages/platform-core/src/index.mjs';

export const aiPersonaWorkerDescriptor = createWorkerDescriptor({
  name: 'ai-persona-worker',
  responsibilities: [
    'Poll paid AI workforce queues for PAID_APPROVED / QUEUED tasks.',
    'Execute persona steps under RTP-AI-001 permitted actions only.',
    'Escalate HIGH/CRITICAL risk outputs to human review; never clear HOLD.'
  ],
  schedule: 'interval',
  mode: 'long-running'
});

export function start() {
  return runWorker({
    descriptor: aiPersonaWorkerDescriptor,
    steps: [
      'load-persona-register',
      'pull-paid-queued-tasks',
      'enforce-governance-gates',
      'run-persona-step',
      'route-human-review-or-hold',
      'emit-audit-events'
    ]
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  start();
}
