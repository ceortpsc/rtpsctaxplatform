import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { canonicalize } from '../lib/canonical.mjs';
import { sha256, digestUri } from '../lib/hash.mjs';

export function loadTaskfile(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('taskfile must be an object');
  if (!raw.tasks || typeof raw.tasks !== 'object') throw new Error('taskfile.tasks required');
  return raw;
}

export function buildGraph(taskfile, target) {
  const tasks = taskfile.tasks;
  if (!tasks[target]) throw new Error(`Unknown task: ${target}`);
  const nodes = new Set();
  const edges = [];
  const visiting = new Set();

  function walk(name) {
    if (visiting.has(name)) throw new Error(`Cycle detected at task: ${name}`);
    if (nodes.has(name)) return;
    if (!tasks[name]) throw new Error(`Unknown dependency task: ${name}`);
    visiting.add(name);
    const deps = tasks[name].dependsOn || [];
    for (const dep of deps) {
      edges.push({ from: dep, to: name });
      walk(dep);
    }
    visiting.delete(name);
    nodes.add(name);
  }

  walk(target);
  return { target, nodes: [...nodes], edges };
}

export function topologicalOrder(graph, tasks) {
  const indegree = new Map(graph.nodes.map((n) => [n, 0]));
  const outbound = new Map(graph.nodes.map((n) => [n, []]));
  for (const edge of graph.edges) {
    indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1);
    outbound.get(edge.from).push(edge.to);
  }
  const ready = graph.nodes.filter((n) => indegree.get(n) === 0).sort();
  const order = [];
  while (ready.length) {
    const node = ready.shift();
    order.push(node);
    for (const next of (outbound.get(node) || []).sort()) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) ready.push(next);
      ready.sort();
    }
  }
  if (order.length !== graph.nodes.length) throw new Error('Cycle detected during topological sort');
  // Prefer declared dependency depth while keeping determinism
  return order.filter((name) => tasks[name]);
}

export function criticalPath(graph, tasks) {
  const duration = (name) => Number(tasks[name]?.timeoutMs || tasks[name]?.estimateMs || 1000);
  const preds = new Map(graph.nodes.map((n) => [n, []]));
  for (const edge of graph.edges) preds.get(edge.to).push(edge.from);
  const dist = new Map();
  const parent = new Map();
  for (const node of topologicalOrder(graph, tasks)) {
    const incoming = preds.get(node) || [];
    let best = 0;
    let bestPred = null;
    for (const p of incoming) {
      const candidate = dist.get(p) || 0;
      if (candidate >= best) {
        best = candidate;
        bestPred = p;
      }
    }
    dist.set(node, best + duration(node));
    parent.set(node, bestPred);
  }
  let end = graph.target;
  for (const [node, value] of dist.entries()) {
    if (value > (dist.get(end) || 0)) end = node;
  }
  const pathNodes = [];
  for (let cur = end; cur; cur = parent.get(cur)) pathNodes.push(cur);
  pathNodes.reverse();
  return { path: pathNodes, estimateMs: dist.get(end) || 0 };
}

export async function fingerprintInputs(root, inputs = []) {
  const parts = [];
  for (const rel of [...inputs].sort()) {
    const abs = path.join(root, rel);
    try {
      const body = await readFile(abs);
      parts.push(`${rel}:${sha256(body)}`);
    } catch {
      parts.push(`${rel}:missing`);
    }
  }
  return digestUri(sha256(parts.join('|')));
}

async function pathExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function runCommand(command, { cwd, env, timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            child.kill('SIGKILL');
          }, timeoutMs)
        : null;
    child.stdout.on('data', (d) => {
      stdout += d.toString('utf8');
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
    });
    child.on('close', (code, signal) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? 1, signal, stdout, stderr });
    });
  });
}

export async function planTasks(taskfile, target, { root = process.cwd(), jobs } = {}) {
  const graph = buildGraph(taskfile, target);
  const order = topologicalOrder(graph, taskfile.tasks);
  const crit = criticalPath(graph, taskfile.tasks);
  return {
    target,
    jobs: jobs || taskfile.jobs || 1,
    order,
    graph,
    criticalPath: crit,
    parallelWidth: Math.min(jobs || taskfile.jobs || 1, order.length),
    root
  };
}

export async function runTasks(taskfile, target, options = {}) {
  const root = options.root || process.cwd();
  const jobs = Math.max(1, Number(options.jobs || taskfile.jobs || 1));
  const dryRun = Boolean(options.dryRun);
  const force = Boolean(options.force);
  const capture = Boolean(options.capture);
  const plan = await planTasks(taskfile, target, { root, jobs });
  const cacheDir = path.join(root, taskfile.cacheDir || '.ross/cache/tasks');
  await mkdir(cacheDir, { recursive: true });

  const results = [];
  const failed = new Set();
  const completed = new Set();
  const pending = new Set(plan.order);
  const running = new Map();

  async function execute(name) {
    const task = taskfile.tasks[name];
    const deps = task.dependsOn || [];
    if (deps.some((d) => failed.has(d))) {
      const result = { name, status: 'blocked', reason: 'dependency failed' };
      results.push(result);
      failed.add(name);
      pending.delete(name);
      return result;
    }

    const inputFp = await fingerprintInputs(root, task.inputs || []);
    const cacheKey = sha256(canonicalize({ name, command: task.command, inputFp, env: task.env || {} }));
    const cachePath = path.join(cacheDir, cacheKey);

    if (!force && task.cache !== false && (await pathExists(cachePath))) {
      const cached = JSON.parse(await readFile(cachePath, 'utf8'));
      const result = { ...cached, name, status: 'cache-hit' };
      results.push(result);
      completed.add(name);
      pending.delete(name);
      return result;
    }

    if (dryRun) {
      const result = { name, status: 'planned', command: task.command, inputFp };
      results.push(result);
      completed.add(name);
      pending.delete(name);
      return result;
    }

    const startedAt = Date.now();
    const env = {
      ...filterEnv(process.env, task.envAllowlist),
      ...(taskfile.env || {}),
      ...(task.env || {})
    };
    const cwd = task.cwd ? path.join(root, task.cwd) : root;
    const timeoutMs = Number(task.timeoutMs || taskfile.defaultTimeoutMs || 0);
    const retries = Number(task.retries || 0);
    let attempt = 0;
    let last;
    while (attempt <= retries) {
      attempt += 1;
      last = await runCommand(task.command, { cwd, env, timeoutMs });
      if (last.code === 0) break;
    }

    const outputs = task.outputs || [];
    const missingOutputs = [];
    for (const out of outputs) {
      if (!(await pathExists(path.join(root, out)))) missingOutputs.push(out);
    }

    const ok = last.code === 0 && missingOutputs.length === 0;
    const result = {
      name,
      status: ok ? 'passed' : 'failed',
      code: last.code,
      signal: last.signal,
      attempts: attempt,
      durationMs: Date.now() - startedAt,
      inputFp,
      missingOutputs,
      stdout: capture ? last.stdout : undefined,
      stderr: capture ? last.stderr : undefined
    };
    results.push(result);
    if (ok) {
      completed.add(name);
      if (task.cache !== false) {
        await writeFile(cachePath, `${JSON.stringify({ ...result, cachedAt: new Date().toISOString() }, null, 2)}\n`);
      }
    } else {
      failed.add(name);
    }
    pending.delete(name);
    return result;
  }

  async function pump() {
    while (pending.size > 0 || running.size > 0) {
      const ready = [...pending].filter((name) => {
        if (running.has(name)) return false;
        const deps = taskfile.tasks[name].dependsOn || [];
        return deps.every((d) => completed.has(d) || failed.has(d));
      });
      while (running.size < jobs && ready.length) {
        const name = ready.shift();
        const job = execute(name).finally(() => running.delete(name));
        running.set(name, job);
      }
      if (running.size === 0) break;
      await Promise.race(running.values());
    }
  }

  await pump();

  const receipt = {
    product: 'ROSS.CO Infinite',
    target,
    ok: failed.size === 0,
    startedAt: new Date().toISOString(),
    jobs,
    plan: { order: plan.order, criticalPath: plan.criticalPath },
    results
  };

  if (options.receipt) {
    const receiptPath = path.isAbsolute(options.receipt) ? options.receipt : path.join(root, options.receipt);
    await mkdir(path.dirname(receiptPath), { recursive: true });
    await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    receipt.receiptPath = receiptPath;
    receipt.digest = digestUri(sha256(JSON.stringify(receipt)));
  }

  return receipt;
}

function filterEnv(env, allowlist) {
  if (!allowlist) return { ...env };
  const out = {};
  for (const key of allowlist) {
    if (env[key] !== undefined) out[key] = env[key];
  }
  // Always preserve PATH for shell commands
  if (env.PATH) out.PATH = env.PATH;
  return out;
}

export async function clearTaskCache(root, cacheDir = '.ross/cache/tasks') {
  await rm(path.join(root, cacheDir), { recursive: true, force: true });
}
