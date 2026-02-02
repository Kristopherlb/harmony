/**
 * packages/tools/mcp-server/src/cli/run-blueprint.args.ts
 *
 * Purpose: side-effect-free CLI arg parsing for run-blueprint (testable).
 */
export interface ParsedCliArgs {
  blueprint: string;
  input?: string;
  inputFile?: string;
  config?: string;
  await: boolean;
  timeoutMs: number;
  help: boolean;
}

export function parseCliArgsFromArgv(argv: string[]): ParsedCliArgs {
  const args: ParsedCliArgs = {
    blueprint: '',
    input: '{}',
    await: true,
    timeoutMs: 300_000,
    help: false,
  };

  for (const arg of argv) {
    if (arg.startsWith('--blueprint=')) {
      args.blueprint = arg.slice('--blueprint='.length);
    } else if (arg.startsWith('--input=')) {
      args.input = arg.slice('--input='.length);
    } else if (arg.startsWith('--input-file=')) {
      args.inputFile = arg.slice('--input-file='.length);
    } else if (arg.startsWith('--config=')) {
      args.config = arg.slice('--config='.length);
    } else if (arg === '--no-await') {
      args.await = false;
    } else if (arg.startsWith('--timeout=')) {
      args.timeoutMs = parseInt(arg.slice('--timeout='.length), 10);
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }

  if (args.inputFile && args.input && args.input !== '{}') {
    throw new Error('Invalid args: --input-file cannot be used with --input');
  }

  if (!args.blueprint && !args.help) {
    throw new Error('Invalid args: --blueprint is required');
  }

  return args;
}

