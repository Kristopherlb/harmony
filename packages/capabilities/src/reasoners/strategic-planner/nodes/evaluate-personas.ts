/**
 * packages/capabilities/src/reasoners/strategic-planner/nodes/evaluate-personas.ts
 *
 * Purpose: produce a deterministic, shape-accurate 5-persona evaluation scaffold.
 *
 * Note: This node is intentionally heuristic-only (no LLM). In Phase 3, prompts/LLM can
 * augment these evaluations, but the output shape should remain stable.
 */
import type { ParsedPlan } from './parse-plan';
import type { SkillInfo } from './inventory-skills';

export type PersonaGap = {
  aspect: string;
  currentState: string;
  gap: string;
  mitigation: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
};

export type PersonaMissingSkill = {
  skillName: string;
  reason: string;
};

export type PersonaEvaluation = {
  persona: string;
  alignmentScore: number;
  gaps: PersonaGap[];
  missingSkills: PersonaMissingSkill[];
};

export type EvaluatePersonasInput = {
  plan: ParsedPlan;
  projectContext: {
    name: string;
    domain: string;
    domainExpert?: { role: string; concerns: string[]; successCriteria?: string[] };
  };
  skills: SkillInfo[];
};

export async function evaluatePersonas(input: EvaluatePersonasInput): Promise<PersonaEvaluation[]> {
  const personas: Array<{ key: string; label: string }> = [
    { key: 'agent', label: 'Agent (AI Assistant)' },
    { key: 'developer', label: 'Developer (Platform Contributor)' },
    { key: 'end-user', label: 'End User (Platform Operator)' },
    { key: 'leadership', label: 'Platform Engineering Leadership' },
    {
      key: 'domain-expert',
      label: input.projectContext.domainExpert
        ? `Domain Expert (${input.projectContext.domainExpert.role})`
        : 'Domain Expert (Project-Specific)',
    },
  ];

  return personas.map((p) => evaluateOne(p.label, input));
}

function evaluateOne(personaLabel: string, input: EvaluatePersonasInput): PersonaEvaluation {
  const skillSet = new Set(input.skills.map((s) => s.name));
  const text = `${input.plan.title}\n${input.plan.intent}\n${input.plan.raw.content}`.toLowerCase();

  const gaps: PersonaGap[] = [];
  const missingSkills: PersonaMissingSkill[] = [];

  // Basic completeness checks.
  if (input.plan.goals.length === 0) {
    gaps.push({
      aspect: 'Goals',
      currentState: 'No explicit goals provided',
      gap: 'Evaluation and prioritization require explicit goals',
      mitigation: 'Add a Goals section with 3-7 bullet points',
      priority: 'P0',
    });
  }

  if (input.plan.constraints.length === 0) {
    gaps.push({
      aspect: 'Constraints',
      currentState: 'No explicit constraints provided',
      gap: 'Without constraints, execution may violate determinism/security expectations',
      mitigation: 'Add a Constraints section (determinism, security, tooling preferences)',
      priority: 'P1',
    });
  }

  // Skill-based heuristics.
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

  // Persona-specific gaps (minimal + deterministic).
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

  if (personaLabel.startsWith('Domain Expert') && input.projectContext.domainExpert == null) {
    gaps.push({
      aspect: 'Domain Context',
      currentState: 'No domain expert persona provided',
      gap: 'Evaluation quality improves with an explicit domain beneficiary and concerns',
      mitigation: 'Provide projectContext.domainExpert (role, concerns, successCriteria)',
      priority: 'P2',
    });
  }

  const alignmentScore = score(input.plan, gaps, missingSkills, personaLabel);

  return { persona: personaLabel, alignmentScore, gaps, missingSkills };
}

function score(
  plan: ParsedPlan,
  gaps: PersonaGap[],
  missingSkills: PersonaMissingSkill[],
  personaLabel: string
): number {
  let s = 6;
  if (plan.goals.length >= 3) s += 1;
  if (plan.constraints.length >= 2) s += 1;
  if (plan.phases.length >= 2) s += 1;

  // Penalties: prioritize P0/P1.
  for (const g of gaps) {
    if (g.priority === 'P0') s -= 3;
    else if (g.priority === 'P1') s -= 2;
    else if (g.priority === 'P2') s -= 1;
  }
  s -= Math.min(2, missingSkills.length);

  // Slight calibration: end-user and leadership tend to score lower without docs/metrics.
  if (personaLabel.startsWith('End User')) s -= 1;
  if (personaLabel.startsWith('Platform Engineering Leadership')) s -= 1;

  return clampInt(s, 1, 10);
}

function clampInt(value: number, min: number, max: number): number {
  const v = Math.round(value);
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

