/**
 * packages/capabilities/src/reasoners/strategic-planner/runtime/strategic-planner.runtime.mjs
 *
 * Purpose: deterministic runtime evaluator for Strategic Planner.
 *
 * This file is executed inside a Dagger Node container. It reads INPUT_JSON and prints JSON to stdout.
 * It is intentionally dependency-free (Node stdlib only) to keep runtime stable and deterministic.
 */
import fs from 'node:fs';
import path from 'node:path';

function clampInt(value, min, max) {
  const v = Math.round(value);
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function extractFrontmatter(content) {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') return { frontmatter: {}, body: content };
  const fm = {};
  let i = 1;
  for (; i < lines.length; i++) {
    if (lines[i] === '---') {
      i++;
      break;
    }
    const line = lines[i];
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const rawValue = line.slice(idx + 1).trim();
    const value = rawValue.replace(/^"(.*)"$/, '$1');
    if (key) fm[key] = value;
  }
  return { frontmatter: fm, body: lines.slice(i).join('\n') };
}

function extractFirstHeading(markdown) {
  const m = markdown.match(/^#\s+(.+)$/m);
  return m && m[1] ? m[1].trim() : undefined;
}

function escapeRegExp(input) {
  // NOTE: keep this free of `${`-shaped sequences; this file is not template-expanded.
  return input.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&');
}

function extractSectionText(markdown, heading) {
  const re = new RegExp(
    '^##\\s+' + escapeRegExp(heading) + '\\s*$([\\s\\S]*?)(^##\\s+|\\Z)',
    'm'
  );
  const m = markdown.match(re);
  if (!m) return '';
  return m[1]
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('- '))
    .join(' ')
    .trim();
}

function extractBulletSection(markdown, heading) {
  const re = new RegExp(
    '^##\\s+' + escapeRegExp(heading) + '\\s*$([\\s\\S]*?)(^##\\s+|\\Z)',
    'm'
  );
  const m = markdown.match(re);
  if (!m) return [];
  return m[1]
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.replace(/^- /, '').trim())
    .filter((l) => l.length > 0);
}

function extractPhases(markdown) {
  const lines = markdown.split(/\r?\n/);
  const phases = [];
  let current = null;
  for (const line of lines) {
    const trimmed = line.trim();
    const phaseHeading = trimmed.match(/^###\s+(.*)$/);
    if (phaseHeading) {
      if (current) phases.push(current);
      current = { title: phaseHeading[1].trim(), tasks: [] };
      continue;
    }
    if (current && trimmed.startsWith('- ')) {
      current.tasks.push(trimmed.replace(/^- /, '').trim());
    }
  }
  if (current) phases.push(current);
  return phases.map((p) => ({ title: p.title, tasks: p.tasks.length ? p.tasks : undefined }));
}

function looksLikeJson(value) {
  const t = value.trimStart();
  return t.startsWith('{') || t.startsWith('[');
}

export function runtimeParsePlan(source, repoRoot) {
  if (source.type === 'intent') {
    return {
      source: { type: 'intent' },
      format: 'intent',
      title: 'Intent Plan',
      intent: source.description,
      goals: source.goals,
      constraints: source.constraints || [],
      phases: [],
      raw: { content: JSON.stringify(source) },
    };
  }

  const filePath =
    source.type === 'file'
      ? path.isAbsolute(source.path)
        ? source.path
        : path.join(repoRoot, source.path)
      : null;

  const content = source.type === 'file' ? fs.readFileSync(filePath, 'utf8') : source.content;

  const trimmed = content.trimStart();
  if (looksLikeJson(trimmed)) {
    const obj = JSON.parse(trimmed);
    const title = typeof obj.title === 'string' ? obj.title : 'Untitled Plan';
    const intent = typeof obj.intent === 'string' ? obj.intent : '';
    const goals = Array.isArray(obj.goals) ? obj.goals.filter((x) => typeof x === 'string') : [];
    const constraints = Array.isArray(obj.constraints)
      ? obj.constraints.filter((x) => typeof x === 'string')
      : [];
    const phasesRaw = Array.isArray(obj.phases) ? obj.phases : [];
    const phases = phasesRaw
      .filter((p) => p && typeof p === 'object')
      .map((p) => ({
        id: typeof p.id === 'string' ? p.id : undefined,
        title: typeof p.title === 'string' ? p.title : undefined,
        tasks: Array.isArray(p.tasks) ? p.tasks.filter((x) => typeof x === 'string') : undefined,
      }));
    return {
      source: { type: source.type },
      format: 'json',
      title,
      owner: typeof obj.owner === 'string' ? obj.owner : undefined,
      domain: typeof obj.domain === 'string' ? obj.domain : undefined,
      status: typeof obj.status === 'string' ? obj.status : undefined,
      intent,
      goals,
      constraints,
      phases,
      raw: { content },
    };
  }

  const { frontmatter, body } = extractFrontmatter(content);
  const title = frontmatter.title || extractFirstHeading(body) || 'Untitled Plan';
  const owner = frontmatter.owner;
  const domain = frontmatter.domain;
  const status = frontmatter.status;
  const intent = extractSectionText(body, 'Intent');
  const goals = extractBulletSection(body, 'Goals');
  const constraints = extractBulletSection(body, 'Constraints');
  const phases = extractPhases(body);
  return {
    source: { type: source.type },
    format: 'markdown',
    title,
    owner,
    domain,
    status,
    intent,
    goals,
    constraints,
    phases,
    raw: { content },
  };
}

export function runtimeListSkillsInDir(dir, source) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => path.join(dir, e.name, 'SKILL.md'));
  const skills = [];
  for (const skillPath of dirs) {
    if (!fs.existsSync(skillPath)) continue;
    const raw = fs.readFileSync(skillPath, 'utf8');
    const lines = raw.split(/\r?\n/);
    let name = path.basename(path.dirname(skillPath));
    let description = '';
    if (lines[0] === '---') {
      for (let i = 1; i < lines.length; i++) {
        if (lines[i] === '---') break;
        const idx = lines[i].indexOf(':');
        if (idx === -1) continue;
        const key = lines[i].slice(0, idx).trim();
        const value = lines[i].slice(idx + 1).trim().replace(/^"(.*)"$/, '$1');
        if (key === 'name' && value) name = value;
        if (key === 'description' && value) description = value;
      }
    }
    skills.push({ name, description, skillPath, source });
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export function runtimeLoadGenerators(generatorsJsonPath) {
  const raw = fs.readFileSync(generatorsJsonPath, 'utf8');
  const parsed = JSON.parse(raw);
  const gens = parsed.generators || {};
  return Object.keys(gens)
    .map((name) => ({
      name,
      description: (gens[name] && gens[name].description) || '',
      schema: (gens[name] && gens[name].schema) || '',
      factory: (gens[name] && gens[name].factory) || '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function runtimeInventorySkills(repoRoot, projectSkillsPathOverride) {
  const projectSkillsDir = projectSkillsPathOverride || path.join(repoRoot, '.cursor', 'skills');
  const generatorsJsonPath = path.join(repoRoot, 'tools', 'path', 'generators.json');
  const skills = runtimeListSkillsInDir(projectSkillsDir, 'project');
  const generators = runtimeLoadGenerators(generatorsJsonPath);
  return { skills, generators };
}

export function runtimeEvaluatePersonas(plan, projectContext, skills) {
  const skillSet = new Set(skills.map((s) => s.name));
  const text = (plan.title + '\n' + plan.intent + '\n' + plan.raw.content).toLowerCase();
  const personas = [
    'Agent (AI Assistant)',
    'Developer (Platform Contributor)',
    'End User (Platform Operator)',
    'Platform Engineering Leadership',
    projectContext.domainExpert && projectContext.domainExpert.role
      ? `Domain Expert (${projectContext.domainExpert.role})`
      : 'Domain Expert (Project-Specific)',
  ];

  function score(gaps, missingSkills, personaLabel) {
    let s = 6;
    if (plan.goals.length >= 3) s += 1;
    if (plan.constraints.length >= 2) s += 1;
    if (plan.phases.length >= 2) s += 1;
    for (const g of gaps) {
      if (g.priority === 'P0') s -= 3;
      else if (g.priority === 'P1') s -= 2;
      else if (g.priority === 'P2') s -= 1;
    }
    s -= Math.min(2, missingSkills.length);
    if (personaLabel.startsWith('End User')) s -= 1;
    if (personaLabel.startsWith('Platform Engineering Leadership')) s -= 1;
    return clampInt(s, 1, 10);
  }

  return personas.map((personaLabel) => {
    const gaps = [];
    const missingSkills = [];

    if (!plan.goals || plan.goals.length === 0) {
      gaps.push({
        aspect: 'Goals',
        currentState: 'No explicit goals provided',
        gap: 'Evaluation and prioritization require explicit goals',
        mitigation: 'Add a Goals section with 3-7 bullet points',
        priority: 'P0',
      });
    }

    if (!plan.constraints || plan.constraints.length === 0) {
      gaps.push({
        aspect: 'Constraints',
        currentState: 'No explicit constraints provided',
        gap: 'Without constraints, execution may violate determinism/security expectations',
        mitigation: 'Add a Constraints section (determinism, security, tooling preferences)',
        priority: 'P1',
      });
    }

    if (text.includes('langgraph') && !skillSet.has('langgraph-reasoner-patterns')) {
      missingSkills.push({
        skillName: 'langgraph-reasoner-patterns',
        reason: 'Plan mentions LangGraph; documenting Reasoner node/state patterns prevents drift',
      });
    }

    if ((text.includes('otel') || text.includes('opentelemetry')) && !skillSet.has('golden-observability')) {
      missingSkills.push({
        skillName: 'golden-observability',
        reason: 'Plan mentions observability; GOS-001 guidance is needed for consistent spans/attributes',
      });
    }

    if (personaLabel.startsWith('Agent') && !text.includes('mcp')) {
      gaps.push({
        aspect: 'Tool Discovery',
        currentState: 'MCP integration not referenced',
        gap: 'Agents need deterministic tool naming/discoverability via MCP catalogs',
        mitigation: 'Ensure capability is registered and included in tool catalog regeneration',
        priority: 'P2',
      });
    }

    if (personaLabel.startsWith('Developer') && !text.includes('test')) {
      gaps.push({
        aspect: 'Fast Feedback',
        currentState: 'Tests are not mentioned',
        gap: 'TDD contract tests should be planned early to prevent drift',
        mitigation: 'Add a Testing section (unit + contract tests) and wire into CI',
        priority: 'P1',
      });
    }

    if (personaLabel.startsWith('End User') && !text.includes('runbook')) {
      gaps.push({
        aspect: 'Usability',
        currentState: 'Operator runbooks not referenced',
        gap: 'Operators need a clear workflow and troubleshooting guidance',
        mitigation: 'Add 2-5 runbooks and link them from the capability outputs/UI',
        priority: 'P2',
      });
    }

    if (personaLabel.startsWith('Platform Engineering Leadership') && !text.includes('metric')) {
      gaps.push({
        aspect: 'ROI',
        currentState: 'Success metrics not referenced',
        gap: 'Leadership needs measurable targets to justify adoption',
        mitigation: 'Define success metrics per persona and how they will be measured',
        priority: 'P2',
      });
    }

    if (personaLabel.startsWith('Domain Expert') && !projectContext.domainExpert) {
      gaps.push({
        aspect: 'Domain Context',
        currentState: 'No domain expert persona provided',
        gap: 'Evaluation quality improves with an explicit domain beneficiary and concerns',
        mitigation: 'Provide projectContext.domainExpert (role, concerns, successCriteria)',
        priority: 'P2',
      });
    }

    const alignmentScore = score(gaps, missingSkills, personaLabel);
    return { persona: personaLabel, alignmentScore, gaps, missingSkills };
  });
}

export function runtimeAnalyzeGaps(plan, skills, generators) {
  const text = (plan.title + '\n' + plan.intent + '\n' + plan.raw.content).toLowerCase();
  const skillSet = new Set(skills.map((s) => s.name));
  const genSet = new Set(generators.map((g) => g.name));
  const gaps = [];

  if (!text.includes('test')) {
    gaps.push({
      category: 'testing',
      item: 'TDD/contract tests not specified',
      description: 'Plan does not mention tests; add unit + contract tests to prevent drift.',
      priority: 'P1',
      blocksPhases: ['Phase 2', 'Phase 4.1'],
      effort: 'low',
    });
  }

  if (!text.includes('runbook') && !text.includes('docs')) {
    gaps.push({
      category: 'documentation',
      item: 'Operator-facing docs/runbooks missing',
      description: 'No runbooks/docs referenced; add minimal runbooks to reduce operator friction.',
      priority: 'P2',
      blocksPhases: ['Phase 2', 'Phase 4'],
      effort: 'low',
    });
  }

  if (!text.includes('mcp') && !text.includes('tool catalog')) {
    gaps.push({
      category: 'mcp-tools',
      item: 'MCP/tool catalog integration not referenced',
      description: 'Ensure discoverability via tool catalog generation and MCP registration steps.',
      priority: 'P2',
      blocksPhases: ['Phase 4.2'],
      effort: 'low',
    });
  }

  if (text.includes('langgraph') && !skillSet.has('langgraph-reasoner-patterns')) {
    gaps.push({
      category: 'skills',
      item: 'langgraph-reasoner-patterns',
      description: 'LangGraph Reasoner pattern skill is missing; add to prevent state/node drift.',
      priority: 'P1',
      blocksPhases: ['Phase 2', 'Phase 3'],
      effort: 'medium',
    });
  }

  if (!genSet.has('sync')) {
    gaps.push({
      category: 'generators',
      item: 'registry/tool catalog sync generator not available',
      description: 'Expected @golden/path sync generator not found; ensure generator is present/usable.',
      priority: 'P2',
      blocksPhases: ['Phase 4.2'],
      effort: 'low',
    });
  }

  if (text.includes('determinism') && !skillSet.has('determinism-guardrails')) {
    gaps.push({
      category: 'standards',
      item: 'determinism-guardrails',
      description: 'Plan references determinism but DGS-001 skill is not present in inventory.',
      priority: 'P2',
      blocksPhases: ['Phase 2', 'Phase 3'],
      effort: 'low',
    });
  }

  return gaps.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.priority !== b.priority) return a.priority.localeCompare(b.priority);
    return a.item.localeCompare(b.item);
  });
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function priorityRank(p) {
  if (p === 'P0') return 0;
  if (p === 'P1') return 1;
  if (p === 'P2') return 2;
  return 3;
}

function deliverableFor(g) {
  if (g.category === 'documentation') {
    return { path: 'runbooks/', format: 'markdown', sections: ['Summary', 'Steps', 'Rollback', 'Verification'] };
  }
  if (g.category === 'skills') {
    return { path: `.cursor/skills/${slug(g.item)}/SKILL.md`, format: 'markdown' };
  }
  if (g.category === 'testing') {
    return { path: 'packages/capabilities/src/reasoners/strategic-planner/', format: 'typescript' };
  }
  if (g.category === 'mcp-tools') {
    return { path: 'packages/tools/mcp-server/src/manifest/tool-catalog.json', format: 'json' };
  }
  return { path: 'docs/', format: 'markdown' };
}

function defaultBlocks(g) {
  if (g.category === 'testing') return ['Phase 2', 'Phase 4.1'];
  if (g.category === 'mcp-tools') return ['Phase 4.2'];
  if (g.category === 'skills') return ['Phase 2', 'Phase 3'];
  return ['Phase 2'];
}

export function runtimeIdentifyPreWork(gaps) {
  const items = gaps.map((g) => {
    const id = (`pw-${slug(g.category)}-${slug(g.item)}`).slice(0, 64);
    const title = `Pre-work: ${g.item}`;
    const category =
      g.category === 'skills'
        ? 'enabling-skill'
        : g.category === 'documentation'
          ? 'foundation-document'
          : g.category === 'adrs'
            ? 'architecture-record'
            : g.category === 'testing'
              ? 'sample-implementation'
              : 'reference-artifact';
    const deliverable = deliverableFor(g);
    const blocksPhases = g.blocksPhases && g.blocksPhases.length ? g.blocksPhases : defaultBlocks(g);
    return {
      id,
      title,
      category,
      priority: g.priority,
      description: g.description,
      deliverable,
      blocksPhases,
      effort: g.effort,
    };
  });

  return items.sort((a, b) => {
    const pa = priorityRank(a.priority);
    const pb = priorityRank(b.priority);
    if (pa !== pb) return pa - pb;
    return a.id.localeCompare(b.id);
  });
}

export function runtimeDefineMetrics(personas) {
  const metrics = [];
  for (const persona of personas) {
    if (persona.startsWith('Agent')) {
      metrics.push({
        persona,
        metric: 'MCP discoverability',
        target: '100%',
        measurementMethod: 'Tool catalog manifest audit (generated vs committed)',
        measurementPhase: 'Phase 4.2',
      });
    } else if (persona.startsWith('Developer')) {
      metrics.push({
        persona,
        metric: 'Test coverage',
        target: '>80%',
        measurementMethod: 'Vitest coverage report in CI',
        measurementPhase: 'Phase 4.1',
      });
    } else if (persona.startsWith('End User')) {
      metrics.push({
        persona,
        metric: 'Output completeness',
        target: 'All required sections present',
        measurementMethod: 'Schema validation + fixture-based integration test',
        measurementPhase: 'Phase 4.1',
      });
    } else if (persona.startsWith('Platform Engineering Leadership')) {
      metrics.push({
        persona,
        metric: 'OCS compliance',
        target: '100%',
        measurementMethod: 'TCS-001 contract test suite',
        measurementPhase: 'Phase 4.1',
      });
    } else {
      metrics.push({
        persona,
        metric: 'Domain acceptance',
        target: 'Meets domain success criteria',
        measurementMethod: 'Dogfood run + domain review checklist',
        measurementPhase: 'Phase 4.3',
      });
    }
  }

  return metrics.sort((a, b) => {
    if (a.persona !== b.persona) return a.persona.localeCompare(b.persona);
    return a.metric.localeCompare(b.metric);
  });
}

export function runtimeSkillsMatrix() {
  return {
    prioritySkills: [
      { skill: 'test-driven-development', reason: 'TDD cycle for correctness and drift prevention', readBefore: 'Phase 1' },
      { skill: 'open-capability-standard', reason: 'OCS compliance for schemas/security/aiHints', readBefore: 'Phase 1' },
      { skill: 'agent-specification-standard', reason: 'ASS-001 Reasoner patterns and safety guardrails', readBefore: 'Phase 1' },
      { skill: 'pattern-catalog-capabilities', reason: 'Reasoner baseline expectations (CPC-001)', readBefore: 'Phase 1' },
      { skill: 'testing-certification-standard', reason: 'TCS-001 contract verification requirements', readBefore: 'Phase 4.1' },
    ],
    referenceSkills: [
      { skill: 'strategic-planning-protocol', phases: ['Phase 2', 'Phase 3'] },
      { skill: 'langgraph-reasoner-patterns', phases: ['Phase 2', 'Phase 3'] },
      { skill: 'prompt-engineering', phases: ['Phase 3.1'] },
      { skill: 'golden-observability', phases: ['Backlog'] },
    ],
    missingSkills: [],
  };
}

export function runtimeSummarize(projectName, personaEvaluations, gaps, preWork) {
  const avg =
    personaEvaluations.length > 0
      ? Math.round(
          (personaEvaluations.reduce((a, p) => a + p.alignmentScore, 0) / personaEvaluations.length) * 10
        ) / 10
      : 0;
  const critical = gaps.filter((g) => g.priority === 'P0' || g.priority === 'P1').length;
  const overallReadiness = critical > 0 || preWork.length > 0 ? 'needs-prework' : 'ready';
  return {
    projectName,
    overallReadiness,
    averageAlignmentScore: typeof avg === 'number' ? avg : 0,
    totalGaps: gaps.length,
    criticalGaps: critical,
    preWorkItems: preWork.length,
  };
}

export function runtimeIsEnabled(options, key) {
  const evaluations = options && options.evaluations ? options.evaluations : undefined;
  const v = evaluations ? evaluations[key] : undefined;
  return typeof v === 'boolean' ? v : true;
}

export function runtimeEvaluate(input, repoRoot) {
  const plan = runtimeParsePlan(input.plan, repoRoot);
  const inv = runtimeInventorySkills(repoRoot, input.options && input.options.skillsPath ? input.options.skillsPath : undefined);

  const personas = runtimeIsEnabled(input.options, 'personas')
    ? runtimeEvaluatePersonas(plan, input.projectContext, inv.skills)
    : [];
  const gaps = runtimeIsEnabled(input.options, 'gapAnalysis') ? runtimeAnalyzeGaps(plan, inv.skills, inv.generators) : [];
  const preWork = runtimeIsEnabled(input.options, 'preWorkIdentification') ? runtimeIdentifyPreWork(gaps) : [];

  const personaLabels =
    personas.length > 0
      ? personas.map((p) => p.persona)
      : [
          'Agent (AI Assistant)',
          'Developer (Platform Contributor)',
          'End User (Platform Operator)',
          'Platform Engineering Leadership',
          input.projectContext && input.projectContext.domainExpert && input.projectContext.domainExpert.role
            ? `Domain Expert (${input.projectContext.domainExpert.role})`
            : 'Domain Expert (Project-Specific)',
        ];

  const successMetrics = runtimeIsEnabled(input.options, 'metricsDefinition') ? runtimeDefineMetrics(personaLabels) : [];

  return {
    summary: runtimeSummarize(
      input.projectContext && input.projectContext.name ? input.projectContext.name : 'unknown',
      personas,
      gaps,
      preWork
    ),
    personaEvaluations: personas,
    gaps,
    skillsMatrix: runtimeSkillsMatrix(),
    preWork,
    successMetrics,
  };
}

export function main() {
  const repoRoot = process.env.REPO_ROOT || process.cwd();
  const raw = process.env.INPUT_JSON || '{}';
  const input = JSON.parse(raw);
  const out = runtimeEvaluate(input, repoRoot);
  process.stdout.write(JSON.stringify(out));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

