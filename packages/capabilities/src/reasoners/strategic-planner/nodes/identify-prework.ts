/**
 * packages/capabilities/src/reasoners/strategic-planner/nodes/identify-prework.ts
 *
 * Purpose: map gaps into structured pre-work items with deterministic ordering.
 */
import type { Gap } from './analyze-gaps';

export type PreWorkCategory =
  | 'foundation-document'
  | 'reference-artifact'
  | 'enabling-skill'
  | 'architecture-record'
  | 'sample-implementation';

export type PreWorkItem = {
  id: string;
  title: string;
  category: PreWorkCategory;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  description: string;
  deliverable: { path: string; format: string; sections?: string[] };
  blocksPhases: string[];
  effort: 'low' | 'medium' | 'high';
};

export type IdentifyPreWorkInput = {
  gaps: Gap[];
};

export async function identifyPreWork(input: IdentifyPreWorkInput): Promise<PreWorkItem[]> {
  const items = input.gaps.map((g) => gapToPreWork(g));
  return items.sort((a, b) => {
    const pa = priorityRank(a.priority);
    const pb = priorityRank(b.priority);
    if (pa !== pb) return pa - pb;
    return a.id.localeCompare(b.id);
  });
}

function gapToPreWork(g: Gap): PreWorkItem {
  const id = `pw-${slug(g.category)}-${slug(g.item)}`.slice(0, 64);
  const title = `Pre-work: ${g.item}`;

  const category: PreWorkCategory =
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
  const blocksPhases = g.blocksPhases?.length ? g.blocksPhases : defaultBlocks(g);

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
}

function deliverableFor(g: Gap): { path: string; format: string; sections?: string[] } {
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

function defaultBlocks(g: Gap): string[] {
  switch (g.category) {
    case 'testing':
      return ['Phase 2', 'Phase 4.1'];
    case 'mcp-tools':
      return ['Phase 4.2'];
    case 'skills':
      return ['Phase 2', 'Phase 3'];
    default:
      return ['Phase 2'];
  }
}

function priorityRank(p: PreWorkItem['priority']): number {
  switch (p) {
    case 'P0':
      return 0;
    case 'P1':
      return 1;
    case 'P2':
      return 2;
    case 'P3':
      return 3;
  }
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

