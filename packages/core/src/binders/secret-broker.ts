/**
 * packages/core/src/binders/secret-broker.ts
 * ISS-001: Resolve logical secret keys to OpenBao paths and Dagger mount config.
 */
import type { GoldenContext } from '../context/golden-context.js';

/** Scope: public (shared) or user (initiator-scoped). */
export type SecretScope = 'public' | 'user';

/** Dagger-ready mount: path (OpenBao/k8s reference) and mountPath in container. */
export interface SecretMountConfig {
  path: string;
  mountPath: string;
}

/** Injectable resolver: logical key + context → mount config. Real OpenBao/ESO wiring is injected. */
export type SecretResolver = (
  logicalKey: string,
  context: GoldenContext,
  scope: SecretScope
) => Promise<SecretMountConfig>;

/**
 * Build OpenBao path per ISS-001: public /artifacts/{appId}/public/secrets/{secretName},
 * user /artifacts/{appId}/users/{userId}/secrets/{secretName}.
 */
export function buildOpenBaoPath(
  ctx: GoldenContext,
  secretName: string,
  scope: SecretScope
): string {
  const base = `/artifacts/${ctx.app_id}`;
  if (scope === 'public') {
    return `${base}/public/secrets/${secretName}`;
  }
  return `${base}/users/${ctx.initiator_id}/secrets/${secretName}`;
}

export interface SecretBroker {
  resolveMountConfig(
    ctx: GoldenContext,
    logicalKey: string,
    scope: SecretScope
  ): Promise<SecretMountConfig>;
  resolveMountConfigs(
    ctx: GoldenContext,
    keys: Array<{ logicalKey: string; scope: SecretScope }>
  ): Promise<Map<string, SecretMountConfig>>;
}

export function createSecretBroker(resolver: SecretResolver): SecretBroker {
  return {
    async resolveMountConfig(ctx, logicalKey, scope) {
      return resolver(logicalKey, ctx, scope);
    },
    async resolveMountConfigs(ctx, keys) {
      const map = new Map<string, SecretMountConfig>();
      await Promise.all(
        keys.map(async ({ logicalKey, scope }) => {
          const config = await resolver(logicalKey, ctx, scope);
          map.set(logicalKey, config);
        })
      );
      return map;
    },
  };
}
