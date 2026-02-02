/**
 * CLI Wrapper Capability Template
 * 
 * Copy this file and replace placeholders to create a new CLI wrapper capability.
 * 
 * Placeholders:
 *   - TOOL_NAME: e.g., "trestle", "c2p", "syft"
 *   - TOOL_IMAGE: e.g., "ghcr.io/oscal-compass/trestle:1.0.0"
 *   - TOOL_COMMAND: e.g., "trestle", "c2p-cli"
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

// =============================================================================
// SCHEMAS
// =============================================================================

const operationSchema = z.enum([
    'operation1',    // TODO: Replace with actual operations
    'operation2',
    'operation3',
]).describe('TOOL_NAME operation');

const inputSchema = z
    .object({
        operation: operationSchema,
        target: z.string().optional().describe('Target file or directory'),
        // TODO: Add operation-specific inputs
    })
    .describe('TOOL_NAME input');

const outputSchema = z
    .object({
        success: z.boolean().describe('Whether the operation succeeded'),
        operation: operationSchema.describe('Operation performed'),
        // TODO: Add operation-specific outputs
        message: z.string().describe('Human-readable result message'),
        durationMs: z.number().optional().describe('Execution time in milliseconds'),
    })
    .describe('TOOL_NAME output');

const configSchema = z
    .object({
        imageVersion: z.string().optional().describe('Override default image version'),
        // TODO: Add configuration options
    })
    .describe('TOOL_NAME configuration');

const secretsSchema = z
    .object({
        apiKey: z.string().optional().describe('API key for TOOL_NAME service'),
        // TODO: Add required secrets
    })
    .describe('TOOL_NAME secrets');

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type ToolNameInput = z.infer<typeof inputSchema>;
export type ToolNameOutput = z.infer<typeof outputSchema>;
export type ToolNameConfig = z.infer<typeof configSchema>;
export type ToolNameSecrets = z.infer<typeof secretsSchema>;

// =============================================================================
// CAPABILITY DEFINITION
// =============================================================================

export const toolNameCapability: Capability<
    ToolNameInput,
    ToolNameOutput,
    ToolNameConfig,
    ToolNameSecrets
> = {
    metadata: {
        id: 'golden.category.tool-name',  // TODO: Set correct ID
        version: '1.0.0',
        name: 'tool-name',
        description: 'Brief description of what this capability does.',
        tags: ['category', 'tool-name'],  // TODO: Set appropriate tags
        maintainer: 'platform',
    },

    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },

    security: {
        requiredScopes: ['category:operation'],  // TODO: Set correct scopes
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: [
                // TODO: Add required network destinations
            ],
        },
        oscalControlIds: [],  // TODO: Map to relevant OSCAL controls
    },

    operations: {
        isIdempotent: true,
        retryPolicy: {
            maxAttempts: 2,
            initialIntervalSeconds: 5,
            backoffCoefficient: 2
        },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('timeout')) return 'RETRYABLE';
                if (error.message.includes('rate limit')) return 'RETRYABLE';
                if (error.message.includes('not found')) return 'FATAL';
            }
            return 'FATAL';
        },
        costFactor: 'LOW',  // LOW, MEDIUM, HIGH
    },

    aiHints: {
        exampleInput: {
            operation: 'operation1',
            target: '/path/to/target',
        },
        exampleOutput: {
            success: true,
            operation: 'operation1',
            message: 'Operation completed successfully',
            durationMs: 1500,
        },
        usageNotes: 'Brief notes on when and how to use this capability.',
    },

    factory: (
        dag,
        context: CapabilityContext<ToolNameConfig, ToolNameSecrets>,
        input: ToolNameInput
    ) => {
        // Type definitions for Dagger client
        type DaggerSecret = unknown;
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withMountedSecret(path: string, secret: DaggerSecret): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = {
            container(): ContainerBuilder;
        };
        const d = dag as unknown as DaggerClient;

        // Determine image version
        const version = context.config.imageVersion ?? '1.0.0';  // TODO: Set default version

        // Build container
        let container = d
            .container()
            .from(`TOOL_IMAGE:${version}`)  // TODO: Replace with actual image
            .withEnvVariable('INPUT_JSON', JSON.stringify(input))
            .withEnvVariable('OPERATION', input.operation);

        // Mount secrets securely
        if (context.secretRefs.apiKey) {
            container = container.withMountedSecret(
                '/run/secrets/api_key',
                context.secretRefs.apiKey as unknown as DaggerSecret
            );
        }

        // Execute command
        return container.withExec([
            'sh',
            '-c',
            `
#!/bin/sh
set -e

OPERATION="${input.operation}"
TARGET="${input.target ?? '.'}"
START_TIME=$(date +%s%3N)

# Load secrets from mounted files
if [ -f /run/secrets/api_key ]; then
  export API_KEY=$(cat /run/secrets/api_key)
fi

SUCCESS=true
MESSAGE=""

case "$OPERATION" in
  operation1)
    # TODO: Implement operation1
    OUTPUT=$(TOOL_COMMAND operation1 "$TARGET" 2>&1) || SUCCESS=false
    MESSAGE="Operation1 completed"
    ;;
    
  operation2)
    # TODO: Implement operation2
    OUTPUT=$(TOOL_COMMAND operation2 "$TARGET" 2>&1) || SUCCESS=false
    MESSAGE="Operation2 completed"
    ;;
    
  *)
    SUCCESS=false
    MESSAGE="Unknown operation: $OPERATION"
    ;;
esac

END_TIME=$(date +%s%3N)
DURATION=$((END_TIME - START_TIME))

cat <<EOF
{
  "success": $SUCCESS,
  "operation": "$OPERATION",
  "message": "$MESSAGE",
  "durationMs": $DURATION
}
EOF
      `.trim(),
        ]);
    },
};
