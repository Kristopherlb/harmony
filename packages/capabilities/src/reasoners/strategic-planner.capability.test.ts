/**
 * packages/capabilities/src/reasoners/strategic-planner.capability.test.ts
 *
 * Purpose: TCS-001 contract tests for the Strategic Planner capability.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { strategicPlannerCapability } from './strategic-planner.capability.js';
import { evaluateStrategicPlanner } from './strategic-planner/evaluate.js';

function repoRoot(): string {
  // reasoners/ -> src/ -> capabilities/ -> packages/ -> repo root
  return fileURLToPath(new URL('../../..', import.meta.url));
}

function fixturePath(relativePath: string): string {
  return fileURLToPath(new URL(`./strategic-planner/__fixtures__/${relativePath}`, import.meta.url));
}

function promptPath(relativePath: string): string {
  return fileURLToPath(new URL(`./strategic-planner/prompts/${relativePath}`, import.meta.url));
}

describe('strategic-planner capability (TCS-001)', () => {
  describe('OCS contract', () => {
    it('has valid metadata', () => {
      expect(strategicPlannerCapability.metadata.id).toBe('golden.reasoners.strategic-planner');
      expect(typeof strategicPlannerCapability.metadata.version).toBe('string');
      expect(strategicPlannerCapability.metadata.version.length).toBeGreaterThan(0);
      expect(strategicPlannerCapability.metadata.tags.length).toBeGreaterThan(0);
      expect(strategicPlannerCapability.security.dataClassification).toBe('INTERNAL');
      expect(Array.isArray(strategicPlannerCapability.security.networkAccess.allowOutbound)).toBe(true);
    });

    it('has complete schemas and validates aiHints examples', () => {
      const parsedExampleInput = strategicPlannerCapability.schemas.input.parse(strategicPlannerCapability.aiHints.exampleInput);
      const parsedExampleOutput = strategicPlannerCapability.schemas.output.parse(strategicPlannerCapability.aiHints.exampleOutput);
      expect(parsedExampleInput.plan.type).toBeDefined();
      expect(parsedExampleOutput.summary.projectName).toBeDefined();
    });

    it('declares expected security scopes', () => {
      expect(strategicPlannerCapability.security.requiredScopes).toContain('planning:evaluate');
    });
  });

  describe('prompt templates (PES-001)', () => {
    it('persona-evaluation prompt includes required PES-001 tags', async () => {
      const content = await readFile(promptPath('persona-evaluation.md'), 'utf8');
      expect(content).toContain('<system_role>');
      expect(content).toContain('<engineering_principles>');
      expect(content).toContain('<instructions>');
      expect(content).toContain('<reference_example>');
      expect(content).toContain('<hitl_protocol>');
    });

    it('gap-analysis prompt includes required PES-001 tags', async () => {
      const content = await readFile(promptPath('gap-analysis.md'), 'utf8');
      expect(content).toContain('<system_role>');
      expect(content).toContain('<engineering_principles>');
      expect(content).toContain('<instructions>');
      expect(content).toContain('<reference_example>');
      expect(content).toContain('<hitl_protocol>');
    });

    it('prework-identification prompt includes required PES-001 tags', async () => {
      const content = await readFile(promptPath('prework-identification.md'), 'utf8');
      expect(content).toContain('<system_role>');
      expect(content).toContain('<engineering_principles>');
      expect(content).toContain('<instructions>');
      expect(content).toContain('<reference_example>');
      expect(content).toContain('<hitl_protocol>');
    });
  });

  describe('integration (in-process evaluator)', () => {
    it('evaluates a real plan file fixture and produces schema-valid output', async () => {
      const output = await evaluateStrategicPlanner(
        {
          plan: { type: 'file', path: fixturePath('sample-file.plan.md') },
          projectContext: { name: 'harmony', domain: 'incident-management' },
          options: {
            depth: 'quick',
            outputFormat: 'json',
            createCheckpoint: false,
            evaluations: {
              personas: true,
              gapAnalysis: true,
              preWorkIdentification: true,
              metricsDefinition: true,
            },
          },
        },
        { repoRoot: repoRoot(), globalSkillsDir: `${repoRoot()}/__does_not_exist__` }
      );

      const parsed = strategicPlannerCapability.schemas.output.parse(output);
      expect(parsed.personaEvaluations.length).toBe(5);
      expect(parsed.gaps.length).toBeGreaterThan(0);
      expect(parsed.preWork.length).toBeGreaterThan(0);
      expect(parsed.successMetrics.length).toBeGreaterThan(0);
    });
  });

  describe('factory wiring (Dagger container definition)', () => {
    it('constructs a container that mounts repo and executes node script', () => {
      const withExec = vi.fn().mockReturnThis();

      const container = {
        from: vi.fn().mockReturnThis(),
        withDirectory: vi.fn().mockReturnThis(),
        withWorkdir: vi.fn().mockReturnThis(),
        withEnvVariable: vi.fn().mockReturnThis(),
        withExec,
      };

      const hostDir = { __host_dir__: true };
      const host = { directory: vi.fn().mockReturnValue(hostDir) };

      const dag = {
        container: vi.fn().mockReturnValue(container),
        host: vi.fn().mockReturnValue(host),
      };

      const context = { config: {}, secretRefs: {}, ctx: {} } as unknown as any;

      strategicPlannerCapability.factory(dag as unknown, context, strategicPlannerCapability.aiHints.exampleInput);

      expect(container.from).toHaveBeenCalledWith('node:20-alpine');
      expect(host.directory).toHaveBeenCalledWith('.');
      expect(container.withDirectory).toHaveBeenCalledWith('/repo', hostDir);
      expect(container.withWorkdir).toHaveBeenCalledWith('/repo');
      expect(container.withEnvVariable).toHaveBeenCalledWith('INPUT_JSON', expect.any(String));

      expect(withExec).toHaveBeenCalledTimes(1);
      const execArgs = withExec.mock.calls[0][0] as string[];
      expect(execArgs[0]).toBe('node');
      expect(execArgs[1]).toBe(
        'packages/capabilities/src/reasoners/strategic-planner/runtime/strategic-planner.runtime.mjs'
      );
    });
  });
});

