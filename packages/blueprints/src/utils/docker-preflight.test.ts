/**
 * packages/blueprints/src/utils/docker-preflight.test.ts
 */
import { describe, it, expect } from 'vitest';
import { checkDockerDaemon } from './docker-preflight.js';

describe('checkDockerDaemon', () => {
  it('returns ok when docker info succeeds', () => {
    const res = checkDockerDaemon({
      env: {},
      spawnSyncImpl: () => ({ status: 0 }),
    });
    expect(res).toEqual({ ok: true });
  });

  it('returns actionable message when docker info fails', () => {
    const res = checkDockerDaemon({
      env: {},
      spawnSyncImpl: () => ({ status: 1, error: undefined }),
    });
    expect(res.ok).toBe(false);
    expect((res as any).message).toMatch(/Docker daemon/i);
  });

  it('allows skipping preflight via SKIP_DOCKER_PREFLIGHT=1', () => {
    const res = checkDockerDaemon({
      env: { SKIP_DOCKER_PREFLIGHT: '1' },
      spawnSyncImpl: () => ({ status: 1 }),
    });
    expect(res).toEqual({ ok: true });
  });
});

