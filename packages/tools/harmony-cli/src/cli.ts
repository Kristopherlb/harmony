/**
 * packages/tools/harmony-cli/src/cli.ts
 *
 * Purpose: repo-local CLI entrypoint for Harmony tooling.
 *
 * Primary command:
 * - `harmony strategic-plan` -> runs `golden.reasoners.strategic-planner` deterministic evaluator
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { parseStrategicPlanArgsFromArgv } from './strategic-plan.args.js';
import { runStrategicPlan } from './strategic-plan.run.js';

type ExecRuntime = (input: unknown) => Promise<unknown>;

export type CliResult = {
  exitCode: 0 | 1;
  stdout: string;
  stderr: string;
};

function printHelp(): string {
  return `
harmony - Harmony CLI (repo-local)

Usage:
  harmony <command> [options]

Commands:
  strategic-plan    Evaluate a plan using the Strategic Planner reasoner

Examples:
  harmony strategic-plan --plan=./my.plan.md --project-name=harmony --domain=incident-management
  harmony strategic-plan --content="# Plan..." --project-name=harmony --domain=other --format=markdown
  harmony strategic-plan --plan=./my.plan.md --project-name=harmony --domain=incident-management --output=./evaluation.json
`.trimStart();
}

function printStrategicPlanHelp(): string {
  return `
harmony strategic-plan - Evaluate an implementation plan

Usage:
  harmony strategic-plan (--plan=<path> | --content=<text> | --intent=<text>) \\
    --project-name=<name> --domain=<domain> [options]

Plan source (choose one):
  --plan=<path>          Path to a .plan.md or JSON plan (repo-relative or absolute)
  --content=<text>       Raw plan content (markdown or JSON)
  --intent=<text>        Natural language intent (provide goals/constraints too)
  --goal=<text>          Repeatable (only with --intent)
  --constraint=<text>    Repeatable (only with --intent)

Options:
  --domain=<domain>      incident-management|ci-cd|security|observability|data-platform|developer-experience|compliance|other
  --project-name=<name>  Project name used in summary output
  --depth=<depth>        quick|standard|thorough (default: standard)
  --format=<format>      json|markdown|both (default: both)
  --output=<path>        Write output to file. For --format=both, writes <base>.json and <base>.md
  --skills-path=<path>   Override project skills directory (default: <repo>/.cursor/skills)
  --help, -h             Show this help

Notes:
  - Uses the deterministic runtime evaluator at:
    packages/capabilities/src/reasoners/strategic-planner/runtime/strategic-planner.runtime.mjs
`.trimStart();
}

function hasRepoMarkers(dir: string): boolean {
  return (
    existsSync(path.join(dir, 'nx.json')) &&
    existsSync(path.join(dir, 'pnpm-workspace.yaml')) &&
    existsSync(path.join(dir, 'package.json'))
  );
}

/**
 * Resolve repo root by walking upward from current working directory.
 *
 * This avoids depending on `@golden/core` build state for CLI availability.
 */
function getRepoRootFromCwd(startDir: string): string {
  let cur = path.resolve(startDir);
  for (let i = 0; i < 25; i++) {
    if (hasRepoMarkers(cur)) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return path.resolve(startDir);
}

async function execStrategicPlannerRuntime(payload: unknown): Promise<unknown> {
  const repoRoot = getRepoRootFromCwd(process.cwd());
  const runtimePath = path.join(
    repoRoot,
    'packages/capabilities/src/reasoners/strategic-planner/runtime/strategic-planner.runtime.mjs'
  );

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, [runtimePath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        REPO_ROOT: repoRoot,
        INPUT_JSON: JSON.stringify(payload),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d.toString('utf8')));
    child.stderr.on('data', (d) => (err += d.toString('utf8')));

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`strategic-planner runtime failed (exit ${code}): ${err || out}`));
      } else {
        resolve(out);
      }
    });
  });

  return JSON.parse(stdout);
}

export async function runCli(argv: string[], deps?: { execRuntime?: ExecRuntime }): Promise<CliResult> {
  const args = argv.slice(0);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    return { exitCode: 0, stdout: `${printHelp()}\n`, stderr: '' };
  }

  const cmd = args[0];
  if (cmd === 'strategic-plan') {
    const parsed = parseStrategicPlanArgsFromArgv(args);
    if (parsed.help) {
      return { exitCode: 0, stdout: `${printStrategicPlanHelp()}\n`, stderr: '' };
    }

    const execRuntime = deps?.execRuntime ?? execStrategicPlannerRuntime;
    const res = await runStrategicPlan({ args: parsed, execRuntime });
    return res;
  }

  return { exitCode: 1, stdout: `${printHelp()}\n`, stderr: `Unknown command: ${cmd}\n` };
}

