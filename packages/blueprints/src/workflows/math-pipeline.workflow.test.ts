/**
 * packages/blueprints/src/workflows/math-pipeline.workflow.test.ts
 * TDD: blueprint composition via BaseBlueprint.executeById().
 */
import { describe, it, expect } from 'vitest';
import { MathPipelineWorkflow } from './math-pipeline.workflow.js';

describe('MathPipelineWorkflow', () => {
  it('validates input schema', () => {
    const w = new MathPipelineWorkflow();
    expect(() => w.inputSchema.parse({})).toThrow();
    expect(w.inputSchema.parse({ a: 2, b: 3, c: 4 })).toEqual({ a: 2, b: 3, c: 4 });
  });

  it('computes y = a + b + c using composed capabilities', async () => {
    const w = new MathPipelineWorkflow();
    const calls: Array<{ id: string; input: unknown }> = [];
    (w as unknown as { executeById: (id: string, input: unknown) => Promise<unknown> }).executeById = async (
      id,
      input
    ) => {
      calls.push({ id, input });
      if (id === 'golden.math_add') {
        const x = input as { a: number; b: number };
        return { sum: x.a + x.b };
      }
      if (id === 'golden.echo') {
        const x = input as { x: number };
        return { y: x.x };
      }
      throw new Error(`unexpected capability ${id}`);
    };

    const res = await w.main({ a: 2, b: 3, c: 4 }, {});
    expect(res.y).toBe(9);
    expect(res.table_markdown).toContain('| key | value |');
    expect(res.table_markdown).toContain('| y | 9 |');
    expect(calls.map((c) => c.id)).toEqual(['golden.math_add', 'golden.math_add', 'golden.echo']);
  });
});

