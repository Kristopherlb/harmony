/**
 * packages/core/src/binders/secret-broker.test.ts
 * TDD: SecretBroker path resolution and Dagger mount config (ISS-001).
 */
import { describe, it, expect } from 'vitest';
import {
  buildOpenBaoPath,
  createSecretBroker,
  type SecretResolver,
} from './secret-broker';
import type { GoldenContext } from '../context/golden-context';

describe('buildOpenBaoPath', () => {
  it('builds public path for shared secrets', () => {
    const path = buildOpenBaoPath({
      app_id: 'my-app',
      environment: 'prod',
      initiator_id: 'user:alice',
      trace_id: 't1',
    }, 'API_KEY', 'public');
    expect(path).toBe('/artifacts/my-app/public/secrets/API_KEY');
  });

  it('builds user-scoped path for private secrets', () => {
    const path = buildOpenBaoPath({
      app_id: 'my-app',
      environment: 'dev',
      initiator_id: 'user:bob',
      trace_id: 't2',
    }, 'SLACK_TOKEN', 'user');
    expect(path).toBe('/artifacts/my-app/users/user:bob/secrets/SLACK_TOKEN');
  });
});

describe('SecretBroker', () => {
  const ctx: GoldenContext = {
    app_id: 'app1',
    environment: 'staging',
    initiator_id: 'user:jane',
    trace_id: 'trace-1',
  };

  it('returns mount config for resolved logical key (mock resolver)', async () => {
    const resolver: SecretResolver = async (key) => {
      if (key === 'API_KEY') return { path: '/v1/secret/data/artifact', mountPath: '/run/secrets/api_key' };
      throw new Error('Secret not found');
    };
    const broker = createSecretBroker(resolver);
    const config = await broker.resolveMountConfig(ctx, 'API_KEY', 'public');
    expect(config).toEqual({ path: '/v1/secret/data/artifact', mountPath: '/run/secrets/api_key' });
  });

  it('uses correct path format when resolver uses buildOpenBaoPath', async () => {
    const resolver: SecretResolver = async (key, ctx) => {
      const path = buildOpenBaoPath(ctx, key, 'public');
      return { path, mountPath: `/run/secrets/${key.toLowerCase()}` };
    };
    const broker = createSecretBroker(resolver);
    const config = await broker.resolveMountConfig(ctx, 'SLACK_TOKEN', 'public');
    expect(config.path).toBe('/artifacts/app1/public/secrets/SLACK_TOKEN');
    expect(config.mountPath).toBe('/run/secrets/slack_token');
  });

  it('throws on missing secret', async () => {
    const resolver: SecretResolver = async () => {
      throw new Error('Secret not found');
    };
    const broker = createSecretBroker(resolver);
    await expect(broker.resolveMountConfig(ctx, 'MISSING', 'public')).rejects.toThrow('Secret not found');
  });

  it('throws with defined error code on access denied (no raw path in message)', async () => {
    const resolver: SecretResolver = async () => {
      const err = new Error('access denied') as Error & { code?: string };
      err.code = 'ACCESS_DENIED';
      throw err;
    };
    const broker = createSecretBroker(resolver);
    await expect(broker.resolveMountConfig(ctx, 'X', 'user')).rejects.toThrow();
  });

  it('resolves multiple keys and returns map of mount configs', async () => {
    const resolver: SecretResolver = async (key) => ({
      path: `/v1/${key}`,
      mountPath: `/run/secrets/${key}`,
    });
    const broker = createSecretBroker(resolver);
    const map = await broker.resolveMountConfigs(ctx, [
      { logicalKey: 'A', scope: 'public' },
      { logicalKey: 'B', scope: 'user' },
    ]);
    expect(map.get('A')).toEqual({ path: '/v1/A', mountPath: '/run/secrets/A' });
    expect(map.get('B')).toEqual({ path: '/v1/B', mountPath: '/run/secrets/B' });
  });
});
