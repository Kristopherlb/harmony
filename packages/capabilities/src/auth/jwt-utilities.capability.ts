/**
 * packages/capabilities/src/auth/jwt-utilities.capability.ts
 * JWT Utilities Capability (OCS-001 Transformer Pattern)
 *
 * Provides JWT signing, verification, and decoding operations.
 * Supports HS256, RS256, ES256 algorithms.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const algorithmSchema = z.enum([
  'HS256',
  'HS384',
  'HS512',
  'RS256',
  'RS384',
  'RS512',
  'ES256',
  'ES384',
  'ES512',
  'PS256',
  'PS384',
  'PS512',
]).describe('JWT signing algorithm');

const operationSchema = z.enum([
  'decode',
  'verify',
  'sign',
]).describe('JWT operation to perform');

const inputSchema = z
  .object({
    operation: operationSchema,
    token: z.string().optional().describe('JWT token (required for decode/verify operations)'),
    payload: z.record(z.unknown()).optional().describe('Claims payload (required for sign operation)'),
    algorithm: algorithmSchema.optional().describe('Algorithm for sign/verify (defaults to HS256)'),
    expiresIn: z.number().positive().optional().describe('Token expiration in seconds (for sign operation)'),
    issuer: z.string().optional().describe('Issuer claim for sign/verify'),
    audience: z.union([z.string(), z.array(z.string())]).optional().describe('Audience claim for sign/verify'),
    subject: z.string().optional().describe('Subject claim for sign operation'),
    jwtId: z.string().optional().describe('JWT ID claim for sign operation'),
    notBefore: z.number().optional().describe('Not before timestamp (for sign operation)'),
    clockTolerance: z.number().optional().describe('Clock tolerance in seconds (for verify operation)'),
    ignoreExpiration: z.boolean().optional().describe('Skip expiration check (for verify operation)'),
  })
  .describe('JWT Utilities input');

const outputSchema = z
  .object({
    token: z.string().optional().describe('Signed JWT token (from sign operation)'),
    header: z.record(z.unknown()).optional().describe('Decoded JWT header'),
    payload: z.record(z.unknown()).optional().describe('Decoded JWT payload/claims'),
    signature: z.string().optional().describe('JWT signature (base64url encoded)'),
    isValid: z.boolean().optional().describe('Whether the token passed verification'),
    expiresAt: z.string().datetime().optional().describe('Token expiration timestamp (ISO 8601)'),
    issuedAt: z.string().datetime().optional().describe('Token issued at timestamp (ISO 8601)'),
    error: z.string().optional().describe('Error message if operation failed'),
  })
  .describe('JWT Utilities output');

const configSchema = z
  .object({
    defaultAlgorithm: algorithmSchema.optional().describe('Default signing algorithm'),
    defaultExpiresIn: z.number().positive().optional().describe('Default expiration in seconds'),
  })
  .describe('JWT Utilities configuration');

const secretsSchema = z
  .object({
    signingKey: z.string().optional().describe('Path to signing key in secret store (for HS*/RS*/ES*/PS* algorithms)'),
    publicKey: z.string().optional().describe('Path to public key in secret store (for RS*/ES*/PS* verify)'),
  })
  .describe('JWT Utilities secrets - keys only, values resolved at runtime');

export type JwtUtilitiesInput = z.infer<typeof inputSchema>;
export type JwtUtilitiesOutput = z.infer<typeof outputSchema>;
export type JwtUtilitiesConfig = z.infer<typeof configSchema>;
export type JwtUtilitiesSecrets = z.infer<typeof secretsSchema>;

export const jwtUtilitiesCapability: Capability<
  JwtUtilitiesInput,
  JwtUtilitiesOutput,
  JwtUtilitiesConfig,
  JwtUtilitiesSecrets
> = {
  metadata: {
    id: 'golden.auth.jwt-utilities',
    version: '1.0.0',
    name: 'jwtUtilities',
    description:
      'JWT signing, verification, and decoding. Supports HS256, RS256, ES256, and other standard algorithms. Pure transformer with no external network calls.',
    tags: ['transformer', 'auth', 'jwt', 'crypto', 'security'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['auth:jwt'],
    dataClassification: 'CONFIDENTIAL',
    networkAccess: {
      allowOutbound: [], // Pure transformer - no network access required
    },
  },
  operations: {
    isIdempotent: true, // Same input always produces same output (for decode/verify)
    retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
    errorMap: (error: unknown) => {
      if (error instanceof Error) {
        if (error.message.includes('invalid signature')) return 'FATAL';
        if (error.message.includes('jwt expired')) return 'FATAL';
        if (error.message.includes('jwt malformed')) return 'FATAL';
        if (error.message.includes('invalid algorithm')) return 'FATAL';
      }
      return 'FATAL';
    },
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {
      operation: 'decode',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    },
    exampleOutput: {
      header: { alg: 'HS256', typ: 'JWT' },
      payload: { sub: '1234567890', name: 'John Doe', iat: 1516239022 },
      signature: 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    },
    usageNotes:
      'Use decode for extracting claims without verification. Use verify when you need cryptographic validation. Use sign to create new tokens. For RS*/ES* algorithms, provide the appropriate key via secretRefs.',
  },
  factory: (
    dag,
    context: CapabilityContext<JwtUtilitiesConfig, JwtUtilitiesSecrets>,
    input: JwtUtilitiesInput
  ) => {
    // ISS-compliant types - includes withMountedSecret for secret mounting
    type DaggerSecret = unknown;
    type ContainerBuilder = {
      from(image: string): ContainerBuilder;
      withEnvVariable(key: string, value: string): ContainerBuilder;
      withMountedSecret(path: string, secret: DaggerSecret): ContainerBuilder;
      withExec(args: string[]): unknown;
    };
    type DaggerClient = {
      container(): ContainerBuilder;
      setSecret(name: string, value: string): DaggerSecret;
    };
    const d = dag as unknown as DaggerClient;

    const algorithm = input.algorithm ?? context.config.defaultAlgorithm ?? 'HS256';
    const expiresIn = input.expiresIn ?? context.config.defaultExpiresIn ?? 3600;

    const payload = {
      operation: input.operation,
      token: input.token,
      payload: input.payload,
      algorithm,
      expiresIn,
      issuer: input.issuer,
      audience: input.audience,
      subject: input.subject,
      jwtId: input.jwtId,
      notBefore: input.notBefore,
      clockTolerance: input.clockTolerance,
      ignoreExpiration: input.ignoreExpiration,
      signingKeyRef: context.secretRefs.signingKey,
      publicKeyRef: context.secretRefs.publicKey,
    };

    // Build container with mounted secrets (ISS-compliant)
    let container = d
      .container()
      .from('node:20-alpine')
      .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
      .withEnvVariable('OPERATION', input.operation)
      .withEnvVariable('ALGORITHM', algorithm);

    // Mount secrets if refs are provided (platform resolves these to Dagger Secrets)
    if (context.secretRefs.signingKey && typeof (container as Record<string, unknown>).withMountedSecret === 'function') {
      container = container.withMountedSecret('/run/secrets/signing_key', context.secretRefs.signingKey as unknown as DaggerSecret);
    }
    if (context.secretRefs.publicKey && typeof (container as Record<string, unknown>).withMountedSecret === 'function') {
      container = container.withMountedSecret('/run/secrets/public_key', context.secretRefs.publicKey as unknown as DaggerSecret);
    }

    return container.withExec([
      'sh',
      '-c',
      `
npm install --no-save jsonwebtoken 2>/dev/null && node -e '
const jwt = require("jsonwebtoken");
const input = JSON.parse(process.env.INPUT_JSON);

function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - base64.length % 4) % 4);
  return Buffer.from(base64 + padding, "base64").toString("utf-8");
}

function decodeWithoutVerify(token) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("jwt malformed");
  return {
    header: JSON.parse(base64UrlDecode(parts[0])),
    payload: JSON.parse(base64UrlDecode(parts[1])),
    signature: parts[2],
  };
}

async function run() {
  const fs = require("fs");
  
  // ISS-compliant: Read secrets from mounted paths only
  const SIGNING_KEY_PATH = "/run/secrets/signing_key";
  const PUBLIC_KEY_PATH = "/run/secrets/public_key";
  
  let signingKey = null;
  if (fs.existsSync(SIGNING_KEY_PATH)) {
    signingKey = fs.readFileSync(SIGNING_KEY_PATH, "utf8").trim();
  }
  
  let publicKey = null;
  if (fs.existsSync(PUBLIC_KEY_PATH)) {
    publicKey = fs.readFileSync(PUBLIC_KEY_PATH, "utf8").trim();
  } else {
    publicKey = signingKey; // For symmetric algorithms
  }
  
  let result = {};
  
  switch (input.operation) {
    case "decode": {
      const decoded = decodeWithoutVerify(input.token);
      result = {
        header: decoded.header,
        payload: decoded.payload,
        signature: decoded.signature,
      };
      if (decoded.payload.exp) {
        result.expiresAt = new Date(decoded.payload.exp * 1000).toISOString();
      }
      if (decoded.payload.iat) {
        result.issuedAt = new Date(decoded.payload.iat * 1000).toISOString();
      }
      break;
    }
    
    case "verify": {
      try {
        const options = {
          algorithms: [input.algorithm],
          clockTolerance: input.clockTolerance || 0,
          ignoreExpiration: input.ignoreExpiration || false,
        };
        if (input.issuer) options.issuer = input.issuer;
        if (input.audience) options.audience = input.audience;
        
        const decoded = jwt.verify(input.token, publicKey, options);
        const parts = input.token.split(".");
        result = {
          isValid: true,
          header: JSON.parse(base64UrlDecode(parts[0])),
          payload: decoded,
          signature: parts[2],
        };
        if (decoded.exp) {
          result.expiresAt = new Date(decoded.exp * 1000).toISOString();
        }
        if (decoded.iat) {
          result.issuedAt = new Date(decoded.iat * 1000).toISOString();
        }
      } catch (err) {
        result = { isValid: false, error: err.message };
      }
      break;
    }
    
    case "sign": {
      const options = { algorithm: input.algorithm };
      if (input.expiresIn) options.expiresIn = input.expiresIn;
      if (input.issuer) options.issuer = input.issuer;
      if (input.audience) options.audience = input.audience;
      if (input.subject) options.subject = input.subject;
      if (input.jwtId) options.jwtId = input.jwtId;
      if (input.notBefore) options.notBefore = input.notBefore;
      
      const token = jwt.sign(input.payload, signingKey, options);
      const decoded = decodeWithoutVerify(token);
      result = {
        token,
        header: decoded.header,
        payload: decoded.payload,
        expiresAt: decoded.payload.exp ? new Date(decoded.payload.exp * 1000).toISOString() : undefined,
        issuedAt: decoded.payload.iat ? new Date(decoded.payload.iat * 1000).toISOString() : undefined,
      };
      break;
    }
  }
  
  process.stdout.write(JSON.stringify(result));
}

run().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
'
        `.trim(),
    ]);
  },
};
