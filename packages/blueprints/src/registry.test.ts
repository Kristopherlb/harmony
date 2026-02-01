/**
 * packages/blueprints/src/registry.test.ts
 * TDD: blueprint registry discovers workflow metadata deterministically.
 */
import { describe, it, expect } from 'vitest';
import { createBlueprintRegistry, getBlueprint } from './registry.js';

describe('Blueprint registry', () => {
  it('resolves workflows.echo and exposes workflowType', () => {
    const reg = createBlueprintRegistry();
    const bp = getBlueprint(reg, 'workflows.echo');
    expect(bp.blueprintId).toBe('workflows.echo');
    expect(bp.workflowType).toBe('echoWorkflow');
    expect(bp.descriptor.metadata.id).toBe('workflows.echo');
  });

  it('resolves workflows.math_pipeline and exposes workflowType', () => {
    const reg = createBlueprintRegistry();
    const bp = getBlueprint(reg, 'workflows.math_pipeline');
    expect(bp.blueprintId).toBe('workflows.math_pipeline');
    expect(bp.workflowType).toBe('mathPipelineWorkflow');
    expect(bp.descriptor.metadata.id).toBe('workflows.math_pipeline');
  });

  it('throws on unknown blueprintId', () => {
    const reg = createBlueprintRegistry();
    expect(() => getBlueprint(reg, 'nope')).toThrow('Blueprint not found');
  });
});

