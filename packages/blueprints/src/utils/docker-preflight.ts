/**
 * packages/blueprints/src/utils/docker-preflight.ts
 *
 * Purpose: Best-effort preflight check for local runtime smoke harnesses that
 * depend on the Docker daemon (OpenBao via docker compose, Dagger engine).
 */
import type { SpawnSyncReturns } from 'node:child_process';

export function checkDockerDaemon(input: {
  env: Record<string, string | undefined>;
  spawnSyncImpl: (
    cmd: string,
    args: string[],
    options: { stdio: 'ignore' | 'pipe' }
  ) => Pick<SpawnSyncReturns<Buffer>, 'status' | 'error'>;
}): { ok: true } | { ok: false; message: string } {
  if ((input.env.SKIP_DOCKER_PREFLIGHT ?? '').trim() === '1') return { ok: true };

  const r = input.spawnSyncImpl('docker', ['info'], { stdio: 'ignore' });
  if (r.status === 0) return { ok: true };

  return {
    ok: false,
    message:
      'Docker daemon is not reachable. Start Docker Desktop (or your Docker daemon) and retry, or set SKIP_DOCKER_PREFLIGHT=1 to bypass this check.',
  };
}

