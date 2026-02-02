/**
 * tools/scripts/nx-test-debug.mjs
 *
 * Purpose: provide a reliable "show me the real Vitest output" workflow when Nx test output is terse.
 *
 * Usage:
 *   pnpm nx:test:debug <project> [-- <vitest-args...>]
 *
 * Examples:
 *   pnpm nx:test:debug path
 *   pnpm nx:test:debug capabilities -- src/connectors/slack-connector.capability.test.ts
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function die(message) {
  // eslint-disable-next-line no-console
  console.error(message);
  process.exit(1);
}

function run(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...options });
  if (r.error) throw r.error;
  return r.status ?? 0;
}

function runCapture(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...options });
  if (r.error) throw r.error;
  return { status: r.status ?? 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function parseArgs(argv) {
  const dd = argv.indexOf('--');
  const positional = dd >= 0 ? argv.slice(0, dd) : argv.slice(0);
  const passthrough = dd >= 0 ? argv.slice(dd + 1) : [];

  const project = positional[0];
  if (!project) {
    die('Usage: pnpm nx:test:debug <project> [-- <vitest-args...>]');
  }
  return { project, vitestArgs: passthrough };
}

function resolveProjectRoot(project) {
  // Nx 18: `nx show project <name> --json` (stable, non-interactive).
  const { status, stdout } = runCapture('pnpm', ['nx', 'show', 'project', project, '--json'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (status !== 0) return undefined;
  try {
    const parsed = JSON.parse(stdout);
    return typeof parsed.root === 'string' ? parsed.root : undefined;
  } catch {
    return undefined;
  }
}

function hasVitestConfig(projectRoot) {
  return fs.existsSync(path.join(projectRoot, 'vitest.config.ts')) || fs.existsSync(path.join(projectRoot, 'vitest.config.js'));
}

function main() {
  const { project, vitestArgs } = parseArgs(process.argv.slice(2));
  const projectRoot = resolveProjectRoot(project);

  if (!projectRoot) {
    die(
      [
        `Could not resolve Nx project root for "${project}".`,
        `Try: pnpm nx show project ${project} --json`,
      ].join('\n')
    );
  }

  if (!hasVitestConfig(projectRoot)) {
    // Fallback: at least make Nx verbose.
    process.exit(run('pnpm', ['nx', 'test', project, '--verbose']));
  }

  const status = run('pnpm', [
    '--dir',
    projectRoot,
    'exec',
    'vitest',
    'run',
    '--reporter=verbose',
    ...vitestArgs,
  ]);
  process.exit(status);
}

main();

