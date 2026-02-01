/**
 * packages/tools/mcp-server/src/demo/demo-args.ts
 * Parse CLI args for the Persona A MCP demo.
 */
export interface DemoArgs {
  local: boolean;
  temporal: boolean;
  name: string;
  arguments: Record<string, unknown>;
  output: 'json' | 'table';
}

function findFlagValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i === -1) return undefined;
  const v = argv[i + 1];
  if (!v || v.startsWith('-')) return undefined;
  return v;
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

export function parseDemoArgs(input: { argv: string[] }): DemoArgs {
  const argv = input.argv;
  const local = hasFlag(argv, '--local');
  const temporal = hasFlag(argv, '--temporal') || !local;

  const name = findFlagValue(argv, '--name') ?? 'golden.echo';
  const output = hasFlag(argv, '--table') ? 'table' : ((findFlagValue(argv, '--output') ?? 'json') as 'json' | 'table');

  // Default demo input: empty on purpose (avoid hardcoded values).
  // If the user doesn't provide args, the tool surface will validate and return INPUT_VALIDATION_FAILED.
  const outArgs: Record<string, unknown> = {};

  const xRaw = findFlagValue(argv, '--x');
  if (typeof xRaw === 'string') {
    const n = Number(xRaw);
    if (Number.isFinite(n)) outArgs.x = n;
  }

  const jsonRaw = findFlagValue(argv, '--args');
  if (typeof jsonRaw === 'string') {
    const parsed = JSON.parse(jsonRaw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { local, temporal, name, output, arguments: parsed as Record<string, unknown> };
    }
  }

  return { local, temporal, name, output, arguments: outArgs };
}

