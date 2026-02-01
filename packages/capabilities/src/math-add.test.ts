/**
 * packages/capabilities/src/math-add.test.ts
 * TDD: demo capability schemas behave correctly.
 */
import { describe, it, expect } from 'vitest';
import { mathAddCapability } from './demo/math-add.capability.js';

describe('mathAddCapability', () => {
  it('validates input/output schemas', () => {
    const input = mathAddCapability.schemas.input.parse({ a: 2, b: 3 });
    expect(input).toEqual({ a: 2, b: 3 });

    const output = mathAddCapability.schemas.output.parse({ sum: 5 });
    expect(output).toEqual({ sum: 5 });
  });
});

