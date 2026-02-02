/**
 * packages/tools/harmony-cli/src/strategic-plan.run.ts
 *
 * Purpose: execute `harmony strategic-plan` using the deterministic runtime evaluator.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import type { StrategicPlanCliArgs } from './strategic-plan.args.js';
import { renderStrategicPlannerMarkdown } from './strategic-plan.render.js';

type ExecRuntime = (input: unknown) => Promise<unknown>;

export type RunStrategicPlanResult = {
  exitCode: 0 | 1;
  stdout: string;
  stderr: string;
};

export async function runStrategicPlan(input: {
  args: StrategicPlanCliArgs;
  execRuntime: ExecRuntime;
}): Promise<RunStrategicPlanResult> {
  const { args } = input;

  const plan =
    args.planPath != null
      ? { type: 'file' as const, path: args.planPath }
      : args.content != null
        ? { type: 'content' as const, content: args.content }
        : {
            type: 'intent' as const,
            description: args.intent ?? '',
            goals: args.goals ?? [],
            constraints: args.constraints ?? [],
          };

  const capabilityInput = {
    plan,
    projectContext: {
      name: args.projectName,
      domain: args.domain,
    },
    options: {
      depth: args.depth,
      outputFormat: args.format === 'both' ? 'both' : args.format,
      createCheckpoint: false,
      skillsPath: args.skillsPath,
      evaluations: {
        personas: true,
        gapAnalysis: true,
        preWorkIdentification: true,
        metricsDefinition: true,
      },
    },
  };

  try {
    const output = await input.execRuntime(capabilityInput);

    const json = `${JSON.stringify(output, null, 2)}\n`;
    const md = renderStrategicPlannerMarkdown(output as any);

    if (args.outputPath) {
      const dir = path.dirname(args.outputPath);
      await mkdir(dir, { recursive: true });

      if (args.format === 'json') {
        await writeFile(args.outputPath, json, 'utf8');
      } else if (args.format === 'markdown') {
        await writeFile(args.outputPath, md, 'utf8');
      } else {
        const ext = path.extname(args.outputPath);
        const base = ext.length > 0 ? args.outputPath.slice(0, -ext.length) : args.outputPath;
        await writeFile(`${base}.json`, json, 'utf8');
        await writeFile(`${base}.md`, md, 'utf8');
      }
    }

    if (args.format === 'markdown') {
      return { exitCode: 0, stdout: md, stderr: '' };
    }
    if (args.format === 'both' && !args.outputPath) {
      // Keep JSON on stdout (pipeline-friendly) and markdown on stderr (human-friendly).
      return { exitCode: 0, stdout: json, stderr: md };
    }
    return { exitCode: 0, stdout: json, stderr: '' };
  } catch (err) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: err instanceof Error ? err.stack ?? err.message : String(err),
    };
  }
}

