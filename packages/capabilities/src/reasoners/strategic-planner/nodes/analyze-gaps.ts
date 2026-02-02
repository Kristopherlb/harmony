/**
 * packages/capabilities/src/reasoners/strategic-planner/nodes/analyze-gaps.ts
 *
 * Purpose: produce a deterministic, 8-category gap list from plan + inventory signals.
 *
 * Note: heuristic-only; later phases can refine with LLM prompts while keeping shape stable.
 */
import type { ParsedPlan } from './parse-plan';
import type { SkillInfo, GeneratorInfo } from './inventory-skills';

export type GapCategory =
  | 'standards'
  | 'skills'
  | 'generators'
  | 'adrs'
  | 'documentation'
  | 'mcp-tools'
  | 'testing'
  | 'configuration';

export type GapPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type GapEffort = 'low' | 'medium' | 'high';

export type Gap = {
  category: GapCategory;
  item: string;
  description: string;
  priority: GapPriority;
  blocksPhases?: string[];
  effort: GapEffort;
};

export type AnalyzeGapsInput = {
  plan: ParsedPlan;
  skills: SkillInfo[];
  generators: GeneratorInfo[];
};

export async function analyzeGaps(input: AnalyzeGapsInput): Promise<Gap[]> {
  const text = `${input.plan.title}\n${input.plan.intent}\n${input.plan.raw.content}`.toLowerCase();
  const skills = new Set(input.skills.map((s) => s.name));
  const generators = new Set(input.generators.map((g) => g.name));

  const gaps: Gap[] = [];

  // Testing
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

  // Documentation
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

  // MCP/tools discoverability
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

  // Skills
  if (text.includes('langgraph') && !skills.has('langgraph-reasoner-patterns')) {
    gaps.push({
      category: 'skills',
      item: 'langgraph-reasoner-patterns',
      description: 'LangGraph Reasoner pattern skill is missing; add to prevent state/node drift.',
      priority: 'P1',
      blocksPhases: ['Phase 2', 'Phase 3'],
      effort: 'medium',
    });
  }

  // Generators
  if (!generators.has('sync')) {
    gaps.push({
      category: 'generators',
      item: 'registry/tool catalog sync generator not available',
      description: 'Expected @golden/path sync generator not found; ensure generator is present/usable.',
      priority: 'P2',
      blocksPhases: ['Phase 4.2'],
      effort: 'low',
    });
  }

  // Standards / ADRs / configuration are intentionally light until later phases.
  if (text.includes('determinism') && !skills.has('determinism-guardrails')) {
    gaps.push({
      category: 'standards',
      item: 'determinism-guardrails',
      description: 'Plan references determinism but DGS-001 skill is not present in inventory.',
      priority: 'P2',
      blocksPhases: ['Phase 2', 'Phase 3'],
      effort: 'low',
    });
  }

  // Stable ordering for determinism.
  return gaps.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.priority !== b.priority) return a.priority.localeCompare(b.priority);
    return a.item.localeCompare(b.item);
  });
}

