// AI-assisted module advisor for the RTPSC platform.
//
// This is a local, dependency-free heuristic engine (no external LLM or API key
// required). It analyzes the module catalog to produce insights and
// recommendations, answers natural-language-style questions about the modules,
// and builds a dependency graph. All functions are pure: they take the catalog
// array produced by the modules-dashboard and return plain serializable data.

function flattenModules(catalog) {
  return catalog.flatMap((group) => group.modules.map((module) => ({ ...module, category: group.category })));
}

function byCategory(catalog, category) {
  return catalog.find((group) => group.category === category)?.modules ?? [];
}

/** Produce dashboard insights + recommendations from the catalog. */
export function buildInsights(catalog) {
  const workflows = byCategory(catalog, 'workflows');
  const services = byCategory(catalog, 'services');
  const packages = byCategory(catalog, 'packages');

  const triggerCounts = { event: 0, schedule: 0, manual: 0 };
  for (const workflow of workflows) {
    const type = workflow.detail?.trigger?.type ?? 'manual';
    triggerCounts[type] = (triggerCounts[type] ?? 0) + 1;
  }

  const dependencyLeaders = services
    .map((service) => ({ name: service.name, dependencies: service.detail?.dependencies?.length ?? 0 }))
    .sort((a, b) => b.dependencies - a.dependencies);

  const totalModules = catalog.reduce((sum, group) => sum + group.modules.length, 0);
  const categoryCounts = catalog.map((group) => ({ category: group.category, count: group.modules.length }));

  const recommendations = [];

  const secureTunnel = packages.find((module) => module.name.includes('secure-tunnel'));
  if (secureTunnel && secureTunnel.detail?.status === 'stub') {
    recommendations.push({
      severity: 'warning',
      module: secureTunnel.name,
      message: 'Secure tunnel adapter is a stub — implement only after compliance and security sign-off.'
    });
  }

  if (triggerCounts.schedule > 0) {
    recommendations.push({
      severity: 'info',
      module: 'workflow-runner',
      message: `${triggerCounts.schedule} scheduled workflow(s) run automatically in the background via the workflow-runner worker.`
    });
  }

  if (triggerCounts.event > 0) {
    recommendations.push({
      severity: 'info',
      message: `${triggerCounts.event} event-driven workflow(s) react to emitted platform events.`
    });
  }

  const busiest = dependencyLeaders[0];
  if (busiest && busiest.dependencies >= 3) {
    recommendations.push({
      severity: 'advice',
      module: busiest.name,
      message: `${busiest.name} declares ${busiest.dependencies} dependencies — add contract tests to protect these edges.`
    });
  }

  recommendations.push({
    severity: 'advice',
    message: 'All modules are executable stubs. Prioritize schema contracts and persistence before wiring real integrations.'
  });

  return {
    totalModules,
    categoryCounts,
    triggerCounts,
    backgroundWorkflows: triggerCounts.event + triggerCounts.schedule,
    dependencyLeaders: dependencyLeaders.slice(0, 3),
    recommendations
  };
}

function scoreModule(module, terms) {
  const name = module.name.toLowerCase();
  const summary = (module.summary ?? '').toLowerCase();
  const tags = (module.tags ?? []).join(' ').toLowerCase();
  const category = module.category.toLowerCase();

  let score = 0;
  for (const term of terms) {
    if (name.includes(term)) score += 4;
    if (category.includes(term)) score += 3;
    if (tags.includes(term)) score += 2;
    if (summary.includes(term)) score += 1;
  }
  return score;
}

function workflowsByTrigger(catalog, type) {
  return byCategory(catalog, 'workflows').filter((workflow) => (workflow.detail?.trigger?.type ?? 'manual') === type);
}

function listNames(modules) {
  return modules.map((module) => module.name).join(', ') || 'none';
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'to', 'is', 'are', 'what', 'which', 'how', 'many', 'do', 'does',
  'show', 'me', 'list', 'all', 'that', 'and', 'or', 'in', 'on', 'for', 'with', 'i', 'can', 'get'
]);

/**
 * Answer a natural-language-style query about the modules using intent detection
 * plus keyword scoring. Returns a synthesized answer and matched modules.
 */
export function answerQuery(catalog, rawQuery) {
  const query = String(rawQuery ?? '').toLowerCase().trim();
  if (!query) {
    return {
      intent: 'empty',
      answer: 'Ask about modules, categories, triggers, dependencies, or compliance.',
      matches: [],
      suggestions: [
        'Which workflows are event-driven?',
        'How many modules are there?',
        'What depends on the api-gateway?',
        'Show compliance-related modules'
      ]
    };
  }

  if (/\bevent(-|\s)?driven\b|\bevent\b/.test(query)) {
    const matches = workflowsByTrigger(catalog, 'event');
    return {
      intent: 'trigger:event',
      answer: `There ${matches.length === 1 ? 'is' : 'are'} ${matches.length} event-driven workflow(s): ${listNames(matches)}.`,
      matches
    };
  }

  if (/\bschedule|scheduled|cron|background\b/.test(query)) {
    const matches = workflowsByTrigger(catalog, 'schedule');
    return {
      intent: 'trigger:schedule',
      answer: `${matches.length} scheduled workflow(s) run in the background: ${listNames(matches)}.`,
      matches
    };
  }

  if (/\bmanual\b/.test(query)) {
    const matches = workflowsByTrigger(catalog, 'manual');
    return {
      intent: 'trigger:manual',
      answer: `${matches.length} manual workflow(s): ${listNames(matches)}.`,
      matches
    };
  }

  if (/how many|count|number of/.test(query)) {
    const total = catalog.reduce((sum, group) => sum + group.modules.length, 0);
    const perCategory = catalog.map((group) => `${group.modules.length} ${group.category}`).join(', ');
    return {
      intent: 'count',
      answer: `There are ${total} modules total: ${perCategory}.`,
      matches: []
    };
  }

  if (/depend|require|uses|consume/.test(query)) {
    const services = byCategory(catalog, 'services');
    const target = services.find((service) => query.includes(service.name.toLowerCase()));
    if (target) {
      const dependents = services.filter((service) =>
        (service.detail?.dependencies ?? []).some((dep) => dep.toLowerCase() === target.name.toLowerCase())
      );
      return {
        intent: 'dependents',
        answer:
          dependents.length > 0
            ? `${listNames(dependents)} depend on ${target.name}. ${target.name} itself declares: ${(target.detail?.dependencies ?? []).join(', ') || 'no dependencies'}.`
            : `Nothing declares a dependency on ${target.name}. It declares: ${(target.detail?.dependencies ?? []).join(', ') || 'no dependencies'}.`,
        matches: [target, ...dependents]
      };
    }
    const withDeps = services
      .filter((service) => (service.detail?.dependencies?.length ?? 0) > 0)
      .sort((a, b) => (b.detail?.dependencies?.length ?? 0) - (a.detail?.dependencies?.length ?? 0));
    return {
      intent: 'dependencies',
      answer: `Services with declared dependencies: ${withDeps.map((s) => `${s.name} (${s.detail.dependencies.length})`).join(', ') || 'none'}.`,
      matches: withDeps
    };
  }

  if (/complian|secure|tunnel|governance|audit/.test(query)) {
    const all = flattenModules(catalog);
    const matches = all.filter(
      (module) =>
        /complian|secure|tunnel|governance|config/.test(module.name.toLowerCase()) ||
        (module.tags ?? []).some((tag) => /complian|secure|governance/.test(tag.toLowerCase()))
    );
    return {
      intent: 'compliance',
      answer: `Compliance-relevant modules: ${listNames(matches)}. The secure-tunnel adapter remains a stub pending sign-off.`,
      matches
    };
  }

  const terms = query.split(/[^a-z0-9]+/).filter((term) => term.length > 1 && !STOP_WORDS.has(term));
  const all = flattenModules(catalog);
  const scored = all
    .map((module) => ({ module, score: scoreModule(module, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (scored.length === 0) {
    return {
      intent: 'unknown',
      answer: `No modules matched "${rawQuery}". Try a module name, a category (services, workflows, engines…), or ask about triggers/dependencies.`,
      matches: []
    };
  }

  const matches = scored.map((entry) => entry.module);
  return {
    intent: 'search',
    answer: `Top ${matches.length} match(es) for "${rawQuery}": ${listNames(matches)}.`,
    matches
  };
}

/** Build a dependency graph (nodes + edges) from the catalog. */
export function buildDependencyGraph(catalog) {
  const nodes = new Map();
  const edges = [];

  const addNode = (id, category) => {
    if (!nodes.has(id)) nodes.set(id, { id, category });
  };

  for (const group of catalog) {
    for (const module of group.modules) {
      addNode(module.name, group.category);
    }
  }

  for (const service of byCategory(catalog, 'services')) {
    for (const dependency of service.detail?.dependencies ?? []) {
      addNode(dependency, nodes.get(dependency)?.category ?? 'external');
      edges.push({ from: service.name, to: dependency, type: 'depends-on' });
    }
  }

  const runner = byCategory(catalog, 'workers').find((worker) => worker.name === 'workflow-runner');
  for (const workflowName of runner?.detail?.drives ?? []) {
    addNode(workflowName, nodes.get(workflowName)?.category ?? 'workflows');
    edges.push({ from: 'workflow-runner', to: workflowName, type: 'drives' });
  }

  return { nodes: [...nodes.values()], edges };
}
