/**
 * packages/tools/harmony-cli/src/cli.test.ts
 *
 * Purpose: TDD coverage for top-level CLI routing/help.
 */
import { describe, expect, it } from 'vitest';

// NOTE: This will fail until implemented (TDD: RED first).
import { runCli } from './cli.js';

describe('harmony CLI', () => {
  it('prints help for --help', async () => {
    const res = await runCli(['--help'], {
      execRuntime: async () => ({}),
    });
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('harmony - Harmony CLI');
    expect(res.stdout).toContain('strategic-plan');
  });
});

