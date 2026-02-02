/**
 * packages/capabilities/src/reasoners/strategic-planner/nodes/identify-prework.test.ts
 *
 * Purpose: TDD for mapping gaps into ordered pre-work items.
 */
import { describe, expect, it } from 'vitest';

import { identifyPreWork } from './identify-prework.js';

describe('identifyPreWork', () => {
  it('orders pre-work by priority (P0 before P1 before P2 before P3)', async () => {
    const prework = await identifyPreWork({
      gaps: [
        {
          category: 'testing',
          item: 'missing tests',
          description: 'no tests',
          priority: 'P2',
          effort: 'low',
        },
        {
          category: 'skills',
          item: 'langgraph-reasoner-patterns',
          description: 'missing skill',
          priority: 'P1',
          effort: 'medium',
        },
        {
          category: 'standards',
          item: 'critical blocker',
          description: 'blocker',
          priority: 'P0',
          effort: 'high',
        },
      ],
    });

    expect(prework.length).toBe(3);
    expect(prework[0].priority).toBe('P0');
    expect(prework[1].priority).toBe('P1');
    expect(prework[2].priority).toBe('P2');
  });

  it('includes deliverable paths and blocksPhases for each pre-work item', async () => {
    const prework = await identifyPreWork({
      gaps: [
        {
          category: 'documentation',
          item: 'Operator runbooks',
          description: 'missing docs',
          priority: 'P2',
          effort: 'low',
          blocksPhases: ['Phase 4'],
        },
      ],
    });

    expect(prework[0].deliverable.path.length).toBeGreaterThan(0);
    expect(prework[0].blocksPhases.length).toBeGreaterThan(0);
  });
});

