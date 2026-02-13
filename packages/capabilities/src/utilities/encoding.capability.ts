/**
 * packages/capabilities/src/utilities/encoding.capability.ts
 * Encoding Utilities Capability (OCS-001 Transformer Pattern)
 *
 * Provides encoding/decoding operations: Base64, hex, URL encoding, HTML entities.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
    'base64Encode',
    'base64Decode',
    'hexEncode',
    'hexDecode',
    'urlEncode',
    'urlDecode',
    'htmlEncode',
    'htmlDecode',
]).describe('Encoding operation to perform');

const inputSchema = z
    .object({
        operation: operationSchema,
        data: z.string().describe('Data to encode or decode'),
        urlSafe: z.boolean().optional().describe('Use URL-safe Base64 variant'),
    })
    .describe('Encoding input');

const outputSchema = z
    .object({
        result: z.string().describe('Encoded or decoded result'),
        operation: operationSchema.describe('Operation that was performed'),
        inputLength: z.number().describe('Length of input data'),
        outputLength: z.number().describe('Length of output data'),
    })
    .describe('Encoding output');

const configSchema = z
    .object({
        defaultUrlSafe: z.boolean().optional().describe('Default to URL-safe Base64'),
    })
    .describe('Encoding configuration');

const secretsSchema = z
    .object({})
    .describe('Encoding secrets - none required');

export type EncodingInput = z.infer<typeof inputSchema>;
export type EncodingOutput = z.infer<typeof outputSchema>;
export type EncodingConfig = z.infer<typeof configSchema>;
export type EncodingSecrets = z.infer<typeof secretsSchema>;

export const encodingCapability: Capability<
    EncodingInput,
    EncodingOutput,
    EncodingConfig,
    EncodingSecrets
> = {
    metadata: {
        id: 'golden.utilities.encoding',
        domain: 'utilities',
        version: '1.0.0',
        name: 'encoding',
        description:
            'Encoding and decoding utilities supporting Base64, hex, URL encoding, and HTML entities. Pure transformer with no side effects.',
        tags: ['transformer', 'utilities', 'encoding', 'base64', 'hex', 'url'],
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
        dataClassification: 'PUBLIC',
        networkAccess: {
            allowOutbound: [], // Pure transformer, no network needed
        },
    },
    operations: {
        isIdempotent: true,
        retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 0, backoffCoefficient: 1 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('Invalid')) return 'FATAL';
                if (error.message.includes('malformed')) return 'FATAL';
            }
            return 'FATAL';
        },
        costFactor: 'LOW',
    },
    aiHints: {
        exampleInput: {
            operation: 'base64Encode',
            data: 'Hello, World!',
        },
        exampleOutput: {
            result: 'SGVsbG8sIFdvcmxkIQ==',
            operation: 'base64Encode',
            inputLength: 13,
            outputLength: 20,
        },
        usageNotes:
            'Use base64Encode/Decode for binary data. Use urlEncode for query parameters. Use htmlEncode for user input in HTML. URL-safe Base64 replaces +/ with -_.',
    },
    factory: (
        dag,
        context: CapabilityContext<EncodingConfig, EncodingSecrets>,
        input: EncodingInput
    ) => {
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = { container(): ContainerBuilder };
        const d = dag as unknown as DaggerClient;

        const urlSafe = input.urlSafe ?? context.config.defaultUrlSafe ?? false;

        const payload = {
            operation: input.operation,
            data: input.data,
            urlSafe,
        };

        return d
            .container()
            .from('node:20-alpine')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('OPERATION', input.operation)
            .withExec([
                'node',
                '-e',
                `
const input = JSON.parse(process.env.INPUT_JSON);

function base64Encode(data, urlSafe) {
  let encoded = Buffer.from(data, 'utf8').toString('base64');
  if (urlSafe) {
    encoded = encoded.replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=/g, '');
  }
  return encoded;
}

function base64Decode(data, urlSafe) {
  let normalized = data;
  if (urlSafe) {
    normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4;
    if (padding) normalized += '='.repeat(4 - padding);
  }
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function hexEncode(data) {
  return Buffer.from(data, 'utf8').toString('hex');
}

function hexDecode(data) {
  return Buffer.from(data, 'hex').toString('utf8');
}

function urlEncode(data) {
  return encodeURIComponent(data);
}

function urlDecode(data) {
  return decodeURIComponent(data);
}

function htmlEncode(data) {
  return data
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function htmlDecode(data) {
  return data
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

let result;
switch (input.operation) {
  case 'base64Encode': result = base64Encode(input.data, input.urlSafe); break;
  case 'base64Decode': result = base64Decode(input.data, input.urlSafe); break;
  case 'hexEncode': result = hexEncode(input.data); break;
  case 'hexDecode': result = hexDecode(input.data); break;
  case 'urlEncode': result = urlEncode(input.data); break;
  case 'urlDecode': result = urlDecode(input.data); break;
  case 'htmlEncode': result = htmlEncode(input.data); break;
  case 'htmlDecode': result = htmlDecode(input.data); break;
  default: throw new Error('Unknown operation: ' + input.operation);
}

const output = {
  result,
  operation: input.operation,
  inputLength: input.data.length,
  outputLength: result.length,
};

process.stdout.write(JSON.stringify(output));
        `.trim(),
            ]);
    },
};
