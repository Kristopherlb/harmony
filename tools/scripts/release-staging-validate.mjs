/**
 * tools/scripts/release-staging-validate.mjs
 *
 * Purpose:
 * - Staging validation helper for the Release baseline:
 *   Send a GitHub-style signed webhook to Console, confirm a Temporal run starts,
 *   then re-send with the SAME delivery ID to verify idempotency behavior.
 *
 * Usage:
 *   node tools/scripts/release-staging-validate.mjs --base-url https://<staging-console> --repo owner/repo --webhook-secret-env GITHUB_WEBHOOK_SECRET
 *
 * Notes:
 * - This script does NOT read or write OpenBao. Staging must already have:
 *   - GITHUB_WEBHOOK_SECRET_REF in OpenBao matching the signing secret
 *   - GITHUB_TOKEN_SECRET_REF in OpenBao for the GitHub API token
 * - This script never prints secret values.
 */
import crypto from 'node:crypto';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';

function usage() {
  // eslint-disable-next-line no-console
  console.log(
    [
      'Usage:',
      '  node tools/scripts/release-staging-validate.mjs --base-url <url> --repo owner/repo --webhook-secret-env <ENV>',
      '',
      'Required:',
      '  --base-url <url>               Console base URL (e.g. https://console-staging.example.com)',
      '  --repo <owner/repo>            Repo full name used in webhook payload',
      '  --webhook-secret-env <ENV>     Environment variable name containing the GitHub webhook signing secret',
      '',
      'Optional:',
      '  --delivery-id <id>             Fixed delivery ID (default: generated)',
      '  --timeout-ms <ms>              Overall timeout (default: 240000)',
      '',
    ].join('\n')
  );
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--base-url') args.baseUrl = argv[++i];
    else if (a === '--repo') args.repo = argv[++i];
    else if (a === '--webhook-secret-env') args.webhookSecretEnv = argv[++i];
    else if (a === '--delivery-id') args.deliveryId = argv[++i];
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

function signGitHubBody({ secret, rawBody }) {
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return `sha256=${digest}`;
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

async function waitForWorkflowResult({ baseUrl, workflowId, timeoutMs }) {
  const url = joinUrl(baseUrl, `/api/workflows/${encodeURIComponent(workflowId)}/result`);
  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const r = await fetchJson(url, { method: 'GET', headers: { Accept: 'application/json' } });
    if (r.ok) return r.json;
    if (Date.now() > deadline) throw new Error(`TIMEOUT_WAITING_FOR_WORKFLOW_RESULT (${workflowId})`);
    await sleep(1000);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  const baseUrl = String(args.baseUrl ?? '').trim();
  const repo = String(args.repo ?? '').trim();
  const secretEnv = String(args.webhookSecretEnv ?? '').trim();
  if (!baseUrl) throw new Error('--base-url is required');
  if (!repo.includes('/')) throw new Error('--repo is required (owner/repo)');
  if (!secretEnv) throw new Error('--webhook-secret-env is required');

  const webhookSecret = String(process.env[secretEnv] ?? '').trim();
  if (!webhookSecret) {
    throw new Error(`Missing webhook secret: env ${secretEnv} was empty`);
  }

  const timeoutMs = Number.isFinite(args.timeoutMs) ? args.timeoutMs : 240_000;
  const deliveryId = String(args.deliveryId ?? `staging-${Date.now()}`);

  // 1) Health checks
  const temporalHealth = await fetchJson(joinUrl(baseUrl, '/api/workflows/health'), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!temporalHealth.ok) throw new Error(`TEMPORAL_HEALTH_FAILED (${temporalHealth.status}): ${temporalHealth.text}`);

  // 2) First delivery (should start)
  const payload = {
    repository: { full_name: repo },
    ref: 'refs/heads/main',
    after: crypto.randomBytes(20).toString('hex'),
    sender: { login: 'staging-validator' },
  };
  const rawBody = JSON.stringify(payload);
  const signature = signGitHubBody({ secret: webhookSecret, rawBody });

  const first = await fetchJson(joinUrl(baseUrl, '/api/webhooks/github'), {
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
  if (!first.ok) throw new Error(`FIRST_WEBHOOK_FAILED (${first.status}): ${first.text}`);

  const workflowId = first.json?.workflowId;
  const firstRunId = first.json?.runId;
  if (typeof workflowId !== 'string' || workflowId.length === 0) throw new Error(`Missing workflowId: ${first.text}`);
  if (typeof firstRunId !== 'string' || firstRunId.length === 0) throw new Error(`Missing runId: ${first.text}`);

  // 3) Second delivery with same ID (should NOT start a new run)
  const second = await fetchJson(joinUrl(baseUrl, '/api/webhooks/github'), {
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
  if (!second.ok) throw new Error(`SECOND_WEBHOOK_FAILED (${second.status}): ${second.text}`);

  const secondStarted = Boolean(second.json?.started);
  const secondRunId = second.json?.runId;

  if (secondStarted) {
    throw new Error(`IDEMPOTENCY_FAILED: second delivery reported started=true for deliveryId=${deliveryId}`);
  }
  if (typeof secondRunId !== 'string' || secondRunId.length === 0) {
    throw new Error(`IDEMPOTENCY_FAILED: second delivery missing runId (expected describe)`);
  }
  if (secondRunId !== firstRunId) {
    throw new Error(`IDEMPOTENCY_FAILED: runId mismatch (first=${firstRunId}, second=${secondRunId})`);
  }

  const result = await waitForWorkflowResult({ baseUrl, workflowId, timeoutMs });
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        deliveryId,
        workflowId,
        runId: firstRunId,
        idempotent: true,
        result,
      },
      null,
      2
    )
  );
}

export const __test = { parseArgs, signGitHubBody, joinUrl };

if (process.argv[1] && process.argv[1].endsWith('release-staging-validate.mjs')) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err?.stack ?? String(err));
    process.exit(1);
  });
}

