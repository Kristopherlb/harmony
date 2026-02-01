/**
 * packages/capabilities/src/auth/oauth-provider.capability.ts
 * OAuth 2.0/OIDC Provider Capability (OCS-001 Connector Pattern)
 *
 * Supports authorization_code, client_credentials, refresh_token, and PKCE flows.
 * Manages token lifecycle including refresh handling and scope negotiation.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const grantTypeSchema = z.enum([
    'authorization_code',
    'client_credentials',
    'refresh_token',
]).describe('OAuth 2.0 grant type to use for token acquisition');

const inputSchema = z
    .object({
        grantType: grantTypeSchema,
        tokenUrl: z.string().url().describe('OAuth token endpoint URL'),
        clientId: z.string().describe('OAuth client ID'),
        code: z.string().optional().describe('Authorization code (required for authorization_code grant)'),
        redirectUri: z.string().url().optional().describe('Redirect URI (required for authorization_code grant)'),
        codeVerifier: z.string().optional().describe('PKCE code verifier (optional, for authorization_code with PKCE)'),
        refreshToken: z.string().optional().describe('Refresh token (required for refresh_token grant)'),
        scope: z.string().optional().describe('Space-separated list of scopes to request'),
        audience: z.string().optional().describe('Target API audience (for Auth0-style providers)'),
        extraParams: z.record(z.string()).optional().describe('Additional parameters to include in token request'),
    })
    .describe('OAuth Provider input - token acquisition request');

const outputSchema = z
    .object({
        accessToken: z.string().describe('OAuth access token'),
        tokenType: z.string().describe('Token type (usually "Bearer")'),
        expiresIn: z.number().optional().describe('Token lifetime in seconds'),
        expiresAt: z.string().datetime().optional().describe('Token expiration timestamp (ISO 8601)'),
        refreshToken: z.string().optional().describe('Refresh token for obtaining new access tokens'),
        scope: z.string().optional().describe('Granted scopes (may differ from requested)'),
        idToken: z.string().optional().describe('OIDC ID token (if openid scope was requested)'),
    })
    .describe('OAuth Provider output - token response');

const configSchema = z
    .object({
        timeout: z.number().positive().optional().default(30000).describe('Request timeout in milliseconds'),
        retryOnRateLimit: z.boolean().optional().default(true).describe('Whether to retry on 429 responses'),
    })
    .describe('OAuth Provider configuration');

const secretsSchema = z
    .object({
        clientSecret: z.string().describe('Path to OAuth client secret in secret store'),
    })
    .describe('OAuth Provider secrets - keys only, values resolved at runtime');

export type OAuthProviderInput = z.infer<typeof inputSchema>;
export type OAuthProviderOutput = z.infer<typeof outputSchema>;
export type OAuthProviderConfig = z.infer<typeof configSchema>;
export type OAuthProviderSecrets = z.infer<typeof secretsSchema>;

export const oauthProviderCapability: Capability<
    OAuthProviderInput,
    OAuthProviderOutput,
    OAuthProviderConfig,
    OAuthProviderSecrets
> = {
    metadata: {
        id: 'golden.auth.oauth-provider',
        version: '1.0.0',
        name: 'oauthProvider',
        description:
            'Generic OAuth 2.0/OIDC client supporting authorization_code, client_credentials, and refresh_token flows. Provides token management, refresh handling, and scope negotiation.',
        tags: ['connector', 'auth', 'oauth', 'oidc', 'security'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['auth:oauth'],
        dataClassification: 'CONFIDENTIAL',
        networkAccess: {
            allowOutbound: ['*.auth0.com', '*.okta.com', '*.googleapis.com', 'login.microsoftonline.com', '*'],
        },
    },
    operations: {
        isIdempotent: false, // Token requests are not idempotent
        retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 1, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('invalid_grant')) return 'FATAL';
                if (error.message.includes('invalid_client')) return 'FATAL';
                if (error.message.includes('unauthorized_client')) return 'FATAL';
                if (error.message.includes('rate_limit') || error.message.includes('429')) return 'TRANSIENT';
                if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) return 'TRANSIENT';
            }
            return 'FATAL';
        },
        costFactor: 'LOW',
    },
    aiHints: {
        exampleInput: {
            grantType: 'client_credentials',
            tokenUrl: 'https://oauth.example.com/token',
            clientId: 'my-client-id',
            scope: 'read:data write:data',
        },
        exampleOutput: {
            accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
            tokenType: 'Bearer',
            expiresIn: 3600,
            expiresAt: '2024-01-01T12:00:00Z',
            scope: 'read:data write:data',
        },
        usageNotes:
            'Use client_credentials for service-to-service auth. Use authorization_code for user-delegated access (requires prior redirect flow). Refresh tokens should be stored securely and used before access token expiry.',
    },
    factory: (
        dag,
        context: CapabilityContext<OAuthProviderConfig, OAuthProviderSecrets>,
        input: OAuthProviderInput
    ) => {
        // Dagger client is provided by the worker at runtime
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = { container(): ContainerBuilder };
        const d = dag as unknown as DaggerClient;

        const payload = {
            grantType: input.grantType,
            tokenUrl: input.tokenUrl,
            clientId: input.clientId,
            code: input.code,
            redirectUri: input.redirectUri,
            codeVerifier: input.codeVerifier,
            refreshToken: input.refreshToken,
            scope: input.scope,
            audience: input.audience,
            extraParams: input.extraParams,
            secretRef: context.secretRefs.clientSecret,
        };

        return d
            .container()
            .from('node:20-alpine')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('GRANT_TYPE', input.grantType)
            .withEnvVariable('TOKEN_URL', input.tokenUrl)
            .withEnvVariable('CLIENT_ID', input.clientId)
            .withExec([
                'node',
                '-e',
                `
const https = require('https');
const url = require('url');
const input = JSON.parse(process.env.INPUT_JSON);

const tokenUrl = new url.URL(input.tokenUrl);
const params = new URLSearchParams({
  grant_type: input.grantType,
  client_id: input.clientId,
});

if (input.code) params.set('code', input.code);
if (input.redirectUri) params.set('redirect_uri', input.redirectUri);
if (input.codeVerifier) params.set('code_verifier', input.codeVerifier);
if (input.refreshToken) params.set('refresh_token', input.refreshToken);
if (input.scope) params.set('scope', input.scope);
if (input.audience) params.set('audience', input.audience);
if (input.extraParams) {
  Object.entries(input.extraParams).forEach(([k, v]) => params.set(k, v));
}

// Client secret would be mounted from secret store in production
const clientSecret = process.env.CLIENT_SECRET || '';
if (clientSecret) params.set('client_secret', clientSecret);

const body = params.toString();
const options = {
  hostname: tokenUrl.hostname,
  port: tokenUrl.port || 443,
  path: tokenUrl.pathname + tokenUrl.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(body),
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const result = JSON.parse(data);
    const output = {
      accessToken: result.access_token,
      tokenType: result.token_type || 'Bearer',
      expiresIn: result.expires_in,
      expiresAt: result.expires_in ? new Date(Date.now() + result.expires_in * 1000).toISOString() : undefined,
      refreshToken: result.refresh_token,
      scope: result.scope,
      idToken: result.id_token,
    };
    process.stdout.write(JSON.stringify(output));
  });
});

req.on('error', (e) => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});

req.write(body);
req.end();
        `.trim(),
            ]);
    },
};
