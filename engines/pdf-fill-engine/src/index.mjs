import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngineDescriptor } from '../../../packages/platform-core/src/index.mjs';

export const pdfFillEngine = createEngineDescriptor({
  name: 'pdf-fill-engine',
  capabilities: [
    'template-load',
    'field-mapping',
    'deterministic-fill',
    'python-scaffold-handoff',
    'compliance-guardrails'
  ],
  outputs: ['filled-pdf-descriptor', 'field-map', 'fill-plan']
});

const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pythonEntry = path.join(engineRoot, 'src', 'fill.py');

/**
 * Describe a fill job without writing binary PDF output (scaffold-safe).
 */
export function describeFillJob({
  template = 'forms/templates',
  fields = {},
  outputPath = null
} = {}) {
  const fieldMap = Object.entries(fields).map(([name, value]) => ({
    name,
    value: value == null ? '' : String(value),
    sensitive: /ssn|tin|ein|dob|account/i.test(name)
  }));

  return {
    engine: pdfFillEngine.name,
    status: 'planned',
    template: String(template),
    outputPath: outputPath || null,
    fieldCount: fieldMap.length,
    fieldMap,
    actions: ['load-template', 'map-fields', 'write-output'],
    compliance: pdfFillEngine.compliance,
    note: 'Binary PDF write requires approved signing material; descriptor-only in scaffold mode.'
  };
}

/**
 * Invoke the Python scaffold for a JSON descriptor (optional runtime check).
 */
export function runPythonDescribe({ template = 'forms/templates', pythonBin = 'python3' } = {}) {
  const result = spawnSync(pythonBin, [pythonEntry, '--template', String(template), '--json'], {
    encoding: 'utf8',
    cwd: path.resolve(engineRoot, '../..')
  });

  if (result.error) {
    return {
      ok: false,
      code: 'python_spawn_failed',
      message: result.error.message,
      engine: pdfFillEngine.name
    };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      code: 'python_exit_nonzero',
      message: (result.stderr || result.stdout || '').trim() || `exit ${result.status}`,
      engine: pdfFillEngine.name
    };
  }

  try {
    return {
      ok: true,
      engine: pdfFillEngine.name,
      python: JSON.parse(result.stdout)
    };
  } catch (error) {
    return {
      ok: false,
      code: 'invalid_python_json',
      message: error.message,
      raw: result.stdout,
      engine: pdfFillEngine.name
    };
  }
}

export function planFill(input = {}) {
  const job = describeFillJob(input);
  return {
    ...job,
    outputs: pdfFillEngine.outputs,
    ready: job.fieldCount >= 0
  };
}
