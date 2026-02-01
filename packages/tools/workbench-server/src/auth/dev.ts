/**
 * packages/tools/workbench-server/src/auth/dev.ts
 * Dev-only authentication helper for local exploration.
 *
 * IMPORTANT: This must never be enabled in production deployments.
 */
import type http from 'node:http';
import type { Principal } from './keycloak.js';

export interface DevAuthConfig {
  enabled: boolean;
  environment: string;
  defaultUser: string;
  defaultRoles: string[];
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function readDevAuthConfigFromEnv(env: Record<string, string | undefined>): DevAuthConfig {
  const enabled = (env.WORKBENCH_DEV_AUTH ?? '').trim().toLowerCase() === 'true';
  const environment = (env.WORKBENCH_ENVIRONMENT ?? env.MCP_ENVIRONMENT ?? 'local').trim() || 'local';
  const defaultUser = (env.WORKBENCH_DEV_USER ?? 'user:dev').trim() || 'user:dev';
  const defaultRoles = parseCsv(env.WORKBENCH_DEV_ROLES ?? 'provider:github,workbench:launch,workbench:graphql:query,workbench:rest:read');
  return { enabled, environment, defaultUser, defaultRoles };
}

export function authenticateDev(req: http.IncomingMessage, cfg: DevAuthConfig): Principal | undefined {
  if (!cfg.enabled) return undefined;

  // Allow override via request headers for local testing. These are ignored unless dev mode enabled.
  const hUser = typeof req.headers['x-dev-user'] === 'string' ? req.headers['x-dev-user'].trim() : '';
  const hRoles = typeof req.headers['x-dev-roles'] === 'string' ? req.headers['x-dev-roles'].trim() : '';

  const initiatorId = hUser || cfg.defaultUser;
  const roles = (hRoles ? parseCsv(hRoles) : cfg.defaultRoles).slice().sort();

  return { initiatorId, roles, environment: cfg.environment };
}

