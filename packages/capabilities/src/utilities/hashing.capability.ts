/**
 * packages/capabilities/src/utilities/hashing.capability.ts
 * Cryptographic Hashing Capability (OCS-001 Transformer Pattern)
 *
 * Provides cryptographic hash generation for data integrity verification.
 * Supports MD5, SHA-1, SHA-256, SHA-512, SHA-3, BLAKE2 algorithms.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const algorithmSchema = z.enum([
    'md5',
    'sha1',
    'sha256',
    'sha384',
    'sha512',
    'sha3-256',
    'sha3-384',
    'sha3-512',
    'blake2b512',
    'blake2s256',
]).describe('Cryptographic hash algorithm');

const encodingSchema = z.enum([
    'hex',
    'base64',
    'base64url',
]).describe('Output encoding format');

const inputEncodingSchema = z.enum([
    'utf8',
    'base64',
    'hex',
    'binary',
]).describe('Input data encoding');

const inputSchema = z
    .object({
        algorithm: algorithmSchema,
        data: z.string().describe('Data to hash (string or encoded bytes)'),
        inputEncoding: inputEncodingSchema.optional().default('utf8').describe('Encoding of input data'),
        outputEncoding: encodingSchema.optional().default('hex').describe('Encoding for output hash'),
        hmacKey: z.string().optional().describe('Key for HMAC (if provided, generates HMAC instead of plain hash)'),
    })
    .describe('Hashing input');

const outputSchema = z
    .object({
        hash: z.string().describe('Computed hash value'),
        algorithm: algorithmSchema.describe('Algorithm used'),
        encoding: encodingSchema.describe('Output encoding used'),
        byteLength: z.number().describe('Hash length in bytes'),
        isHmac: z.boolean().describe('Whether result is HMAC'),
    })
    .describe('Hashing output');

const configSchema = z
    .object({
        defaultAlgorithm: algorithmSchema.optional().default('sha256').describe('Default hash algorithm'),
        defaultOutputEncoding: encodingSchema.optional().default('hex').describe('Default output encoding'),
    })
    .describe('Hashing configuration');

const secretsSchema = z
    .object({
        hmacKey: z.string().optional().describe('Path to HMAC key in secret store'),
    })
    .describe('Hashing secrets - keys only');

export type HashingInput = z.infer<typeof inputSchema>;
export type HashingOutput = z.infer<typeof outputSchema>;
export type HashingConfig = z.infer<typeof configSchema>;
export type HashingSecrets = z.infer<typeof secretsSchema>;

export const hashingCapability: Capability<
    HashingInput,
    HashingOutput,
    HashingConfig,
    HashingSecrets
> = {
    metadata: {
        id: 'golden.utilities.hashing',
        version: '1.0.0',
        name: 'hashing',
        description:
            'Cryptographic hashing with multiple algorithm support. Generates MD5, SHA-1, SHA-256, SHA-512, SHA-3, and BLAKE2 hashes. Supports HMAC when key is provided.',
        tags: ['transformer', 'crypto', 'security', 'utilities'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: [],
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: [], // Pure transformer - no network access
        },
    },
    operations: {
        isIdempotent: true, // Same input always produces same hash
        retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('unsupported')) return 'FATAL';
                if (error.message.includes('invalid')) return 'FATAL';
            }
            return 'FATAL';
        },
        costFactor: 'LOW',
    },
    aiHints: {
        exampleInput: {
            algorithm: 'sha256',
            data: 'Hello, World!',
            outputEncoding: 'hex',
        },
        exampleOutput: {
            hash: 'dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f',
            algorithm: 'sha256',
            encoding: 'hex',
            byteLength: 32,
            isHmac: false,
        },
        usageNotes:
            'Use SHA-256 or SHA-3 for security-sensitive applications. MD5 and SHA-1 are provided for legacy compatibility but should not be used for security purposes. BLAKE2 offers high performance with strong security.',
    },
    factory: (
        dag,
        context: CapabilityContext<HashingConfig, HashingSecrets>,
        input: HashingInput
    ) => {
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = { container(): ContainerBuilder };
        const d = dag as unknown as DaggerClient;

        const algorithm = input.algorithm ?? context.config.defaultAlgorithm ?? 'sha256';
        const outputEncoding = input.outputEncoding ?? context.config.defaultOutputEncoding ?? 'hex';
        const inputEncoding = input.inputEncoding ?? 'utf8';

        const payload = {
            algorithm,
            data: input.data,
            inputEncoding,
            outputEncoding,
            hmacKey: input.hmacKey,
            hmacKeyRef: context.secretRefs.hmacKey,
        };

        return d
            .container()
            .from('node:20-alpine')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('ALGORITHM', algorithm)
            .withEnvVariable('OUTPUT_ENCODING', outputEncoding)
            .withExec([
                'node',
                '-e',
                `
const crypto = require('crypto');
const input = JSON.parse(process.env.INPUT_JSON);

// Map algorithm names to Node.js crypto names
const algorithmMap = {
  'md5': 'md5',
  'sha1': 'sha1',
  'sha256': 'sha256',
  'sha384': 'sha384',
  'sha512': 'sha512',
  'sha3-256': 'sha3-256',
  'sha3-384': 'sha3-384',
  'sha3-512': 'sha3-512',
  'blake2b512': 'blake2b512',
  'blake2s256': 'blake2s256',
};

const nodeAlgo = algorithmMap[input.algorithm];
if (!nodeAlgo) {
  console.error(JSON.stringify({ error: 'Unsupported algorithm: ' + input.algorithm }));
  process.exit(1);
}

// Decode input data according to specified encoding
let dataBuffer;
switch (input.inputEncoding) {
  case 'base64':
    dataBuffer = Buffer.from(input.data, 'base64');
    break;
  case 'hex':
    dataBuffer = Buffer.from(input.data, 'hex');
    break;
  case 'binary':
    dataBuffer = Buffer.from(input.data, 'binary');
    break;
  case 'utf8':
  default:
    dataBuffer = Buffer.from(input.data, 'utf8');
}

// Get HMAC key if provided (from env or input)
const hmacKey = process.env.HMAC_KEY || input.hmacKey;

let hash;
let isHmac = false;

if (hmacKey) {
  // Generate HMAC
  isHmac = true;
  const hmac = crypto.createHmac(nodeAlgo, hmacKey);
  hmac.update(dataBuffer);
  hash = hmac.digest(input.outputEncoding);
} else {
  // Generate plain hash
  const hasher = crypto.createHash(nodeAlgo);
  hasher.update(dataBuffer);
  hash = hasher.digest(input.outputEncoding);
}

// Calculate byte length based on algorithm
const byteLengths = {
  'md5': 16,
  'sha1': 20,
  'sha256': 32,
  'sha384': 48,
  'sha512': 64,
  'sha3-256': 32,
  'sha3-384': 48,
  'sha3-512': 64,
  'blake2b512': 64,
  'blake2s256': 32,
};

const result = {
  hash,
  algorithm: input.algorithm,
  encoding: input.outputEncoding,
  byteLength: byteLengths[input.algorithm] || 32,
  isHmac,
};

process.stdout.write(JSON.stringify(result));
        `.trim(),
            ]);
    },
};
