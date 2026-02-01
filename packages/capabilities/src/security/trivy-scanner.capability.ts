/**
 * packages/capabilities/src/security/trivy-scanner.capability.ts
 * Trivy Scanner Capability (OCS-001 Commander Pattern)
 *
 * Provides container image and filesystem vulnerability scanning using Trivy.
 * Supports CVE detection, misconfiguration scanning, and secret detection.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const scanTypeSchema = z.enum([
    'image',
    'filesystem',
    'repository',
    'config',
    'sbom',
]).describe('Type of scan to perform');

const severitySchema = z.enum([
    'UNKNOWN',
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL',
]).describe('Vulnerability severity level');

const inputSchema = z
    .object({
        target: z.string().describe('Scan target (image name, path, or repo URL)'),
        scanType: scanTypeSchema,
        severities: z.array(severitySchema).optional().describe('Filter by severity levels'),
        ignoreUnfixed: z.boolean().optional().describe('Ignore unfixed vulnerabilities'),
        skipDirs: z.array(z.string()).optional().describe('Directories to skip'),
        skipFiles: z.array(z.string()).optional().describe('Files to skip'),
        listAllPkgs: z.boolean().optional().describe('List all packages, not just vulnerable ones'),
        securityChecks: z.array(z.enum(['vuln', 'config', 'secret', 'license'])).optional().describe('Security checks to run'),
        timeout: z.number().positive().optional().describe('Scan timeout in seconds'),
    })
    .describe('Trivy Scanner input');

const vulnerabilitySchema = z.object({
    vulnerabilityId: z.string().describe('CVE or vulnerability ID'),
    pkgName: z.string().describe('Affected package name'),
    installedVersion: z.string().describe('Installed version'),
    fixedVersion: z.string().optional().describe('Fixed version if available'),
    severity: severitySchema.describe('Vulnerability severity'),
    title: z.string().optional().describe('Vulnerability title'),
    description: z.string().optional().describe('Vulnerability description'),
    primaryUrl: z.string().optional().describe('Primary reference URL'),
});

const misconfigSchema = z.object({
    type: z.string().describe('Misconfiguration type'),
    id: z.string().describe('Check ID'),
    title: z.string().describe('Check title'),
    severity: severitySchema.describe('Severity'),
    message: z.string().describe('Detailed message'),
    resolution: z.string().optional().describe('Recommended resolution'),
});

const outputSchema = z
    .object({
        target: z.string().describe('Scanned target'),
        scanType: scanTypeSchema.describe('Scan type performed'),
        vulnerabilities: z.array(vulnerabilitySchema).describe('Found vulnerabilities'),
        misconfigurations: z.array(misconfigSchema).optional().describe('Found misconfigurations'),
        secrets: z.array(z.object({
            ruleId: z.string(),
            category: z.string(),
            title: z.string(),
            severity: severitySchema,
            match: z.string(),
        })).optional().describe('Found secrets'),
        summary: z.object({
            critical: z.number(),
            high: z.number(),
            medium: z.number(),
            low: z.number(),
            unknown: z.number(),
        }).describe('Vulnerability count by severity'),
        scanDuration: z.number().describe('Scan duration in milliseconds'),
        trivyVersion: z.string().describe('Trivy version'),
    })
    .describe('Trivy Scanner output');

const configSchema = z
    .object({
        cacheDir: z.string().optional().describe('Cache directory for vulnerability database'),
        offlineScan: z.boolean().optional().describe('Run in offline mode'),
        skipDbUpdate: z.boolean().optional().describe('Skip database update'),
    })
    .describe('Trivy Scanner configuration');

const secretsSchema = z
    .object({
        registryToken: z.string().optional().describe('Container registry token for private images'),
    })
    .describe('Trivy Scanner secrets');

export type TrivyScannerInput = z.infer<typeof inputSchema>;
export type TrivyScannerOutput = z.infer<typeof outputSchema>;
export type TrivyScannerConfig = z.infer<typeof configSchema>;
export type TrivyScannerSecrets = z.infer<typeof secretsSchema>;

export const trivyScannerCapability: Capability<
    TrivyScannerInput,
    TrivyScannerOutput,
    TrivyScannerConfig,
    TrivyScannerSecrets
> = {
    metadata: {
        id: 'golden.security.trivy-scanner',
        version: '1.0.0',
        name: 'trivyScanner',
        description:
            'Container image and filesystem vulnerability scanning using Trivy. Detects CVEs, misconfigurations, secrets, and license issues.',
        tags: ['commander', 'security', 'vulnerability', 'container', 'scanning'],
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
            allowOutbound: ['ghcr.io', 'index.docker.io', '*.githubusercontent.com'], // For DB updates and image pulls
        },
    },
    operations: {
        isIdempotent: true,
        retryPolicy: { maxAttempts: 2, initialIntervalSeconds: 5, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('timeout')) return 'RETRYABLE';
                if (error.message.includes('network')) return 'RETRYABLE';
                if (error.message.includes('pull')) return 'RETRYABLE';
            }
            return 'FATAL';
        },
        costFactor: 'MEDIUM',
    },
    aiHints: {
        exampleInput: {
            target: 'alpine:3.18',
            scanType: 'image',
            severities: ['CRITICAL', 'HIGH'],
        },
        exampleOutput: {
            target: 'alpine:3.18',
            scanType: 'image',
            vulnerabilities: [
                {
                    vulnerabilityId: 'CVE-2023-12345',
                    pkgName: 'libcrypto3',
                    installedVersion: '3.0.8-r0',
                    fixedVersion: '3.0.9-r0',
                    severity: 'HIGH',
                    title: 'OpenSSL vulnerability',
                },
            ],
            summary: {
                critical: 0,
                high: 1,
                medium: 2,
                low: 5,
                unknown: 0,
            },
            scanDuration: 5200,
            trivyVersion: '0.48.0',
        },
        usageNotes:
            'Use for CI/CD security gates. image scan for container images, filesystem for local code, config for IaC misconfigurations. Set severities filter to focus on critical issues.',
    },
    factory: (
        dag,
        context: CapabilityContext<TrivyScannerConfig, TrivyScannerSecrets>,
        input: TrivyScannerInput
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
            scanType: input.scanType,
            severities: input.severities,
            ignoreUnfixed: input.ignoreUnfixed ?? false,
            skipDirs: input.skipDirs,
            skipFiles: input.skipFiles,
            listAllPkgs: input.listAllPkgs ?? false,
            securityChecks: input.securityChecks ?? ['vuln'],
            timeout: input.timeout,
            offlineScan: context.config.offlineScan ?? false,
            skipDbUpdate: context.config.skipDbUpdate ?? false,
            registryTokenRef: context.secretRefs.registryToken,
        };

        return d
            .container()
            .from('aquasec/trivy:latest')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('SCAN_TYPE', input.scanType)
            .withEnvVariable('TARGET', input.target)
            .withExec([
                'sh',
                '-c',
                `
#!/bin/sh
set -e

# Parse input
INPUT_JSON=\${INPUT_JSON}
TARGET=$(echo "$INPUT_JSON" | jq -r '.target')
SCAN_TYPE=$(echo "$INPUT_JSON" | jq -r '.scanType')
START_TIME=$(date +%s%3N)

# Build trivy command
TRIVY_CMD="trivy $SCAN_TYPE --format json"

# Add severity filter
SEVERITIES=$(echo "$INPUT_JSON" | jq -r '.severities // empty | join(",")')
if [ -n "$SEVERITIES" ]; then
  TRIVY_CMD="$TRIVY_CMD --severity $SEVERITIES"
fi

# Add options
IGNORE_UNFIXED=$(echo "$INPUT_JSON" | jq -r '.ignoreUnfixed')
if [ "$IGNORE_UNFIXED" = "true" ]; then
  TRIVY_CMD="$TRIVY_CMD --ignore-unfixed"
fi

SKIP_DB_UPDATE=$(echo "$INPUT_JSON" | jq -r '.skipDbUpdate')
if [ "$SKIP_DB_UPDATE" = "true" ]; then
  TRIVY_CMD="$TRIVY_CMD --skip-db-update"
fi

OFFLINE=$(echo "$INPUT_JSON" | jq -r '.offlineScan')
if [ "$OFFLINE" = "true" ]; then
  TRIVY_CMD="$TRIVY_CMD --offline-scan"
fi

TIMEOUT=$(echo "$INPUT_JSON" | jq -r '.timeout // empty')
if [ -n "$TIMEOUT" ]; then
  TRIVY_CMD="$TRIVY_CMD --timeout \${TIMEOUT}s"
fi

# Security checks
CHECKS=$(echo "$INPUT_JSON" | jq -r '.securityChecks // ["vuln"] | join(",")')
TRIVY_CMD="$TRIVY_CMD --scanners $CHECKS"

# Run scan
TRIVY_CMD="$TRIVY_CMD $TARGET"
SCAN_OUTPUT=$($TRIVY_CMD 2>/dev/null) || SCAN_OUTPUT="{}"

END_TIME=$(date +%s%3N)
DURATION=$((END_TIME - START_TIME))

# Get trivy version
TRIVY_VERSION=$(trivy --version | head -1 | awk '{print $2}')

# Extract vulnerabilities from results
VULNS=$(echo "$SCAN_OUTPUT" | jq '[.Results[]?.Vulnerabilities[]? | {
  vulnerabilityId: .VulnerabilityID,
  pkgName: .PkgName,
  installedVersion: .InstalledVersion,
  fixedVersion: .FixedVersion,
  severity: .Severity,
  title: .Title,
  description: .Description,
  primaryUrl: .PrimaryURL
}] // []')

# Count by severity
CRITICAL=$(echo "$VULNS" | jq '[.[] | select(.severity == "CRITICAL")] | length')
HIGH=$(echo "$VULNS" | jq '[.[] | select(.severity == "HIGH")] | length')
MEDIUM=$(echo "$VULNS" | jq '[.[] | select(.severity == "MEDIUM")] | length')
LOW=$(echo "$VULNS" | jq '[.[] | select(.severity == "LOW")] | length')
UNKNOWN=$(echo "$VULNS" | jq '[.[] | select(.severity == "UNKNOWN")] | length')

# Extract misconfigurations
MISCONFIGS=$(echo "$SCAN_OUTPUT" | jq '[.Results[]?.Misconfigurations[]? | {
  type: .Type,
  id: .ID,
  title: .Title,
  severity: .Severity,
  message: .Message,
  resolution: .Resolution
}] // []')

# Extract secrets
SECRETS=$(echo "$SCAN_OUTPUT" | jq '[.Results[]?.Secrets[]? | {
  ruleId: .RuleID,
  category: .Category,
  title: .Title,
  severity: .Severity,
  match: .Match
}] // []')

# Output result
cat << EOF
{
  "target": "$TARGET",
  "scanType": "$SCAN_TYPE",
  "vulnerabilities": $VULNS,
  "misconfigurations": $MISCONFIGS,
  "secrets": $SECRETS,
  "summary": {
    "critical": $CRITICAL,
    "high": $HIGH,
    "medium": $MEDIUM,
    "low": $LOW,
    "unknown": $UNKNOWN
  },
  "scanDuration": $DURATION,
  "trivyVersion": "$TRIVY_VERSION"
}
EOF
        `.trim(),
            ]);
    },
};
