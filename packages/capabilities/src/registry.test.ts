/**
 * packages/capabilities/src/registry.test.ts
 * TDD: registry resolves real capability.
 */
import { describe, it, expect } from 'vitest';
import { createCapabilityRegistry, getCapability } from './registry.js';

describe('Capability registry', () => {
  it('resolves golden.echo', () => {
    const reg = createCapabilityRegistry();
    const cap = getCapability(reg, 'golden.echo');
    expect(cap.metadata.id).toBe('golden.echo');
  });

  it('resolves golden.math_add', () => {
    const reg = createCapabilityRegistry();
    const cap = getCapability(reg, 'golden.math_add');
    expect(cap.metadata.id).toBe('golden.math_add');
  });

  it('resolves golden.demo.secret-present', () => {
    const reg = createCapabilityRegistry();
    const cap = getCapability(reg, 'golden.demo.secret-present');
    expect(cap.metadata.id).toBe('golden.demo.secret-present');
  });

  it('throws on unknown capId', () => {
    const reg = createCapabilityRegistry();
    expect(() => getCapability(reg, 'nope')).toThrow('Capability not found');
  });
});

