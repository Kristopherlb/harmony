/**
 * packages/tools/mcp-server/src/cli/run-blueprint.args.test.ts
 *
 * Purpose: TDD coverage for run-blueprint arg parsing enhancements (IMP-024).
 */
import { describe, expect, it } from 'vitest';

// NOTE: This will fail until implemented (TDD: RED first).
import { parseCliArgsFromArgv } from './run-blueprint.args.js';

describe('run-blueprint CLI args', () => {
  it('supports --input-file and rejects also specifying --input', () => {
    expect(() =>
      parseCliArgsFromArgv([
        '--blueprint=workflows.echo',
        '--input-file=/tmp/input.json',
        `--input={"x":1}`,
      ])
    ).toThrow(/--input-file.*--input/i);
  });

  it('parses --input-file path when provided', () => {
    const args = parseCliArgsFromArgv([
      '--blueprint=workflows.echo',
      '--input-file=/tmp/input.json',
      '--no-await',
      '--timeout=1234',
    ]);

    expect(args).toMatchObject({
      blueprint: 'workflows.echo',
      inputFile: '/tmp/input.json',
      await: false,
      timeoutMs: 1234,
    });
  });
});

