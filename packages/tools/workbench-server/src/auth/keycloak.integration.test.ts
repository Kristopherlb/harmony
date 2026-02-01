/**
 * packages/tools/workbench-server/src/auth/keycloak.integration.test.ts
 * Integration-ish: verify JWT with a real JWKS endpoint (no Keycloak required).
 */
import { describe, it, expect } from 'vitest';
import http from 'node:http';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { createKeycloakAuthenticator } from './keycloak.js';

describe('createKeycloakAuthenticator', () => {
  it('verifies a JWT against remote JWKS and extracts roles', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'k1';
    jwk.use = 'sig';
    jwk.alg = 'RS256';

    const server = http.createServer((req, res) => {
      if (req.url?.endsWith('/protocol/openid-connect/certs')) {
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json');
        return res.end(JSON.stringify({ keys: [jwk] }));
      }
      res.statusCode = 404;
      res.end();
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('failed to bind test server');
    const issuer = `http://127.0.0.1:${addr.port}/realms/test`;

    try {
      const token = await new SignJWT({
        realm_access: { roles: ['provider:github', 'workbench:graphql:query'] },
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setIssuer(issuer)
        .setAudience('aud')
        .setSubject('abc')
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);

      const auth = createKeycloakAuthenticator({ issuer, audience: 'aud', environment: 'local' });
      const principal = await auth(`Bearer ${token}`);
      expect(principal).toBeTruthy();
      expect(principal?.initiatorId).toBe('user:abc');
      expect(principal?.roles).toContain('provider:github');
    } finally {
      await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    }
  });
});

