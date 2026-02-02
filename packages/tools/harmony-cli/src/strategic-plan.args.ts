/**
 * packages/tools/harmony-cli/src/strategic-plan.args.ts
 *
 * Purpose: side-effect-free CLI arg parsing for `harmony strategic-plan` (testable).
 */
export type StrategicPlanOutputFormat = 'json' | 'markdown' | 'both';
export type StrategicPlanDepth = 'quick' | 'standard' | 'thorough';

export type StrategicPlanCliArgs = {
  subcommand: 'strategic-plan';
  planPath?: string;
  content?: string;
  intent?: string;
  goals?: string[];
  constraints?: string[];
  projectName: string;
  domain:
    | 'incident-management'
    | 'ci-cd'
    | 'security'
    | 'observability'
    | 'data-platform'
    | 'developer-experience'
    | 'compliance'
    | 'other';
  depth: StrategicPlanDepth;
  format: StrategicPlanOutputFormat;
  outputPath?: string;
  skillsPath?: string;
  help: boolean;
};

function pushToList(target: string[] | undefined, value: string): string[] {
  const next = target ? [...target] : [];
  next.push(value);
  return next;
}

export function parseStrategicPlanArgsFromArgv(argv: string[]): StrategicPlanCliArgs {
  // argv includes subcommand at position 0 (e.g. `strategic-plan`).
  const sub = argv[0];
  const args: StrategicPlanCliArgs = {
    subcommand: 'strategic-plan',
    projectName: '',
    domain: 'other',
    depth: 'standard',
    format: 'both',
    help: false,
  };

  if (sub !== 'strategic-plan') {
    throw new Error(`Invalid args: expected subcommand 'strategic-plan', got '${sub ?? ''}'`);
  }

  for (const raw of argv.slice(1)) {
    if (raw === '--help' || raw === '-h') {
      args.help = true;
    } else if (raw.startsWith('--plan=')) {
      args.planPath = raw.slice('--plan='.length);
    } else if (raw.startsWith('--content=')) {
      args.content = raw.slice('--content='.length);
    } else if (raw.startsWith('--intent=')) {
      args.intent = raw.slice('--intent='.length);
    } else if (raw.startsWith('--goal=')) {
      args.goals = pushToList(args.goals, raw.slice('--goal='.length));
    } else if (raw.startsWith('--constraint=')) {
      args.constraints = pushToList(args.constraints, raw.slice('--constraint='.length));
    } else if (raw.startsWith('--project-name=')) {
      args.projectName = raw.slice('--project-name='.length);
    } else if (raw.startsWith('--domain=')) {
      const v = raw.slice('--domain='.length) as StrategicPlanCliArgs['domain'];
      args.domain = v;
    } else if (raw.startsWith('--depth=')) {
      const v = raw.slice('--depth='.length) as StrategicPlanDepth;
      args.depth = v;
    } else if (raw.startsWith('--format=')) {
      const v = raw.slice('--format='.length) as StrategicPlanOutputFormat;
      args.format = v;
    } else if (raw.startsWith('--output=')) {
      args.outputPath = raw.slice('--output='.length);
    } else if (raw.startsWith('--skills-path=')) {
      args.skillsPath = raw.slice('--skills-path='.length);
    }
  }

  const sources = [args.planPath ? 1 : 0, args.content ? 1 : 0, args.intent ? 1 : 0].reduce((a, b) => a + b, 0);
  if (!args.help) {
    if (sources === 0) {
      throw new Error('Invalid args: one plan source is required (--plan=... | --content=... | --intent=...)');
    }
    if (sources > 1) {
      throw new Error('Invalid args: specify only one plan source (--plan|--content|--intent)');
    }
    if (!args.projectName) {
      throw new Error('Invalid args: --project-name is required');
    }
    if (!args.domain) {
      throw new Error('Invalid args: --domain is required');
    }
  }

  return args;
}

