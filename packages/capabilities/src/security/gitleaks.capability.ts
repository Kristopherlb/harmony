/**
 * packages/capabilities/src/security/gitleaks.capability.ts
 * Gitleaks Secret Detection Capability (OCS-001 Commander Pattern)
 *
 * Detects secrets and sensitive information in git repositories.
 * Uses Gitleaks for scanning commit history, staged files, or directories.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
    'detect',      // Scan for secrets
    'protect',     // Pre-commit hook style scan
]).describe('Gitleaks operation mode');

const findingSchema = z.object({
    description: z.string().describe('Description of the secret type'),
    file: z.string().describe('File path where secret was found'),
    startLine: z.number().describe('Starting line number'),
    endLine: z.number().describe('Ending line number'),
    startColumn: z.number().optional().describe('Starting column'),
    endColumn: z.number().optional().describe('Ending column'),
    match: z.string().describe('Matched content (redacted)'),
    secret: z.string().describe('The detected secret (redacted in output)'),
    rule: z.string().describe('Rule ID that matched'),
    entropy: z.number().optional().describe('Entropy score of the secret'),
    commit: z.string().optional().describe('Commit SHA where secret was introduced'),
    author: z.string().optional().describe('Commit author'),
    email: z.string().optional().describe('Commit author email'),
    date: z.string().optional().describe('Commit date'),
    message: z.string().optional().describe('Commit message'),
});

const inputSchema = z
    .object({
        operation: operationSchema,
        source: z.string().describe('Path to git repository or directory to scan'),
        configPath: z.string().optional().describe('Path to custom .gitleaks.toml config'),
        baseline: z.string().optional().describe('Path to baseline file for ignoring known issues'),
        redact: z.boolean().optional().describe('Redact secrets in output'),
        verbose: z.boolean().optional().describe('Enable verbose output'),
        noGit: z.boolean().optional().describe('Treat source as directory, not git repo'),
        logLevel: z.enum(['debug', 'info', 'warn', 'error']).optional().describe('Log level'),
    })
    .describe('Gitleaks input');

const outputSchema = z
    .object({
        findings: z.array(findingSchema).describe('List of detected secrets'),
        findingsCount: z.number().describe('Total number of findings'),
        exitCode: z.number().describe('Gitleaks exit code (0=clean, 1=leaks found)'),
        scanDuration: z.number().describe('Scan duration in milliseconds'),
        filesScanned: z.number().optional().describe('Number of files scanned'),
        commitsScanned: z.number().optional().describe('Number of commits scanned'),
    })
    .describe('Gitleaks output');

const configSchema = z
    .object({
        defaultRedact: z.boolean().optional().describe('Default redaction setting'),
        exitOnLeak: z.boolean().optional().describe('Exit with error if leaks found'),
    })
    .describe('Gitleaks configuration');

const secretsSchema = z
    .object({})
    .describe('Gitleaks secrets - none required');

export type GitleaksInput = z.infer<typeof inputSchema>;
export type GitleaksOutput = z.infer<typeof outputSchema>;
export type GitleaksConfig = z.infer<typeof configSchema>;
export type GitleaksSecrets = z.infer<typeof secretsSchema>;

export const gitleaksCapability: Capability<
    GitleaksInput,
    GitleaksOutput,
    GitleaksConfig,
    GitleaksSecrets
> = {
    metadata: {
        id: 'golden.security.gitleaks',
        domain: 'security',
        version: '1.0.0',
        name: 'gitleaks',
        description:
            'Secret detection tool for git repositories. Scans commit history, staged files, and directories for leaked credentials, API keys, and sensitive data.',
        tags: ['commander', 'security', 'secrets', 'git', 'scanning'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['security:scan'],
        dataClassification: 'CONFIDENTIAL',
        networkAccess: {
            allowOutbound: [], // Gitleaks runs locally, no network needed
        },
    },
    operations: {
        isIdempotent: true,
        retryPolicy: { maxAttempts: 2, initialIntervalSeconds: 1, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('not a git repository')) return 'FATAL';
                if (error.message.includes('permission denied')) return 'FATAL';
                if (error.message.includes('timeout')) return 'RETRYABLE';
            }
            return 'FATAL';
        },
        costFactor: 'MEDIUM',
    },
    aiHints: {
        exampleInput: {
            operation: 'detect',
            source: '/path/to/repo',
            redact: true,
        },
        exampleOutput: {
            findings: [
                {
                    description: 'AWS Access Key',
                    file: 'config.js',
                    startLine: 42,
                    endLine: 42,
                    match: 'AKIA***REDACTED***',
                    secret: 'AKIA***REDACTED***',
                    rule: 'aws-access-key',
                    commit: 'abc123',
                    author: 'developer',
                    email: 'dev@example.com',
                    date: '2024-01-15',
                    message: 'Add config file',
                },
            ],
            findingsCount: 1,
            exitCode: 1,
            scanDuration: 2340,
            commitsScanned: 150,
        },
        usageNotes:
            'Use "detect" to scan entire git history. Use "protect" for pre-commit checks (staged files only). Enable redact=true in production to avoid logging secrets.',
    },
    factory: (
        dag,
        context: CapabilityContext<GitleaksConfig, GitleaksSecrets>,
        input: GitleaksInput
    ) => {
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withMountedDirectory?(path: string, dir: unknown): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = { container(): ContainerBuilder };
        const d = dag as unknown as DaggerClient;

        const redact = input.redact ?? context.config.defaultRedact ?? true;

        const payload = {
            operation: input.operation,
            source: input.source,
            configPath: input.configPath,
            baseline: input.baseline,
            redact,
            verbose: input.verbose ?? false,
            noGit: input.noGit ?? false,
            logLevel: input.logLevel ?? 'info',
        };

        return d
            .container()
            .from('zricethezav/gitleaks:latest')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('OPERATION', input.operation)
            .withEnvVariable('SOURCE', input.source)
            .withExec([
                'sh',
                '-c',
                `
#!/bin/sh
set -e

# Parse input
OPERATION="${input.operation}"
SOURCE="${input.source}"
REDACT="${redact}"
VERBOSE="${input.verbose ?? false}"
NO_GIT="${input.noGit ?? false}"
LOG_LEVEL="${input.logLevel ?? 'info'}"

# Build gitleaks command
CMD="gitleaks"

if [ "$OPERATION" = "protect" ]; then
  CMD="$CMD protect"
else
  CMD="$CMD detect"
fi

CMD="$CMD --source=$SOURCE"
CMD="$CMD --report-format=json"
CMD="$CMD --report-path=/tmp/report.json"
CMD="$CMD --log-level=$LOG_LEVEL"

if [ "$REDACT" = "true" ]; then
  CMD="$CMD --redact"
fi

if [ "$VERBOSE" = "true" ]; then
  CMD="$CMD --verbose"
fi

if [ "$NO_GIT" = "true" ]; then
  CMD="$CMD --no-git"
fi

${input.configPath ? `CMD="$CMD --config=${input.configPath}"` : ''}
${input.baseline ? `CMD="$CMD --baseline-path=${input.baseline}"` : ''}

# Run scan and capture timing
START_TIME=$(date +%s%3N)
$CMD || EXIT_CODE=$?
END_TIME=$(date +%s%3N)
EXIT_CODE=\${EXIT_CODE:-0}

DURATION=$((END_TIME - START_TIME))

# Parse report and output
if [ -f /tmp/report.json ]; then
  FINDINGS=$(cat /tmp/report.json)
  COUNT=$(echo "$FINDINGS" | jq 'length')
else
  FINDINGS="[]"
  COUNT=0
fi

# Output JSON result
cat <<EOF
{
  "findings": $FINDINGS,
  "findingsCount": $COUNT,
  "exitCode": $EXIT_CODE,
  "scanDuration": $DURATION
}
EOF
        `.trim(),
            ]);
    },
};
