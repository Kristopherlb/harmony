/**
 * packages/capabilities/src/flags/openfeature-provider.capability.ts
 * OpenFeature Provider Capability (OCS-001 Connector Pattern)
 *
 * Vendor-agnostic feature flag evaluation using OpenFeature specification.
 * Supports multiple backends: flagd, LaunchDarkly, Split, etc.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
  'evaluateBoolean',
  'evaluateString',
  'evaluateNumber',
  'evaluateObject',
]).describe('Flag evaluation operation type');

const evaluationContextSchema = z.record(z.unknown()).optional().describe('Evaluation context for targeting');

const inputSchema = z
  .object({
    operation: operationSchema,
    flagKey: z.string().describe('Feature flag key'),
    defaultValue: z.unknown().describe('Default value if flag cannot be evaluated'),
    evaluationContext: evaluationContextSchema.describe('Context for flag targeting (user, session, etc.)'),
  })
  .describe('OpenFeature Provider input');

const evaluationDetailsSchema = z.object({
  flagKey: z.string().describe('Flag key evaluated'),
  value: z.unknown().describe('Resolved flag value'),
  variant: z.string().optional().describe('Variant name if applicable'),
  reason: z.enum([
    'STATIC',
    'DEFAULT',
    'TARGETING_MATCH',
    'SPLIT',
    'CACHED',
    'DISABLED',
    'UNKNOWN',
    'ERROR',
  ]).describe('Reason for the resolved value'),
  errorCode: z.string().optional().describe('Error code if evaluation failed'),
  errorMessage: z.string().optional().describe('Error message if evaluation failed'),
  flagMetadata: z.record(z.unknown()).optional().describe('Provider-specific metadata'),
});

const outputSchema = z
  .object({
    value: z.unknown().describe('Resolved flag value'),
    details: evaluationDetailsSchema.describe('Detailed evaluation result'),
    cached: z.boolean().optional().describe('Whether result was from cache'),
    evaluatedAt: z.string().describe('ISO timestamp of evaluation'),
  })
  .describe('OpenFeature Provider output');

const configSchema = z
  .object({
    provider: z.enum(['flagd', 'launchdarkly', 'split', 'configcat', 'unleash', 'env']).describe('Feature flag provider'),
    providerUrl: z.string().optional().describe('Provider endpoint URL'),
    cacheEnabled: z.boolean().optional().describe('Enable flag caching'),
    cacheTtlSeconds: z.number().int().positive().optional().describe('Cache TTL in seconds'),
  })
  .describe('OpenFeature Provider configuration');

const secretsSchema = z
  .object({
    sdkKey: z.string().optional().describe('Provider SDK key'),
  })
  .describe('OpenFeature Provider secrets');

export type OpenFeatureProviderInput = z.infer<typeof inputSchema>;
export type OpenFeatureProviderOutput = z.infer<typeof outputSchema>;
export type OpenFeatureProviderConfig = z.infer<typeof configSchema>;
export type OpenFeatureProviderSecrets = z.infer<typeof secretsSchema>;

export const openfeatureProviderCapability: Capability<
  OpenFeatureProviderInput,
  OpenFeatureProviderOutput,
  OpenFeatureProviderConfig,
  OpenFeatureProviderSecrets
> = {
  metadata: {
    id: 'golden.flags.openfeature-provider',
    domain: 'flags',
    version: '1.0.0',
    name: 'openFeatureProvider',
    description:
      'Vendor-agnostic feature flag evaluation using OpenFeature specification. Supports flagd, LaunchDarkly, Split, and other providers.',
    tags: ['connector', 'flags', 'feature-flags', 'openfeature'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['flags:read'],
    dataClassification: 'INTERNAL',
    networkAccess: {
      // Known feature flag provider endpoints
      allowOutbound: [
        '*.launchdarkly.com',     // LaunchDarkly
        '*.split.io',             // Split
        '*.configcat.com',        // ConfigCat
        '*.unleash-hosted.com',   // Unleash managed
        'localhost:8013',         // flagd default local
      ],
    },
  },
  operations: {
    isIdempotent: true,
    retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 1, backoffCoefficient: 2 },
    errorMap: (error: unknown) => {
      if (error instanceof Error) {
        if (error.message.includes('connection')) return 'RETRYABLE';
        if (error.message.includes('timeout')) return 'RETRYABLE';
        if (error.message.includes('not found')) return 'FATAL';
      }
      return 'FATAL';
    },
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {
      operation: 'evaluateBoolean',
      flagKey: 'dark-mode-enabled',
      defaultValue: false,
      evaluationContext: {
        targetingKey: 'user-123',
        userId: 'user-123',
        email: 'user@example.com',
      },
    },
    exampleOutput: {
      value: true,
      details: {
        flagKey: 'dark-mode-enabled',
        value: true,
        variant: 'on',
        reason: 'TARGETING_MATCH',
      },
      cached: false,
      evaluatedAt: '2024-01-15T10:30:00Z',
    },
    usageNotes:
      'Use for gradual rollouts, A/B testing, and feature toggles. Provide evaluation context for user targeting. Default values are returned when the flag service is unavailable.',
  },
  factory: (
    dag,
    context: CapabilityContext<OpenFeatureProviderConfig, OpenFeatureProviderSecrets>,
    input: OpenFeatureProviderInput
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

    const payload = {
      operation: input.operation,
      flagKey: input.flagKey,
      defaultValue: input.defaultValue,
      evaluationContext: input.evaluationContext,
      provider: context.config.provider,
      providerUrl: context.config.providerUrl,
      cacheEnabled: context.config.cacheEnabled ?? true,
      cacheTtlSeconds: context.config.cacheTtlSeconds ?? 60,
    };

    // Build container with mounted secrets (ISS-compliant)
    let container = d
      .container()
      .from('node:20-alpine')
      .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
      .withEnvVariable('OPERATION', input.operation as string)
      .withEnvVariable('FLAG_KEY', input.flagKey as string)
      .withEnvVariable('PROVIDER', context.config.provider);

    // Mount SDK key if provided (platform resolves to Dagger Secret)
    if (context.secretRefs.sdkKey && typeof (container as Record<string, unknown>).withMountedSecret === 'function') {
      container = container.withMountedSecret('/run/secrets/sdk_key', context.secretRefs.sdkKey as unknown as DaggerSecret);
    }

    return container.withExec([
      'sh',
      '-c',
      `
npm install --no-save @openfeature/server-sdk @openfeature/flagd-provider 2>/dev/null && node -e '
const { OpenFeature } = require("@openfeature/server-sdk");
const { FlagdProvider } = require("@openfeature/flagd-provider");
const input = JSON.parse(process.env.INPUT_JSON);

async function run() {
  // Configure provider based on config
  let provider;
  switch (input.provider) {
    case "flagd":
      provider = new FlagdProvider({
        host: input.providerUrl ? new URL(input.providerUrl).hostname : "localhost",
        port: input.providerUrl ? parseInt(new URL(input.providerUrl).port) || 8013 : 8013,
      });
      break;
    case "env":
      // Simple environment variable based evaluation
      provider = {
        metadata: { name: "env-provider" },
        resolveBooleanEvaluation: async (flagKey, defaultValue) => {
          const envValue = process.env["FLAG_" + flagKey.toUpperCase().replace(/-/g, "_")];
          return {
            value: envValue === "true" ? true : envValue === "false" ? false : defaultValue,
            reason: envValue ? "STATIC" : "DEFAULT",
          };
        },
        resolveStringEvaluation: async (flagKey, defaultValue) => {
          const envValue = process.env["FLAG_" + flagKey.toUpperCase().replace(/-/g, "_")];
          return { value: envValue || defaultValue, reason: envValue ? "STATIC" : "DEFAULT" };
        },
        resolveNumberEvaluation: async (flagKey, defaultValue) => {
          const envValue = process.env["FLAG_" + flagKey.toUpperCase().replace(/-/g, "_")];
          return { value: envValue ? parseFloat(envValue) : defaultValue, reason: envValue ? "STATIC" : "DEFAULT" };
        },
        resolveObjectEvaluation: async (flagKey, defaultValue) => {
          const envValue = process.env["FLAG_" + flagKey.toUpperCase().replace(/-/g, "_")];
          try {
            return { value: envValue ? JSON.parse(envValue) : defaultValue, reason: envValue ? "STATIC" : "DEFAULT" };
          } catch {
            return { value: defaultValue, reason: "DEFAULT" };
          }
        },
      };
      break;
    default:
      throw new Error("Unsupported provider: " + input.provider);
  }

  await OpenFeature.setProviderAndWait(provider);
  const client = OpenFeature.getClient();

  const context = input.evaluationContext || {};
  let result;

  switch (input.operation) {
    case "evaluateBoolean":
      result = await client.getBooleanDetails(input.flagKey, input.defaultValue, context);
      break;
    case "evaluateString":
      result = await client.getStringDetails(input.flagKey, input.defaultValue, context);
      break;
    case "evaluateNumber":
      result = await client.getNumberDetails(input.flagKey, input.defaultValue, context);
      break;
    case "evaluateObject":
      result = await client.getObjectDetails(input.flagKey, input.defaultValue, context);
      break;
    default:
      throw new Error("Unknown operation: " + input.operation);
  }

  const output = {
    value: result.value,
    details: {
      flagKey: result.flagKey,
      value: result.value,
      variant: result.variant,
      reason: result.reason || "UNKNOWN",
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      flagMetadata: result.flagMetadata,
    },
    cached: false,
    evaluatedAt: new Date().toISOString(),
  };

  process.stdout.write(JSON.stringify(output));
  await OpenFeature.close();
}

run().catch(err => {
  const output = {
    value: JSON.parse(process.env.INPUT_JSON).defaultValue,
    details: {
      flagKey: JSON.parse(process.env.INPUT_JSON).flagKey,
      value: JSON.parse(process.env.INPUT_JSON).defaultValue,
      reason: "ERROR",
      errorCode: "GENERAL",
      errorMessage: err.message,
    },
    cached: false,
    evaluatedAt: new Date().toISOString(),
  };
  process.stdout.write(JSON.stringify(output));
});
'
        `.trim(),
    ]);
  },
};
