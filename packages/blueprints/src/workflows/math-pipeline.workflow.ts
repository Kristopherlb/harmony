/**
 * packages/blueprints/src/workflows/math-pipeline.workflow.ts
 * Demo blueprint: compose multiple capabilities in a deterministic pipeline.
 *
 * Pipeline:
 * - golden.math_add({a,b}) -> {sum}
 * - golden.math_add({a:sum,b:c}) -> {sum}  (aka add c)
 * - golden.echo({x:sum}) -> {y}
 */
import { BaseBlueprint } from '@golden/core/workflow';
import { z } from '@golden/schema-registry';
import { formatAsMarkdownTable } from './utils/markdown-table.js';

export interface MathPipelineInput {
  a: number;
  b: number;
  c: number;
}

export interface MathPipelineOutput {
  y: number;
  table_markdown: string;
}

export class MathPipelineWorkflow extends BaseBlueprint<MathPipelineInput, MathPipelineOutput, object> {
  readonly metadata = {
    id: 'workflows.math_pipeline',
    version: '1.0.0',
    name: 'Math Pipeline Workflow',
    description: 'Composes math_add + echo to test capability composition.',
    owner: 'platform',
    costCenter: 'CC-0',
    tags: ['demo', 'math'],
  };

  readonly security = { requiredRoles: [], classification: 'INTERNAL' as const };

  readonly operations = {
    sla: { targetDuration: '1m', maxDuration: '5m' },
  };

  readonly inputSchema = z.object({ a: z.number(), b: z.number(), c: z.number() }) as BaseBlueprint<
    MathPipelineInput,
    MathPipelineOutput,
    object
  >['inputSchema'];

  readonly configSchema = z.object({}) as BaseBlueprint<MathPipelineInput, MathPipelineOutput, object>['configSchema'];

  protected async logic(input: MathPipelineInput, _config: object): Promise<MathPipelineOutput> {
    void _config;

    const first = (await this.executeById('golden.math_add', { a: input.a, b: input.b })) as { sum: number };
    const second = (await this.executeById('golden.math_add', { a: first.sum, b: input.c })) as { sum: number };
    const echoed = (await this.executeById('golden.echo', { x: second.sum })) as { y: number };
    const out = { y: echoed.y };
    return { ...out, table_markdown: formatAsMarkdownTable(out) };
  }
}

