/**
 * packages/tools/harmony-cli/src/strategic-plan.args.test.ts
 *
 * Purpose: TDD coverage for strategic-plan CLI arg parsing.
 */
import { describe, expect, it } from 'vitest';

// NOTE: This will fail until implemented (TDD: RED first).
import { parseStrategicPlanArgsFromArgv } from './strategic-plan.args.js';

describe('harmony strategic-plan CLI args', () => {
  it('requires --plan or --content or --intent', () => {
    expect(() =>
      parseStrategicPlanArgsFromArgv(['strategic-plan', '--domain=incident-management', '--project-name=harmony'])
    ).toThrow(/--plan.*--content.*--intent/i);
  });

  it('rejects specifying more than one plan source', () => {
    expect(() =>
      parseStrategicPlanArgsFromArgv([
        'strategic-plan',
        '--plan=./x.plan.md',
        '--content=hello',
        '--domain=incident-management',
        '--project-name=harmony',
      ])
    ).toThrow(/plan source/i);
  });

  it('parses basic options and defaults', () => {
    const args = parseStrategicPlanArgsFromArgv([
      'strategic-plan',
      '--plan=./my.plan.md',
      '--domain=incident-management',
      '--project-name=harmony',
    ]);

    expect(args).toMatchObject({
      subcommand: 'strategic-plan',
      planPath: './my.plan.md',
      domain: 'incident-management',
      projectName: 'harmony',
      depth: 'standard',
      format: 'both',
      help: false,
    });
  });

  it('supports markdown-only output', () => {
    const args = parseStrategicPlanArgsFromArgv([
      'strategic-plan',
      '--plan=./my.plan.md',
      '--domain=incident-management',
      '--project-name=harmony',
      '--format=markdown',
    ]);

    expect(args.format).toBe('markdown');
  });

  it('parses --output and normalizes it', () => {
    const args = parseStrategicPlanArgsFromArgv([
      'strategic-plan',
      '--plan=./my.plan.md',
      '--domain=incident-management',
      '--project-name=harmony',
      '--output=./out/eval.json',
    ]);

    expect(args.outputPath).toBe('./out/eval.json');
  });
});

