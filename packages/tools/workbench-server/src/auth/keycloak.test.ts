/**
 * packages/tools/workbench-server/src/auth/keycloak.test.ts
 */
import { describe, it, expect } from 'vitest';
import type { JWTPayload } from 'jose';
import { extractKeycloakRoles } from './keycloak.js';

describe('extractKeycloakRoles', () => {
  it('extracts roles from realm_access and resource_access', () => {
    const roles = extractKeycloakRoles({
      sub: 'abc',
      realm_access: { roles: ['r1', 'r2'] },
      resource_access: {
        app: { roles: ['r3'] },
      },
    } as unknown as JWTPayload);
    expect(roles).toEqual(['r1', 'r2', 'r3']);
  });
});
