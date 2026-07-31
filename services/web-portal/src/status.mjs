// Probe other platform services' /health endpoints (used by /status + /api/status).

import { SERVICE_TARGETS } from './content.mjs';

async function probeOne(target, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`http://localhost:${target.port}/health`, {
      signal: controller.signal
    });
    if (!response.ok) return { ...target, healthy: false };
    const body = await response.json();
    return { ...target, healthy: body.status === 'ok' };
  } catch {
    return { ...target, healthy: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Probe all known services in parallel. Returns [{ name, port, healthy }]. */
export async function probeServices({ timeoutMs = 800 } = {}) {
  return Promise.all(SERVICE_TARGETS.map((target) => probeOne(target, timeoutMs)));
}
