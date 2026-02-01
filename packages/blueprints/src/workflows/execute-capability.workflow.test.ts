/**
 * packages/blueprints/src/workflows/execute-capability.workflow.test.ts
 * TDD: generic workflow metadata/schemas for capability tool execution.
 */
import { describe, it, expect } from 'vitest';
import { ExecuteCapabilityWorkflow } from './system/execute-capability.workflow.js';

describe('ExecuteCapabilityWorkflow', () => {
  it('exposes deterministic metadata and validates input', () => {
    const w = new ExecuteCapabilityWorkflow();
    expect(w.metadata.id).toBe('workflows.execute_capability');
    expect(() => w.inputSchema.parse({ capId: 'golden.echo', args: { x: 1 } })).not.toThrow();
    const parsed = w.inputSchema.parse({
      capId: 'golden.echo',
      args: { x: 1 },
      config: { a: 1 },
      secretRefs: { b: 2 },
    }) as { config?: unknown; secretRefs?: unknown };
    expect(parsed.config).toEqual({ a: 1 });
    expect(parsed.secretRefs).toEqual({ b: 2 });
  });
});

