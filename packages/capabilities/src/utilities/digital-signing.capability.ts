/**
 * packages/capabilities/src/utilities/digital-signing.capability.ts
 * Digital Signing Capability (OCS-001 Transformer Pattern)
 *
 * Provides cryptographic signing and verification using RSA, ECDSA, and Ed25519.
 * Supports Sigstore/cosign integration for container signing.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
  'sign',
  'verify',
  'generateKeyPair',
]).describe('Signing operation to perform');

const algorithmSchema = z.enum([
  'RSA-SHA256',
  'RSA-SHA384',
  'RSA-SHA512',
  'ECDSA-SHA256',
  'ECDSA-SHA384',
  'ECDSA-SHA512',
  'Ed25519',
]).describe('Signing algorithm');

const inputSchema = z
  .object({
    operation: operationSchema,
    data: z.string().optional().describe('Data to sign (base64 encoded)'),
    signature: z.string().optional().describe('Signature to verify (base64 encoded)'),
    algorithm: algorithmSchema.describe('Signing algorithm'),
    keySize: z.number().int().positive().optional().describe('Key size for key generation'),
    outputFormat: z.enum(['base64', 'hex', 'raw']).optional().describe('Output format, defaults to base64'),
  })
  .describe('Digital Signing input');

const outputSchema = z
  .object({
    operation: operationSchema.describe('Operation performed'),
    signature: z.string().optional().describe('Generated signature'),
    valid: z.boolean().optional().describe('Signature validity (for verify)'),
    publicKey: z.string().optional().describe('Generated public key'),
    privateKey: z.string().optional().describe('Generated private key'),
    algorithm: algorithmSchema.describe('Algorithm used'),
    keyId: z.string().optional().describe('Key identifier'),
  })
  .describe('Digital Signing output');

const configSchema = z
  .object({
    defaultAlgorithm: algorithmSchema.optional().describe('Default algorithm, defaults to RSA-SHA256'),
    defaultKeySize: z.number().int().positive().optional().describe('Default key size, defaults to 2048'),
  })
  .describe('Digital Signing configuration');

const secretsSchema = z
  .object({
    privateKey: z.string().optional().describe('Private key for signing'),
    publicKey: z.string().optional().describe('Public key for verification'),
    passphrase: z.string().optional().describe('Key passphrase if encrypted'),
  })
  .describe('Digital Signing secrets');

export type DigitalSigningInput = z.infer<typeof inputSchema>;
export type DigitalSigningOutput = z.infer<typeof outputSchema>;
export type DigitalSigningConfig = z.infer<typeof configSchema>;
export type DigitalSigningSecrets = z.infer<typeof secretsSchema>;

export const digitalSigningCapability: Capability<
  DigitalSigningInput,
  DigitalSigningOutput,
  DigitalSigningConfig,
  DigitalSigningSecrets
> = {
  metadata: {
    id: 'golden.utilities.digital-signing',
    version: '1.0.0',
    name: 'digitalSigning',
    description:
      'Cryptographic signing and verification using RSA, ECDSA, and Ed25519. Suitable for artifact signing, code signing, and document integrity.',
    tags: ['transformer', 'utilities', 'security', 'signing', 'crypto'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['crypto:sign'],
    dataClassification: 'CONFIDENTIAL',
    networkAccess: {
      allowOutbound: [], // Pure transformer - no network needed
    },
  },
  operations: {
    isIdempotent: true,
    retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
    errorMap: (error: unknown) => {
      if (error instanceof Error) {
        if (error.message.includes('key')) return 'FATAL';
        if (error.message.includes('invalid')) return 'FATAL';
      }
      return 'FATAL';
    },
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {
      operation: 'sign',
      data: 'SGVsbG8gV29ybGQh',
      algorithm: 'RSA-SHA256',
      outputFormat: 'base64',
    },
    exampleOutput: {
      operation: 'sign',
      signature: 'dGVzdC1zaWduYXR1cmU=',
      algorithm: 'RSA-SHA256',
    },
    usageNotes:
      'Use RSA-SHA256 for compatibility, Ed25519 for performance. Provide private key for signing, public key for verification. Key generation creates ephemeral keys.',
  },
  factory: (
    dag,
    context: CapabilityContext<DigitalSigningConfig, DigitalSigningSecrets>,
    input: DigitalSigningInput
  ) => {
    type ContainerBuilder = {
      from(image: string): ContainerBuilder;
      withEnvVariable(key: string, value: string): ContainerBuilder;
      withExec(args: string[]): unknown;
    };
    type DaggerClient = { container(): ContainerBuilder };
    const d = dag as unknown as DaggerClient;

    const algorithm = input.algorithm ?? context.config.defaultAlgorithm ?? 'RSA-SHA256';
    const keySize = input.keySize ?? context.config.defaultKeySize ?? 2048;

    const payload = {
      operation: input.operation,
      data: input.data,
      signature: input.signature,
      algorithm,
      keySize,
      outputFormat: input.outputFormat ?? 'base64',
      privateKeyRef: context.secretRefs.privateKey,
      publicKeyRef: context.secretRefs.publicKey,
      passphraseRef: context.secretRefs.passphrase,
    };

    return d
      .container()
      .from('node:20-alpine')
      .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
      .withEnvVariable('OPERATION', input.operation)
      .withEnvVariable('ALGORITHM', algorithm)
      .withExec([
        'node',
        '-e',
        `
const crypto = require('crypto');
const fs = require('fs');
const input = JSON.parse(process.env.INPUT_JSON);

// Map algorithm names to Node.js crypto format
function mapAlgorithm(algo) {
  const map = {
    'RSA-SHA256': 'RSA-SHA256',
    'RSA-SHA384': 'RSA-SHA384',
    'RSA-SHA512': 'RSA-SHA512',
    'ECDSA-SHA256': 'sha256',
    'ECDSA-SHA384': 'sha384',
    'ECDSA-SHA512': 'sha512',
    'Ed25519': null, // Ed25519 doesn't use separate hash
  };
  return map[algo] || algo;
}

// Read key from secret ref
function readKey(ref) {
  if (ref && fs.existsSync(ref)) {
    return fs.readFileSync(ref, 'utf8');
  }
  return null;
}

async function run() {
  const result = { operation: input.operation, algorithm: input.algorithm };

  switch (input.operation) {
    case 'sign': {
      const privateKey = readKey(input.privateKeyRef);
      if (!privateKey) {
        throw new Error('Private key required for signing');
      }

      const data = Buffer.from(input.data || '', 'base64');
      let signature;

      if (input.algorithm === 'Ed25519') {
        signature = crypto.sign(null, data, privateKey);
      } else if (input.algorithm.startsWith('ECDSA')) {
        const signer = crypto.createSign(mapAlgorithm(input.algorithm));
        signer.update(data);
        signature = signer.sign(privateKey);
      } else {
        const signer = crypto.createSign(mapAlgorithm(input.algorithm));
        signer.update(data);
        signature = signer.sign(privateKey);
      }

      result.signature = input.outputFormat === 'hex' 
        ? signature.toString('hex')
        : signature.toString('base64');
      break;
    }

    case 'verify': {
      const publicKey = readKey(input.publicKeyRef);
      if (!publicKey) {
        throw new Error('Public key required for verification');
      }

      const data = Buffer.from(input.data || '', 'base64');
      const signature = Buffer.from(input.signature || '', 'base64');

      if (input.algorithm === 'Ed25519') {
        result.valid = crypto.verify(null, data, publicKey, signature);
      } else if (input.algorithm.startsWith('ECDSA')) {
        const verifier = crypto.createVerify(mapAlgorithm(input.algorithm));
        verifier.update(data);
        result.valid = verifier.verify(publicKey, signature);
      } else {
        const verifier = crypto.createVerify(mapAlgorithm(input.algorithm));
        verifier.update(data);
        result.valid = verifier.verify(publicKey, signature);
      }
      break;
    }

    case 'generateKeyPair': {
      let keyPair;

      if (input.algorithm === 'Ed25519') {
        keyPair = crypto.generateKeyPairSync('ed25519', {
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });
      } else if (input.algorithm.startsWith('ECDSA')) {
        const curve = input.algorithm === 'ECDSA-SHA256' ? 'P-256' :
                      input.algorithm === 'ECDSA-SHA384' ? 'P-384' : 'P-521';
        keyPair = crypto.generateKeyPairSync('ec', {
          namedCurve: curve,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });
      } else {
        keyPair = crypto.generateKeyPairSync('rsa', {
          modulusLength: input.keySize,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });
      }

      result.publicKey = keyPair.publicKey;
      result.privateKey = keyPair.privateKey;
      result.keyId = crypto.randomBytes(8).toString('hex');
      break;
    }

    default:
      throw new Error('Unknown operation: ' + input.operation);
  }

  process.stdout.write(JSON.stringify(result));
}

run().catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
        `.trim(),
      ]);
  },
};
