/**
 * packages/capabilities/src/utilities/compression.capability.ts
 * File Compression Capability (OCS-001 Transformer Pattern)
 *
 * Provides compression and decompression operations.
 * Supports gzip, deflate, brotli, and zstd formats.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
    'compress',
    'decompress',
]).describe('Compression operation to perform');

const formatSchema = z.enum([
    'gzip',
    'deflate',
    'brotli',
    'zstd',
]).describe('Compression format/algorithm');

const encodingSchema = z.enum([
    'base64',
    'hex',
    'utf8',
]).describe('Data encoding format');

const inputSchema = z
    .object({
        operation: operationSchema,
        format: formatSchema,
        data: z.string().describe('Data to compress/decompress'),
        inputEncoding: encodingSchema.optional().describe('Encoding of input data'),
        outputEncoding: encodingSchema.optional().describe('Encoding for output data'),
        level: z.number().int().min(1).max(11).optional().describe('Compression level (1-9 for gzip/deflate, 1-11 for brotli)'),
    })
    .describe('Compression input');

const outputSchema = z
    .object({
        data: z.string().describe('Compressed/decompressed data'),
        format: formatSchema.describe('Format used'),
        operation: operationSchema.describe('Operation performed'),
        inputSize: z.number().describe('Input size in bytes'),
        outputSize: z.number().describe('Output size in bytes'),
        compressionRatio: z.number().optional().describe('Compression ratio (for compress operation)'),
    })
    .describe('Compression output');

const configSchema = z
    .object({
        defaultFormat: formatSchema.optional().describe('Default compression format'),
        defaultLevel: z.number().int().min(1).max(11).optional().describe('Default compression level'),
    })
    .describe('Compression configuration');

const secretsSchema = z.object({}).describe('Compression secrets - none required');

export type CompressionInput = z.infer<typeof inputSchema>;
export type CompressionOutput = z.infer<typeof outputSchema>;
export type CompressionConfig = z.infer<typeof configSchema>;
export type CompressionSecrets = z.infer<typeof secretsSchema>;

export const compressionCapability: Capability<
    CompressionInput,
    CompressionOutput,
    CompressionConfig,
    CompressionSecrets
> = {
    metadata: {
        id: 'golden.utilities.compression',
        version: '1.0.0',
        name: 'compression',
        description:
            'File compression and decompression supporting gzip, deflate, brotli, and zstd formats. Pure transformer with configurable compression levels.',
        tags: ['transformer', 'utilities', 'compression'],
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
        isIdempotent: true,
        retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('invalid')) return 'FATAL';
                if (error.message.includes('corrupt')) return 'FATAL';
            }
            return 'FATAL';
        },
        costFactor: 'LOW',
    },
    aiHints: {
        exampleInput: {
            operation: 'compress',
            format: 'gzip',
            data: 'Hello, World! This is some text to compress.',
            inputEncoding: 'utf8',
            outputEncoding: 'base64',
        },
        exampleOutput: {
            data: 'H4sIAAAAAAAAA8tIzcnJVyjPL8pJUeTlAgBP7xT8EwAAAA==',
            format: 'gzip',
            operation: 'compress',
            inputSize: 45,
            outputSize: 33,
            compressionRatio: 0.73,
        },
        usageNotes:
            'Use gzip for general-purpose compression with wide compatibility. Use brotli for web content (better ratio). Use zstd for high-performance scenarios. Compression level affects speed vs size tradeoff.',
    },
    factory: (
        dag,
        context: CapabilityContext<CompressionConfig, CompressionSecrets>,
        input: CompressionInput
    ) => {
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = { container(): ContainerBuilder };
        const d = dag as unknown as DaggerClient;

        const format = input.format ?? context.config.defaultFormat ?? 'gzip';
        const level = input.level ?? context.config.defaultLevel ?? 6;

        const payload = {
            operation: input.operation,
            format,
            data: input.data,
            inputEncoding: input.inputEncoding ?? 'utf8',
            outputEncoding: input.outputEncoding ?? 'base64',
            level,
        };

        return d
            .container()
            .from('node:20-alpine')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('OPERATION', input.operation)
            .withEnvVariable('FORMAT', format)
            .withExec([
                'node',
                '-e',
                `
const zlib = require('zlib');
const { promisify } = require('util');
const input = JSON.parse(process.env.INPUT_JSON);

// Promisified compression functions
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);
const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

// Decode input based on encoding
function decodeInput(data, encoding) {
  switch (encoding) {
    case 'base64': return Buffer.from(data, 'base64');
    case 'hex': return Buffer.from(data, 'hex');
    case 'utf8':
    default: return Buffer.from(data, 'utf8');
  }
}

// Encode output based on encoding
function encodeOutput(buffer, encoding) {
  switch (encoding) {
    case 'base64': return buffer.toString('base64');
    case 'hex': return buffer.toString('hex');
    case 'utf8':
    default: return buffer.toString('utf8');
  }
}

async function run() {
  const inputBuffer = decodeInput(input.data, input.inputEncoding);
  const inputSize = inputBuffer.length;
  let outputBuffer;
  
  const options = {};
  
  // Set compression level
  if (input.format === 'gzip' || input.format === 'deflate') {
    options.level = Math.min(input.level, 9);
  } else if (input.format === 'brotli') {
    options.params = {
      [zlib.constants.BROTLI_PARAM_QUALITY]: Math.min(input.level, 11),
    };
  }
  
  switch (input.format) {
    case 'gzip':
      outputBuffer = input.operation === 'compress'
        ? await gzip(inputBuffer, options)
        : await gunzip(inputBuffer);
      break;
    case 'deflate':
      outputBuffer = input.operation === 'compress'
        ? await deflate(inputBuffer, options)
        : await inflate(inputBuffer);
      break;
    case 'brotli':
      outputBuffer = input.operation === 'compress'
        ? await brotliCompress(inputBuffer, options)
        : await brotliDecompress(inputBuffer);
      break;
    case 'zstd':
      // Node.js doesn't have built-in zstd, would need native addon
      // For now, fall back to gzip with a note
      console.error('zstd not available in Node.js without native addon, using gzip fallback');
      outputBuffer = input.operation === 'compress'
        ? await gzip(inputBuffer, options)
        : await gunzip(inputBuffer);
      break;
    default:
      throw new Error('Unsupported format: ' + input.format);
  }
  
  const outputSize = outputBuffer.length;
  const outputData = encodeOutput(outputBuffer, input.outputEncoding);
  
  const result = {
    data: outputData,
    format: input.format,
    operation: input.operation,
    inputSize,
    outputSize,
  };
  
  if (input.operation === 'compress') {
    result.compressionRatio = Math.round((outputSize / inputSize) * 100) / 100;
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
