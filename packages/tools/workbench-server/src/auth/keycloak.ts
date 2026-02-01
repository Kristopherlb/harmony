/**
 * packages/tools/workbench-server/src/auth/keycloak.ts
 * Keycloak/OIDC JWT verification using JWKS (jose).
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export interface Principal {
  initiatorId: string;
  roles: string[];
  environment: string;
}

export interface KeycloakAuthOptions {
  issuer: string;
  audience: string;
  environment: string;
  /**
   * Allowlisted JWT signature algorithms (default: RS256).
   * Prefer leaving this strict (Keycloak defaults to RS256).
   */
  algorithms?: string[];
  jwksTimeoutDuration?: number;
  jwksCooldownDuration?: number;
  jwksCacheMaxAge?: number | typeof Infinity;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function extractKeycloakRoles(payload: JWTPayload): string[] {
  const roles = new Set<string>();

  const p = payload as unknown as Record<string, unknown>;

  const realmAccess = p['realm_access'];
  if (isRecord(realmAccess)) {
    const realmRoles = realmAccess['roles'];
    if (Array.isArray(realmRoles)) {
      for (const r of realmRoles) if (typeof r === 'string') roles.add(r);
    }
  }

  const resourceAccess = p['resource_access'];
  if (isRecord(resourceAccess)) {
    for (const resource of Object.values(resourceAccess)) {
      if (!isRecord(resource)) continue;
      const rr = resource['roles'];
      if (!Array.isArray(rr)) continue;
      for (const r of rr) if (typeof r === 'string') roles.add(r);
    }
  }

  return Array.from(roles).sort();
}

export function createKeycloakAuthenticator(options: KeycloakAuthOptions) {
  const jwksUrl = new URL('./protocol/openid-connect/certs', options.issuer);
  const jwks = createRemoteJWKSet(jwksUrl, {
    timeoutDuration: options.jwksTimeoutDuration ?? 5000,
    cooldownDuration: options.jwksCooldownDuration ?? 30_000,
    cacheMaxAge: options.jwksCacheMaxAge ?? 600_000,
  });

  return async function authenticate(authHeader: string | undefined): Promise<Principal | undefined> {
    if (!authHeader) return undefined;
    const m = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!m) return undefined;
    const token = m[1]!.trim();
    if (!token) return undefined;

    const verified = await jwtVerify(token, jwks, {
      issuer: options.issuer,
      audience: options.audience,
      algorithms: options.algorithms ?? ['RS256'],
    });

    const sub = verified.payload.sub;
    if (typeof sub !== 'string' || sub.length === 0) return undefined;

    return {
      initiatorId: `user:${sub}`,
      roles: extractKeycloakRoles(verified.payload),
      environment: options.environment,
    };
  };
}
