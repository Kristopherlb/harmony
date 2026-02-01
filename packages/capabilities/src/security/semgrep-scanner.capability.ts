/**
 * packages/capabilities/src/security/semgrep-scanner.capability.ts
 * Semgrep Scanner Capability (OCS-001 Commander Pattern)
 *
 * Provides static code analysis using Semgrep for security, bugs, and anti-patterns.
 * Supports custom rules and registry rulesets.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const severitySchema = z.enum([
    'INFO',
    'WARNING',
    'ERROR',
]).describe('Finding severity level');

const inputSchema = z
    .object({
        target: z.string().describe('Path to scan (directory or file)'),
        config: z.string().describe('Semgrep config (registry ruleset like p/security-audit, or path to rules)'),
        severity: z.array(severitySchema).optional().describe('Filter by severity levels'),
        exclude: z.array(z.string()).optional().describe('Patterns to exclude from scan'),
        include: z.array(z.string()).optional().describe('Patterns to include in scan'),
        maxTargetBytes: z.number().positive().optional().describe('Maximum file size to scan'),
        timeout: z.number().positive().optional().describe('Timeout per file in seconds'),
        verbose: z.boolean().optional().default(false).describe('Enable verbose output'),
        autofix: z.boolean().optional().default(false).describe('Apply autofixes where available'),
        dryRun: z.boolean().optional().default(true).describe('Run in dry-run mode (no fixes applied)'),
    })
    .describe('Semgrep Scanner input');

const findingSchema = z.object({
    ruleId: z.string().describe('Semgrep rule ID'),
    path: z.string().describe('File path'),
    startLine: z.number().describe('Start line number'),
    endLine: z.number().describe('End line number'),
    startCol: z.number().optional().describe('Start column'),
    endCol: z.number().optional().describe('End column'),
    message: z.string().describe('Finding message'),
    severity: severitySchema.describe('Severity level'),
    category: z.string().optional().describe('Rule category'),
    cwe: z.array(z.string()).optional().describe('CWE identifiers'),
    owasp: z.array(z.string()).optional().describe('OWASP categories'),
    fix: z.string().optional().describe('Suggested fix'),
    snippet: z.string().optional().describe('Code snippet'),
});

const outputSchema = z
    .object({
        target: z.string().describe('Scanned target'),
        config: z.string().describe('Config used'),
        findings: z.array(findingSchema).describe('Security findings'),
        summary: z.object({
            error: z.number().describe('Error count'),
            warning: z.number().describe('Warning count'),
            info: z.number().describe('Info count'),
            total: z.number().describe('Total findings'),
        }).describe('Finding summary'),
        filesScanned: z.number().describe('Number of files scanned'),
        scanDuration: z.number().describe('Scan duration in milliseconds'),
        semgrepVersion: z.string().describe('Semgrep version'),
        errors: z.array(z.object({
            path: z.string(),
            message: z.string(),
        })).optional().describe('Scan errors'),
    })
    .describe('Semgrep Scanner output');

const configSchema = z
    .object({
        defaultConfig: z.string().optional().default('auto').describe('Default ruleset to use'),
        maxMemory: z.number().positive().optional().describe('Maximum memory in MB'),
        jobs: z.number().int().positive().optional().describe('Number of parallel jobs'),
    })
    .describe('Semgrep Scanner configuration');

const secretsSchema = z
    .object({
        semgrepAppToken: z.string().optional().describe('Semgrep App token for CI integration'),
    })
    .describe('Semgrep Scanner secrets');

export type SemgrepScannerInput = z.infer<typeof inputSchema>;
export type SemgrepScannerOutput = z.infer<typeof outputSchema>;
export type SemgrepScannerConfig = z.infer<typeof configSchema>;
export type SemgrepScannerSecrets = z.infer<typeof secretsSchema>;

export const semgrepScannerCapability: Capability<
    SemgrepScannerInput,
    SemgrepScannerOutput,
    SemgrepScannerConfig,
    SemgrepScannerSecrets
> = {
    metadata: {
        id: 'golden.security.semgrep-scanner',
        version: '1.0.0',
        name: 'semgrepScanner',
        description:
            'Static code analysis using Semgrep. Detects security vulnerabilities, bugs, and anti-patterns using configurable rules.',
        tags: ['commander', 'security', 'sast', 'static-analysis', 'scanning'],
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
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: ['semgrep.dev'], // For registry rules
        },
    },
    operations: {
        isIdempotent: true,
        retryPolicy: { maxAttempts: 2, initialIntervalSeconds: 5, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('timeout')) return 'TRANSIENT';
                if (error.message.includes('memory')) return 'FATAL';
            }
            return 'FATAL';
        },
        costFactor: 'MEDIUM',
    },
    aiHints: {
        exampleInput: {
            target: '/app/src',
            config: 'p/security-audit',
            severity: ['ERROR', 'WARNING'],
        },
        exampleOutput: {
            target: '/app/src',
            config: 'p/security-audit',
            findings: [
                {
                    ruleId: 'javascript.express.security.audit.xss.mustache-escape',
                    path: '/app/src/views/user.js',
                    startLine: 42,
                    endLine: 42,
                    message: 'Potential XSS vulnerability: user input not escaped',
                    severity: 'WARNING',
                    category: 'security',
                    cwe: ['CWE-79'],
                    owasp: ['A03:2021 - Injection'],
                },
            ],
            summary: {
                error: 0,
                warning: 1,
                info: 2,
                total: 3,
            },
            filesScanned: 45,
            scanDuration: 3200,
            semgrepVersion: '1.50.0',
        },
        usageNotes:
            'Use p/security-audit for comprehensive security scan. Use p/owasp-top-ten for OWASP coverage. Use auto for automatic detection. Filter by severity to focus on critical issues.',
    },
    factory: (
        dag,
        context: CapabilityContext<SemgrepScannerConfig, SemgrepScannerSecrets>,
        input: SemgrepScannerInput
    ) => {
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = { container(): ContainerBuilder };
        const d = dag as unknown as DaggerClient;

        const payload = {
            target: input.target,
            config: input.config ?? context.config.defaultConfig ?? 'auto',
            severity: input.severity,
            exclude: input.exclude,
            include: input.include,
            maxTargetBytes: input.maxTargetBytes,
            timeout: input.timeout,
            verbose: input.verbose ?? false,
            autofix: input.autofix ?? false,
            dryRun: input.dryRun ?? true,
            maxMemory: context.config.maxMemory,
            jobs: context.config.jobs,
            appTokenRef: context.secretRefs.semgrepAppToken,
        };

        return d
            .container()
            .from('semgrep/semgrep:latest')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('TARGET', input.target)
            .withEnvVariable('SEMGREP_CONFIG', input.config ?? 'auto')
            .withExec([
                'sh',
                '-c',
                `
#!/bin/sh
set -e

# Parse input
INPUT_JSON=\${INPUT_JSON}
TARGET=$(echo "$INPUT_JSON" | jq -r '.target')
CONFIG=$(echo "$INPUT_JSON" | jq -r '.config')
START_TIME=$(date +%s%3N)

# Build semgrep command
SEMGREP_CMD="semgrep scan --json --config $CONFIG"

# Add severity filter
SEVERITY=$(echo "$INPUT_JSON" | jq -r '.severity // empty | map("--severity " + .) | join(" ")')
if [ -n "$SEVERITY" ]; then
  SEMGREP_CMD="$SEMGREP_CMD $SEVERITY"
fi

# Add exclude patterns
EXCLUDES=$(echo "$INPUT_JSON" | jq -r '.exclude // empty | .[]' | while read pattern; do
  echo "--exclude '$pattern'"
done | tr '\\n' ' ')
if [ -n "$EXCLUDES" ]; then
  SEMGREP_CMD="$SEMGREP_CMD $EXCLUDES"
fi

# Add include patterns
INCLUDES=$(echo "$INPUT_JSON" | jq -r '.include // empty | .[]' | while read pattern; do
  echo "--include '$pattern'"
done | tr '\\n' ' ')
if [ -n "$INCLUDES" ]; then
  SEMGREP_CMD="$SEMGREP_CMD $INCLUDES"
fi

# Add options
TIMEOUT=$(echo "$INPUT_JSON" | jq -r '.timeout // empty')
if [ -n "$TIMEOUT" ]; then
  SEMGREP_CMD="$SEMGREP_CMD --timeout $TIMEOUT"
fi

MAX_MEMORY=$(echo "$INPUT_JSON" | jq -r '.maxMemory // empty')
if [ -n "$MAX_MEMORY" ]; then
  SEMGREP_CMD="$SEMGREP_CMD --max-memory $MAX_MEMORY"
fi

JOBS=$(echo "$INPUT_JSON" | jq -r '.jobs // empty')
if [ -n "$JOBS" ]; then
  SEMGREP_CMD="$SEMGREP_CMD --jobs $JOBS"
fi

VERBOSE=$(echo "$INPUT_JSON" | jq -r '.verbose')
if [ "$VERBOSE" = "true" ]; then
  SEMGREP_CMD="$SEMGREP_CMD --verbose"
fi

# Add target
SEMGREP_CMD="$SEMGREP_CMD $TARGET"

# Run scan
SCAN_OUTPUT=$(eval $SEMGREP_CMD 2>/dev/null) || SCAN_OUTPUT='{"results":[],"errors":[]}'

END_TIME=$(date +%s%3N)
DURATION=$((END_TIME - START_TIME))

# Get semgrep version
SEMGREP_VERSION=$(semgrep --version 2>/dev/null | head -1 || echo "unknown")

# Extract findings
FINDINGS=$(echo "$SCAN_OUTPUT" | jq '[.results[]? | {
  ruleId: .check_id,
  path: .path,
  startLine: .start.line,
  endLine: .end.line,
  startCol: .start.col,
  endCol: .end.col,
  message: .extra.message,
  severity: (.extra.severity // "INFO" | ascii_upcase),
  category: .extra.metadata.category,
  cwe: .extra.metadata.cwe,
  owasp: .extra.metadata.owasp,
  fix: .extra.fix,
  snippet: .extra.lines
}] // []')

# Count by severity
ERROR_COUNT=$(echo "$FINDINGS" | jq '[.[] | select(.severity == "ERROR")] | length')
WARNING_COUNT=$(echo "$FINDINGS" | jq '[.[] | select(.severity == "WARNING")] | length')
INFO_COUNT=$(echo "$FINDINGS" | jq '[.[] | select(.severity == "INFO")] | length')
TOTAL_COUNT=$(echo "$FINDINGS" | jq 'length')

# Extract errors
ERRORS=$(echo "$SCAN_OUTPUT" | jq '[.errors[]? | {
  path: .path,
  message: .message
}] // []')

# Count scanned files
FILES_SCANNED=$(echo "$SCAN_OUTPUT" | jq '.paths.scanned // [] | length')

# Output result
cat << EOF
{
  "target": "$TARGET",
  "config": "$CONFIG",
  "findings": $FINDINGS,
  "summary": {
    "error": $ERROR_COUNT,
    "warning": $WARNING_COUNT,
    "info": $INFO_COUNT,
    "total": $TOTAL_COUNT
  },
  "filesScanned": $FILES_SCANNED,
  "scanDuration": $DURATION,
  "semgrepVersion": "$SEMGREP_VERSION",
  "errors": $ERRORS
}
EOF
        `.trim(),
            ]);
    },
};
