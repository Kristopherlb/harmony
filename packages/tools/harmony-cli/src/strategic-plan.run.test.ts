/**
 * packages/tools/harmony-cli/src/strategic-plan.run.test.ts
 *
 * Purpose: TDD coverage for strategic-plan execution wiring (formatting + file output).
 */
import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// NOTE: This will fail until implemented (TDD: RED first).
import { runStrategicPlan } from './strategic-plan.run.js';

describe('runStrategicPlan', () => {
  it('writes JSON output file when --output is provided', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'harmony-cli-'));
    const outPath = path.join(tmp, 'evaluation.json');

    const result = await runStrategicPlan({
      args: {
        subcommand: 'strategic-plan',
        planPath: './sample.plan.md',
        projectName: 'harmony',
        domain: 'incident-management',
        depth: 'quick',
        format: 'json',
        outputPath: outPath,
        help: false,
      },
      execRuntime: async () => ({
        summary: {
          projectName: 'harmony',
          overallReadiness: 'ready',
          averageAlignmentScore: 8,
          totalGaps: 0,
          criticalGaps: 0,
          preWorkItems: 0,
        },
        personaEvaluations: [],
        gaps: [],
        skillsMatrix: { prioritySkills: [], referenceSkills: [], missingSkills: [] },
        preWork: [],
        successMetrics: [],
        updatedTodos: [],
        checkpoint: { path: '', created: false },
      }),
    });

    expect(result.exitCode).toBe(0);
    const written = await readFile(outPath, 'utf8');
    expect(JSON.parse(written)).toMatchObject({ summary: { projectName: 'harmony' } });
    expect(result.stdout.trimStart().startsWith('{')).toBe(true);
  });

  it('renders markdown to stdout for --format=markdown', async () => {
    const result = await runStrategicPlan({
      args: {
        subcommand: 'strategic-plan',
        content: '# Plan\n\n## Intent\nDo it\n',
        projectName: 'harmony',
        domain: 'incident-management',
        depth: 'quick',
        format: 'markdown',
        help: false,
      },
      execRuntime: async () => ({
        summary: {
          projectName: 'harmony',
          overallReadiness: 'needs-prework',
          averageAlignmentScore: 6,
          totalGaps: 1,
          criticalGaps: 1,
          preWorkItems: 1,
        },
        personaEvaluations: [],
        gaps: [],
        skillsMatrix: { prioritySkills: [], referenceSkills: [], missingSkills: [] },
        preWork: [],
        successMetrics: [],
        updatedTodos: [],
        checkpoint: { path: '', created: false },
      }),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('# Strategic Planner Evaluation');
    expect(result.stdout).toContain('## Summary');
  });
});

