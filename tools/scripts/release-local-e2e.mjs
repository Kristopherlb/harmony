/**
 * tools/scripts/release-local-e2e.mjs
 *
 * Purpose:
 * - Local runtime-true release E2E harness:
 *   GitHub webhook → Console ingress → Temporal workflow → GitHub API (via Dagger capabilities)
 *
 * Usage (recommended):
 *   # Terminal 1 (deps)
 *   pnpm nx run harmony:dev-up
 *
 *   # Terminal 2 (worker)
 *   pnpm nx run harmony:dev-worker-dagger
 *
 *   # Terminal 3 (console)
 *   pnpm nx run console:serve
 *
 *   # Terminal 4 (this harness)
 *   GITHUB_TOKEN=... node tools/scripts/release-local-e2e.mjs --repo owner/repo
 *
 * One-command mode (spawns worker + console):
 *   GITHUB_TOKEN=... node tools/scripts/release-local-e2e.mjs --repo owner/repo --spawn
 *
 * Notes:
 * - Secrets are written to local OpenBao dev (BAO_TOKEN default "root").
 * - This script never prints secret values.
 */
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import process from 'node:process';

function usage() {
  // eslint-disable-next-line no-console
  console.log(
    [
      'Usage:',
      '  GITHUB_TOKEN=... node tools/scripts/release-local-e2e.mjs --repo owner/repo [options]',
      '',
      'Options:',
      '  --repo <owner/repo>         Required. Repo full name used in webhook payload.',
      '  --base-url <url>           Console base URL (default: http://localhost:5000).',
      '  --bao-addr <url>           OpenBao address (default: http://localhost:8200).',
      '  --bao-token <token>        OpenBao token (default: root).',
      '  --bao-mount <mount>        OpenBao KV mount (default: secret).',
      '  --webhook-secret <secret>  Webhook signing secret to write to OpenBao (default: whsec_local).',
      '  --spawn                    Spawn console + worker locally (best effort).',
      '  --timeout-ms <ms>          Overall timeout (default: 180000).',
      '',
      'Env:',
      '  GITHUB_TOKEN (required)     GitHub token for API calls (read by capabilities via OpenBao).',
      '',
    ].join('\n')
  );
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--repo') args.repo = argv[++i];
    else if (a === '--base-url') args.baseUrl = argv[++i];
    else if (a === '--bao-addr') args.baoAddr = argv[++i];
    else if (a === '--bao-token') args.baoToken = argv[++i];
    else if (a === '--bao-mount') args.baoMount = argv[++i];
    else if (a === '--webhook-secret') args.webhookSecret = argv[++i];
    else if (a === '--spawn') args.spawn = true;
    else if (a === '--timeout-ms') args.timeoutMs = Number(argv[++i]);
    else if (a.startsWith('-')) throw new Error(`Unknown flag: ${a}`);
    else args._.push(a);
  }
  return args;
}

function joinUrl(base, p) {
  const b = String(base).replace(/\/+$/, '');
  const path = String(p).startsWith('/') ? String(p) : `/${String(p)}`;
  return `${b}${path}`;
}

function normalizeRef(ref) {
  return String(ref).replace(/^\/+/, '');
}

function openBaoKvV2DataUrl({ baoAddr, mount, refPath }) {
  const m = String(mount).replace(/^\/+|\/+$/g, '');
  const rel = normalizeRef(refPath);
  return joinUrl(baoAddr, `/v1/${m}/data/${rel}`);
}

async function openBaoWriteSecret({ baoAddr, baoToken, mount, refPath, value }) {
  const url = openBaoKvV2DataUrl({ baoAddr, mount, refPath });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-Vault-Token': baoToken, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ data: { value } }),
  });
  if (!res.ok) {
    const text = (await res.text().catch(() => '')) || res.statusText;
    throw new Error(`OPENBAO_WRITE_FAILED (${res.status}): ${text}`);
  }
}

function signGitHubBody({ secret, rawBody }) {
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return `sha256=${digest}`;
}

async function sleep(ms) {
  return await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    // ignore
  }
  return { ok: res.ok, status: res.status, json, text };
}

async function waitForOk({ url, timeoutMs, intervalMs }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await fetchJson(url, { method: 'GET', headers: { Accept: 'application/json' } });
    if (r.ok) return r;
    await sleep(intervalMs);
  }
  throw new Error(`TIMEOUT_WAITING_FOR_OK (${url})`);
}

function spawnNx(cmd, env) {
  const child = spawn('pnpm', ['nx', 'run', cmd], {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  return child;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  const repo = String(args.repo ?? '').trim();
  if (!repo.includes('/')) throw new Error('--repo is required (owner/repo)');
  const baseUrl = String(args.baseUrl ?? 'http://localhost:5000');

  const baoAddr = String(args.baoAddr ?? process.env.BAO_ADDR ?? process.env.VAULT_ADDR ?? 'http://localhost:8200');
  const baoToken = String(args.baoToken ?? process.env.BAO_TOKEN ?? process.env.VAULT_TOKEN ?? 'root');
  const baoMount = String(args.baoMount ?? process.env.BAO_KV_MOUNT ?? 'secret');

  const webhookSecret = String(args.webhookSecret ?? 'whsec_local');
  const githubToken = String(process.env.GITHUB_TOKEN ?? '').trim();
  if (!githubToken) throw new Error('GITHUB_TOKEN is required in env (will be written to OpenBao; never printed).');

  const timeoutMs = Number.isFinite(args.timeoutMs) ? args.timeoutMs : 180_000;

  const webhookSecretRef = '/artifacts/console/public/secrets/github.webhook_secret';
  const tokenSecretRef = '/artifacts/console/public/secrets/github.token';

  const spawned = [];
  try {
    if (args.spawn) {
      spawned.push(
        spawnNx('harmony:dev-worker-dagger', {
          ENABLE_DAGGER_E2E: '1',
          BAO_ADDR: baoAddr,
          BAO_TOKEN: baoToken,
          BAO_KV_MOUNT: baoMount,
        })
      );
      spawned.push(
        spawnNx('console:serve', {
          GITHUB_WEBHOOK_SECRET_REF: webhookSecretRef,
          GITHUB_TOKEN_SECRET_REF: tokenSecretRef,
          BAO_ADDR: baoAddr,
          BAO_TOKEN: baoToken,
          BAO_KV_MOUNT: baoMount,
        })
      );
    }

    // 1) Wait for Console Temporal health (implies server up + Temporal reachable)
    await waitForOk({ url: joinUrl(baseUrl, '/api/workflows/health'), timeoutMs, intervalMs: 750 });

    // 2) Seed OpenBao secrets (webhook signing + GitHub token)
    await openBaoWriteSecret({
      baoAddr,
      baoToken,
      mount: baoMount,
      refPath: webhookSecretRef,
      value: webhookSecret,
    });
    await openBaoWriteSecret({
      baoAddr,
      baoToken,
      mount: baoMount,
      refPath: tokenSecretRef,
      value: githubToken,
    });

    // 3) Send signed GitHub webhook
    const deliveryId = `local-${Date.now()}`;
    const payload = {
      repository: { full_name: repo },
      ref: 'refs/heads/main',
      after: crypto.randomBytes(20).toString('hex'),
      sender: { login: 'local-user' },
    };
    const rawBody = JSON.stringify(payload);
    const signature = signGitHubBody({ secret: webhookSecret, rawBody });

    const startRes = await fetchJson(joinUrl(baseUrl, '/api/webhooks/github'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-GitHub-Delivery': deliveryId,
        'X-GitHub-Event': 'push',
        'X-Hub-Signature-256': signature,
      },
      body: rawBody,
    });
    if (!startRes.ok) {
      throw new Error(`WEBHOOK_FAILED (${startRes.status}): ${startRes.text}`);
    }

    const workflowId = startRes.json?.workflowId;
    if (typeof workflowId !== 'string' || !workflowId) {
      throw new Error(`WEBHOOK_RESPONSE_MISSING_WORKFLOW_ID: ${startRes.text}`);
    }

    // 4) Verify workflow is visible in Temporal (via Console API)
    await waitForOk({ url: joinUrl(baseUrl, `/api/workflows/${encodeURIComponent(workflowId)}`), timeoutMs, intervalMs: 750 });

    // 5) Wait for deterministic workflow output (result endpoint)
    const resultUrl = joinUrl(baseUrl, `/api/workflows/${encodeURIComponent(workflowId)}/result`);
    const deadline = Date.now() + timeoutMs;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const r = await fetchJson(resultUrl, { method: 'GET', headers: { Accept: 'application/json' } });
      if (r.ok) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ ok: true, workflowId, result: r.json?.result ?? r.json }, null, 2));
        return;
      }
      if (Date.now() > deadline) {
        throw new Error(`TIMEOUT_WAITING_FOR_WORKFLOW_RESULT (${workflowId})`);
      }
      await sleep(1000);
    }
  } finally {
    // best-effort cleanup for spawned processes
    for (const p of spawned) {
      try {
        p.kill('SIGTERM');
      } catch {
        // ignore
      }
    }
  }
}

export const __test = {
  parseArgs,
  openBaoKvV2DataUrl,
  signGitHubBody,
};

if (process.argv[1] && process.argv[1].endsWith('release-local-e2e.mjs')) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err?.stack ?? String(err));
    process.exit(1);
  });
}

