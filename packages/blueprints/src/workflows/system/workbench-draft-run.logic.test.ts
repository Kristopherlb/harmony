/**
 * packages/blueprints/src/workflows/system/workbench-draft-run.logic.test.ts
 */
import { describe, it, expect } from 'vitest';
import { deriveDraftExecutionOrder, isPrimitiveNodeType } from './workbench-draft-run.logic.js';

describe('workbench draft run logic', () => {
  it('topologically sorts nodes based on edges (deterministic)', () => {
    const draft = {
      title: 't',
      summary: 's',
      nodes: [
        { id: 'n-start', label: 'Start', type: 'start' },
        { id: 'n-a', label: 'A', type: 'golden.echo', properties: { x: 1 } },
        { id: 'n-b', label: 'B', type: 'golden.math_add', properties: { a: 1, b: 2 } },
      ],
      edges: [
        { source: 'n-start', target: 'n-a' },
        { source: 'n-a', target: 'n-b' },
      ],
    };

    const ordered = deriveDraftExecutionOrder(draft as any);
    expect(ordered.map((n) => n.id)).toEqual(['n-start', 'n-a', 'n-b']);
  });

  it('keeps stable ordering for independent nodes (uses draft order as tie-breaker)', () => {
    const draft = {
      title: 't',
      summary: 's',
      nodes: [
        { id: 'n-1', label: '1', type: 'golden.echo' },
        { id: 'n-2', label: '2', type: 'golden.echo' },
        { id: 'n-3', label: '3', type: 'golden.echo' },
      ],
      edges: [],
    };

    const ordered = deriveDraftExecutionOrder(draft as any);
    expect(ordered.map((n) => n.id)).toEqual(['n-1', 'n-2', 'n-3']);
  });

  it('classifies known primitive node types', () => {
    expect(isPrimitiveNodeType('start')).toBe(true);
    expect(isPrimitiveNodeType('sleep')).toBe(true);
    expect(isPrimitiveNodeType('log')).toBe(true);
    expect(isPrimitiveNodeType('condition')).toBe(true);
    expect(isPrimitiveNodeType('golden.echo')).toBe(false);
  });
});

