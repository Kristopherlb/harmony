/**
 * tools/scripts/dev-bootstrap.mjs
 *
 * Purpose: safe, non-daemon dev bootstrap helper.
 * - Prints the canonical "next commands" after `harmony:dev-up`.
 * - Optionally checks service readiness (Temporal + Temporal UI).
 *
 * Usage:
 *   node tools/scripts/dev-bootstrap.mjs [--check] [--wait-ms <ms>] [--timeout-ms <ms>]
 *
 * Example:
 *   pnpm nx run harmony:dev-bootstrap -- --check --wait-ms 15000
 */
import net from 'node:net';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORTS = [
  { name: 'Temporal gRPC', host: '127.0.0.1', port: 7233 },
  { name: 'Temporal UI', host: '127.0.0.1', port: 8233 },
];

function usage() {
  // eslint-disable-next-line no-console
  console.log(
    [
      'Usage:',
      '  node tools/scripts/dev-bootstrap.mjs [--check] [--wait-ms <ms>] [--timeout-ms <ms>]',
      '',
      'Behavior:',
      '  - Always prints the next canonical dev commands (worker + demo).',
      '  - With --check, verifies Temporal ports are reachable.',
      '  - With --wait-ms, waits up to that long for ports to become reachable (only with --check).',
      '',
      'Examples:',
      '  pnpm nx run harmony:dev-bootstrap',
      '  pnpm nx run harmony:dev-bootstrap -- --check',
      '  pnpm nx run harmony:dev-bootstrap -- --check --wait-ms 15000',
    ].join('\n')
  );
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      args.help = true;
      continue;
    }
    if (a === '--check') {
      args.check = true;
      continue;
    }
    if (a === '--wait-ms') {
      const raw = argv[++i];
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid --wait-ms: ${raw}`);
      args.waitMs = n;
      continue;
    }
    if (a === '--timeout-ms') {
      const raw = argv[++i];
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid --timeout-ms: ${raw}`);
      args.timeoutMs = n;
      continue;
    }
    if (a.startsWith('-')) {
      throw new Error(`Unknown flag: ${a}`);
    }
    args._.push(a);
  }
  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkTcpPort({ host, port, timeoutMs }) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${port}`);
  }

  return await new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const done = (ok, reason) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve({ ok, reason });
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false, 'timeout'));
    socket.once('error', (err) => done(false, err?.code ?? 'error'));

    socket.connect(port, host);
  });
}

async function checkPorts({ ports, timeoutMs, waitMs }) {
  const startedAt = Date.now();
  const deadline = startedAt + waitMs;

  // Always attempt once; if waitMs>0, retry until deadline.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const results = await Promise.all(
      ports.map(async (p) => {
        const r = await checkTcpPort({ host: p.host, port: p.port, timeoutMs });
        return { ...p, ...r };
      })
    );

    const allOk = results.every((r) => r.ok);
    if (allOk) return results;

    if (Date.now() >= deadline) return results;
    await sleep(250);
  }
}

function printNextCommands() {
  // eslint-disable-next-line no-console
  console.log(
    [
      '',
      'Next (run in separate terminals):',
      '- pnpm nx run harmony:dev-worker',
      '- pnpm nx run harmony:dev-demo -- --x 7',
      '',
      'Notes:',
      '- Temporal mode is default; local fallback requires `harmony:dev-demo-local`.',
      '- To stop dependencies: pnpm nx run harmony:dev-down',
      '',
      'Optional status checks:',
      '- pnpm nx run harmony:dev-bootstrap -- --check --wait-ms 15000',
      '',
    ].join('\n')
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  printNextCommands();

  if (!args.check) return;

  const timeoutMs = args.timeoutMs ?? 750;
  const waitMs = args.waitMs ?? 0;

  const results = await checkPorts({ ports: DEFAULT_PORTS, timeoutMs, waitMs });
  const anyFail = results.some((r) => !r.ok);

  // eslint-disable-next-line no-console
  console.log('Service readiness:');
  for (const r of results) {
    // eslint-disable-next-line no-console
    console.log(`- ${r.ok ? 'OK' : 'FAIL'} ${r.name} (${r.host}:${r.port})${r.ok ? '' : ` [${r.reason}]`}`);
  }

  if (anyFail) {
    // eslint-disable-next-line no-console
    console.error(
      [
        '',
        'Some services are not reachable yet.',
        'If you just started them, re-run with a wait window:',
        '  pnpm nx run harmony:dev-bootstrap -- --check --wait-ms 15000',
        '',
        'If Temporal is still unavailable, ensure dependencies are up:',
        '  pnpm nx run harmony:dev-up',
        '',
      ].join('\n')
    );
    process.exit(1);
  }
}

export const __test = {
  parseArgs,
  checkTcpPort,
  checkPorts,
};

function isMainModule() {
  const invoked = process.argv[1] ? path.resolve(process.argv[1]) : null;
  const self = path.resolve(fileURLToPath(import.meta.url));
  return Boolean(invoked && invoked === self);
}

if (isMainModule()) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err?.stack ?? String(err));
    process.exit(1);
  });
}

