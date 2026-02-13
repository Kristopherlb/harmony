/**
 * packages/blueprints/scripts/run-openbao-secretrefs-smoke.ts
 *
 * Purpose: Runtime smoke harness proving:
 * OpenBao secretRef → KV v2 read → Dagger secret injection → capability execution
 *
 * Requirements:
 * - local OpenBao running (docker compose up -d openbao)
 * - ENABLE_DAGGER_E2E=1
 */
import { executeDaggerCapability } from '../src/worker/execute-dagger-capability.js';
import { spawnSync } from 'node:child_process';
import { checkDockerDaemon } from '../src/utils/docker-preflight.js';

type OpenBaoKvV2WritePayload = {
  data: Record<string, unknown>;
};

function readEnv(name: string, fallback?: string): string {
  const v = (process.env[name] ?? '').trim();
  if (v.length > 0) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env var: ${name}`);
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

async function assertOpenBaoHealthy(addr: string): Promise<void> {
  const url = joinUrl(addr, '/v1/sys/health');
  const res = await fetch(url, { method: 'GET' });
  // Vault/OpenBao sys/health can return non-200 for sealed/standby; treat any response as “reachable”
  // as long as we can parse status code.
  if (!res) throw new Error('OPENBAO_UNREACHABLE');
}

async function writeKvV2Secret(opts: {
  addr: string;
  token: string;
  mount: string;
  ref: string; // absolute secretRef path beginning with "/"
  value: string;
}): Promise<void> {
  const rel = opts.ref.replace(/^\/+/, '');
  const url = joinUrl(opts.addr, `/v1/${opts.mount}/data/${rel}`);
  const payload: OpenBaoKvV2WritePayload = { data: { value: opts.value } };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-vault-token': opts.token,
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`OPENBAO_WRITE_FAILED (${res.status})`);
  }
}

async function main() {
  const docker = checkDockerDaemon({ env: process.env, spawnSyncImpl: spawnSync as any });
  if (!docker.ok) {
    throw new Error(`DOCKER_DAEMON_UNAVAILABLE: ${docker.message}`);
  }

  if ((process.env.ENABLE_DAGGER_E2E ?? '') !== '1') {
    throw new Error('DAGGER_E2E_DISABLED (set ENABLE_DAGGER_E2E=1)');
  }

  const addr = readEnv('BAO_ADDR', process.env.VAULT_ADDR ?? 'http://localhost:8200');
  const token = readEnv('BAO_TOKEN', process.env.VAULT_TOKEN ?? 'root');
  const mount = readEnv('BAO_KV_MOUNT', 'secret');

  const secretRef = '/artifacts/console/public/secrets/engine_mvp.smoke';
  const secretValue = 'engine-mvp-smoke-value';

  await assertOpenBaoHealthy(addr);
  await writeKvV2Secret({ addr, token, mount, ref: secretRef, value: secretValue });

  const out = await executeDaggerCapability({
    capId: 'golden.demo.secret-present',
    input: {},
    config: {},
    secretRefs: { value: secretRef },
    runAs: 'smoke-user',
    traceId: 'smoke-openbao-secretrefs',
    ctx: {
      app_id: 'console',
      environment: 'local',
      initiator_id: 'smoke-user',
      trace_id: 'smoke-openbao-secretrefs',
      cost_center: 'local',
      data_classification: 'INTERNAL',
    },
  });

  // Success signal: capability ran and produced expected JSON output.
  // Do not print the secret value.
  if (!out || typeof out !== 'object' || (out as any).ok !== true) {
    throw new Error('SMOKE_FAILED');
  }

  process.stdout.write(JSON.stringify({ ok: true }) + '\n');
}

main().catch((err) => {
  process.stderr.write(String((err as any)?.message ?? err) + '\n');
  process.exit(1);
});

