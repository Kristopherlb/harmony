/**
 * packages/capabilities/src/operations/runme-runner.capability.ts
 * Runme Runner Capability (OCS-001 Commander Pattern)
 *
 * Executes markdown runbooks using the Runme CLI for operational automation.
 * Supports running specific cells or entire notebooks with environment control.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const sourceTypeSchema = z.enum(['file', 'raw']).describe('Source type: file path or raw markdown content');

const inputSchema = z
    .object({
        source: z.string().min(1).describe('File path to runbook or raw markdown content'),
        sourceType: sourceTypeSchema.describe('Whether source is a file path or raw markdown'),
        cells: z.array(z.string()).optional().describe('Specific cell IDs or names to run (runs all if omitted)'),
        env: z.record(z.string()).optional().describe('Additional environment variables for execution'),
        timeout: z.string().optional().describe('Per-cell timeout (e.g., "5m", "30s"). Default: 5m'),
        workdir: z.string().optional().describe('Working directory for execution'),
    })
    .describe('Runme Runner input for executing markdown runbooks');

const cellResultSchema = z.object({
    id: z.string().describe('Cell identifier'),
    name: z.string().optional().describe('Cell name if specified'),
    exitCode: z.number().int().describe('Cell execution exit code'),
    stdout: z.string().describe('Standard output from cell'),
    stderr: z.string().describe('Standard error from cell'),
    durationMs: z.number().describe('Cell execution duration in milliseconds'),
});

const outputSchema = z
    .object({
        cells: z.array(cellResultSchema).describe('Results for each executed cell'),
        success: z.boolean().describe('True if all cells exited with code 0'),
        totalDurationMs: z.number().describe('Total execution duration in milliseconds'),
        runbookPath: z.string().optional().describe('Path to the executed runbook'),
        message: z.string().describe('Human-readable result summary'),
    })
    .describe('Runme Runner output with cell execution results');

const configSchema = z
    .object({
        defaultTimeout: z.string().optional().describe('Default timeout for cells (default: 5m)'),
        runmeVersion: z.string().optional().describe('Runme CLI version (default: latest)'),
        allowNetworkAccess: z.boolean().optional().describe('Allow runbook to access network (default: true)'),
    })
    .describe('Runme Runner configuration');

const secretsSchema = z
    .object({
        // Runbooks may need secrets injected as env vars
        envSecrets: z.record(z.string()).optional().describe('Secrets to inject as environment variables'),
    })
    .describe('Runme Runner secrets');

export type RunmeRunnerInput = z.infer<typeof inputSchema>;
export type RunmeRunnerOutput = z.infer<typeof outputSchema>;
export type RunmeRunnerConfig = z.infer<typeof configSchema>;
export type RunmeRunnerSecrets = z.infer<typeof secretsSchema>;

export const runmeRunnerCapability: Capability<
    RunmeRunnerInput,
    RunmeRunnerOutput,
    RunmeRunnerConfig,
    RunmeRunnerSecrets
> = {
    metadata: {
        id: 'golden.operations.runme-runner',
        domain: 'operations',
        version: '1.0.0',
        name: 'runmeRunner',
        description:
            'Executes markdown runbooks using Runme CLI. Supports running specific cells or entire notebooks with environment variables and timeout control. Use for operational automation, incident remediation, and documented procedures.',
        tags: ['commander', 'runme', 'runbook', 'markdown', 'operations', 'automation'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['operations:execute'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            // Runbooks may need network access - declared as permissive
            // Actual restrictions should be enforced at deployment level
            allowOutbound: ['*'],
        },
    },
    operations: {
        isIdempotent: false, // Runbook cells may have side effects
        retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                const msg = error.message.toLowerCase();
                if (msg.includes('timeout')) return 'RETRYABLE';
                if (msg.includes('not found') || msg.includes('no such file')) return 'FATAL';
                if (msg.includes('permission denied')) return 'FATAL';
                if (msg.includes('network') || msg.includes('connection')) return 'RETRYABLE';
            }
            // Non-zero exit codes from runbook cells are FATAL by default
            return 'FATAL';
        },
        costFactor: 'MEDIUM',
    },
    aiHints: {
        exampleInput: {
            source: '/runbooks/incident-response/redis-failover.md',
            sourceType: 'file',
            cells: ['verify-cluster-health', 'promote-replica'],
            env: { REDIS_HOST: 'redis-primary.prod.svc.cluster.local' },
            timeout: '10m',
        },
        exampleOutput: {
            cells: [
                {
                    id: 'verify-cluster-health',
                    name: 'Verify Cluster Health',
                    exitCode: 0,
                    stdout: 'Cluster health: OK\n3 nodes, 1 primary, 2 replicas',
                    stderr: '',
                    durationMs: 2340,
                },
                {
                    id: 'promote-replica',
                    name: 'Promote Replica',
                    exitCode: 0,
                    stdout: 'Replica redis-replica-1 promoted to primary',
                    stderr: '',
                    durationMs: 5120,
                },
            ],
            success: true,
            totalDurationMs: 7460,
            runbookPath: '/runbooks/incident-response/redis-failover.md',
            message: 'All 2 cells completed successfully',
        },
        usageNotes:
            'Use for executing documented operational procedures. Cells are executed sequentially. If specific cells are provided, only those run. Always verify runbook content before execution in production.',
    },
    factory: (
        dag,
        context: CapabilityContext<RunmeRunnerConfig, RunmeRunnerSecrets>,
        input: RunmeRunnerInput
    ) => {
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withMountedSecret(path: string, secret: unknown): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = { container(): ContainerBuilder };
        const d = dag as unknown as DaggerClient;

        const payload = {
            source: input.source,
            sourceType: input.sourceType,
            cells: input.cells,
            env: input.env,
            timeout: input.timeout ?? context.config.defaultTimeout ?? '5m',
            workdir: input.workdir,
        };

        const runmeVersion = context.config.runmeVersion ?? 'latest';

        let container = d
            .container()
            .from(`ghcr.io/stateful/runme:${runmeVersion}`)
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('RUNME_TLS_DIR', '/tmp/runme');

        // Inject environment variables from input
        if (input.env) {
            for (const [key, value] of Object.entries(input.env)) {
                container = container.withEnvVariable(key, value);
            }
        }

        // Mount secrets as environment variables if provided
        if (context.secretRefs.envSecrets) {
            container = container.withMountedSecret(
                '/run/secrets/env_secrets',
                context.secretRefs.envSecrets
            );
        }

        return container.withExec([
            'sh',
            '-c',
            `
#!/bin/sh
set -e

INPUT_JSON="\${INPUT_JSON}"
SOURCE_TYPE=$(echo "$INPUT_JSON" | jq -r '.sourceType')
SOURCE=$(echo "$INPUT_JSON" | jq -r '.source')
TIMEOUT=$(echo "$INPUT_JSON" | jq -r '.timeout // "5m"')
WORKDIR=$(echo "$INPUT_JSON" | jq -r '.workdir // empty')
CELLS_JSON=$(echo "$INPUT_JSON" | jq -r '.cells // []')

START_TIME=$(date +%s%3N)

# Load secrets as env vars if mounted
if [ -f /run/secrets/env_secrets ]; then
    export $(cat /run/secrets/env_secrets | jq -r 'to_entries | .[] | "\\(.key)=\\(.value)"')
fi

# Set up runbook
RUNBOOK_PATH=""
if [ "$SOURCE_TYPE" = "raw" ]; then
    RUNBOOK_PATH="/tmp/runbook.md"
    echo "$SOURCE" > "$RUNBOOK_PATH"
else
    RUNBOOK_PATH="$SOURCE"
fi

# Change to working directory if specified
if [ -n "$WORKDIR" ]; then
    cd "$WORKDIR"
fi

# Build runme command
RUNME_CMD="runme run --filename=$RUNBOOK_PATH --allow-unknown --allow-unnamed"

# Add specific cells if provided
CELL_COUNT=$(echo "$CELLS_JSON" | jq -r 'length')
if [ "$CELL_COUNT" -gt 0 ]; then
    CELLS=$(echo "$CELLS_JSON" | jq -r '.[]' | tr '\\n' ' ')
    RUNME_CMD="$RUNME_CMD $CELLS"
else
    RUNME_CMD="$RUNME_CMD --all"
fi

# Execute runme and capture output
STDOUT_FILE=$(mktemp)
STDERR_FILE=$(mktemp)

set +e
timeout "$TIMEOUT" $RUNME_CMD > "$STDOUT_FILE" 2> "$STDERR_FILE"
EXIT_CODE=$?
set -e

END_TIME=$(date +%s%3N)
DURATION=$((END_TIME - START_TIME))

# Parse cell results (simplified - runme outputs to stdout)
STDOUT_CONTENT=$(cat "$STDOUT_FILE")
STDERR_CONTENT=$(cat "$STDERR_FILE")

# Build cell result - for now treating entire execution as one cell
# In production, would parse runme's structured output
SUCCESS=$([ $EXIT_CODE -eq 0 ] && echo true || echo false)

if [ "$CELL_COUNT" -gt 0 ]; then
    CELL_RESULTS=$(echo "$CELLS_JSON" | jq -c --arg exitCode "$EXIT_CODE" --arg stdout "$STDOUT_CONTENT" --arg stderr "$STDERR_CONTENT" --arg duration "$DURATION" '
        [.[] | {
            id: .,
            exitCode: ($exitCode | tonumber),
            stdout: $stdout,
            stderr: $stderr,
            durationMs: (($duration | tonumber) / length | floor)
        }]
    ')
else
    CELL_RESULTS=$(cat << CELLEOF
[{
    "id": "all",
    "name": "All Cells",
    "exitCode": $EXIT_CODE,
    "stdout": $(echo "$STDOUT_CONTENT" | jq -Rs .),
    "stderr": $(echo "$STDERR_CONTENT" | jq -Rs .),
    "durationMs": $DURATION
}]
CELLEOF
)
fi

# Build message
if [ "$SUCCESS" = "true" ]; then
    MESSAGE="All cells completed successfully"
else
    MESSAGE="Execution failed with exit code $EXIT_CODE"
fi

# Output result
cat << EOF
{
    "cells": $CELL_RESULTS,
    "success": $SUCCESS,
    "totalDurationMs": $DURATION,
    "runbookPath": "$RUNBOOK_PATH",
    "message": "$MESSAGE"
}
EOF

rm -f "$STDOUT_FILE" "$STDERR_FILE"
            `.trim(),
        ]);
    },
};
