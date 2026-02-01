/**
 * packages/tools/mcp-server/src/demo/demo-args.test.ts
 * TDD: parse demo args for run-demo.
 */
import { describe, it, expect } from 'vitest';
import { parseDemoArgs } from './demo-args.js';

describe('parseDemoArgs', () => {
  it('defaults to golden.echo with empty args (forces explicit input)', () => {
    expect(parseDemoArgs({ argv: ['node', 'run-demo.js'] })).toEqual({
      local: false,
      temporal: true,
      name: 'golden.echo',
      output: 'json',
      arguments: {},
    });
  });

  it('supports --local', () => {
    expect(parseDemoArgs({ argv: ['node', 'run-demo.js', '--local'] }).local).toBe(true);
  });

  it('supports --x <number>', () => {
    expect(parseDemoArgs({ argv: ['node', 'run-demo.js', '--x', '42'] })).toMatchObject({
      arguments: { x: 42 },
    });
  });

  it('supports --name <toolId>', () => {
    expect(parseDemoArgs({ argv: ['node', 'run-demo.js', '--name', 'workflows.echo'] })).toMatchObject({
      name: 'workflows.echo',
    });
  });

  it('supports --args <json> (overrides --x)', () => {
    expect(parseDemoArgs({ argv: ['node', 'run-demo.js', '--x', '1', '--args', '{"x":9}'] })).toMatchObject({
      arguments: { x: 9 },
    });
  });

  it('supports --table', () => {
    expect(parseDemoArgs({ argv: ['node', 'run-demo.js', '--table'] })).toMatchObject({
      output: 'table',
    });
  });
});

