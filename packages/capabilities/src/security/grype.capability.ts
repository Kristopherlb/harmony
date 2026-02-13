/**
 * packages/capabilities/src/security/grype.capability.ts
 * Grype Vulnerability Scanner Capability (OCS-001 Commander Pattern)
 *
 * Scans container images, filesystems, and SBOMs for vulnerabilities using Anchore Grype.
 * Pairs with Syft for comprehensive supply chain security.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const sourceTypeSchema = z.enum([
    'image',       // Container image
    'directory',   // Local filesystem directory  
    'file',        // Single file or archive
    'sbom',        // SBOM file (from Syft)
    'registry',    // Container registry image
]).describe('Type of source to scan');

const severitySchema = z.enum([
    'negligible',
    'low',
    'medium',
    'high',
    'critical',
]).describe('Vulnerability severity level');

const vulnerabilitySchema = z.object({
    id: z.string().describe('CVE or vulnerability ID'),
    severity: severitySchema.describe('Severity level'),
    package: z.string().describe('Affected package name'),
    version: z.string().describe('Affected package version'),
    fixedIn: z.string().optional().describe('Version with fix available'),
    description: z.string().optional().describe('Vulnerability description'),
    dataSource: z.string().optional().describe('Source database'),
    urls: z.array(z.string()).optional().describe('Reference URLs'),
});

const inputSchema = z
    .object({
        sourceType: sourceTypeSchema,
        source: z.string().describe('Source to scan (image name, path, SBOM file)'),
        failOnSeverity: severitySchema.optional().describe('Fail if vulnerabilities at or above this severity'),
        onlyFixed: z.boolean().optional().describe('Only show vulnerabilities with fixes available'),
        byCve: z.boolean().optional().describe('Group results by CVE instead of package'),
        scope: z.enum(['all', 'os', 'all-layers']).optional().describe('Scan scope for images'),
    })
    .describe('Grype vulnerability scan input');

const outputSchema = z
    .object({
        vulnerabilities: z.array(vulnerabilitySchema).describe('List of vulnerabilities found'),
        summary: z.object({
            critical: z.number().describe('Critical severity count'),
            high: z.number().describe('High severity count'),
            medium: z.number().describe('Medium severity count'),
            low: z.number().describe('Low severity count'),
            negligible: z.number().describe('Negligible severity count'),
            total: z.number().describe('Total vulnerability count'),
        }).describe('Vulnerability summary by severity'),
        source: z.object({
            type: z.string(),
            target: z.string(),
        }).describe('Source that was scanned'),
        scanDuration: z.number().describe('Scan duration in milliseconds'),
        passed: z.boolean().describe('Whether scan passed based on failOnSeverity threshold'),
    })
    .describe('Grype vulnerability scan output');

const configSchema = z
    .object({
        defaultFailOnSeverity: severitySchema.optional().describe('Default severity threshold'),
        dbAutoUpdate: z.boolean().optional().describe('Auto-update vulnerability database'),
    })
    .describe('Grype configuration');

const secretsSchema = z
    .object({
        registryAuth: z.string().optional().describe('Registry authentication credentials'),
    })
    .describe('Grype secrets');

export type GrypeInput = z.infer<typeof inputSchema>;
export type GrypeOutput = z.infer<typeof outputSchema>;
export type GrypeConfig = z.infer<typeof configSchema>;
export type GrypeSecrets = z.infer<typeof secretsSchema>;

export const grypeCapability: Capability<
    GrypeInput,
    GrypeOutput,
    GrypeConfig,
    GrypeSecrets
> = {
    metadata: {
        id: 'golden.security.grype',
        domain: 'security',
        version: '1.0.0',
        name: 'grype',
        description:
            'Vulnerability scanner for container images, filesystems, and SBOMs using Anchore Grype. Pairs with Syft for comprehensive supply chain security analysis.',
        tags: ['commander', 'security', 'vulnerability', 'scanning', 'sbom'],
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
            // May need to pull images from registries and update vuln DB
            allowOutbound: [
                '*.docker.io',
                'ghcr.io',
                '*.gcr.io',
                '*.azurecr.io',
                '*.amazonaws.com',
                'quay.io',
                'toolbox-data.anchore.io', // Grype vulnerability database
            ],
        },
    },
    operations: {
        isIdempotent: true,
        retryPolicy: { maxAttempts: 2, initialIntervalSeconds: 2, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('not found')) return 'FATAL';
                if (error.message.includes('unauthorized')) return 'FATAL';
                if (error.message.includes('timeout')) return 'RETRYABLE';
                if (error.message.includes('connection')) return 'RETRYABLE';
            }
            return 'FATAL';
        },
        costFactor: 'MEDIUM',
    },
    aiHints: {
        exampleInput: {
            sourceType: 'image',
            source: 'alpine:3.18',
            failOnSeverity: 'high',
        },
        exampleOutput: {
            vulnerabilities: [
                {
                    id: 'CVE-2023-12345',
                    severity: 'high',
                    package: 'libssl',
                    version: '1.1.1k',
                    fixedIn: '1.1.1l',
                    description: 'Buffer overflow in OpenSSL',
                },
            ],
            summary: {
                critical: 0,
                high: 1,
                medium: 3,
                low: 5,
                negligible: 2,
                total: 11,
            },
            source: {
                type: 'image',
                target: 'alpine:3.18',
            },
            scanDuration: 4520,
            passed: false,
        },
        usageNotes:
            'Use with Syft-generated SBOMs for faster scans. Set failOnSeverity to enforce security gates in CI/CD. Use onlyFixed=true to focus on actionable vulnerabilities.',
    },
    factory: (
        dag,
        context: CapabilityContext<GrypeConfig, GrypeSecrets>,
        input: GrypeInput
    ) => {
        type DaggerSecret = unknown;
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withMountedSecret(path: string, secret: DaggerSecret): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = { container(): ContainerBuilder };
        const d = dag as unknown as DaggerClient;

        const failOnSeverity = input.failOnSeverity ?? context.config.defaultFailOnSeverity;

        const payload = {
            sourceType: input.sourceType,
            source: input.source,
            failOnSeverity,
            onlyFixed: input.onlyFixed ?? false,
            byCve: input.byCve ?? false,
            scope: input.scope ?? 'all',
        };

        let container = d
            .container()
            .from('anchore/grype:latest')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('SOURCE_TYPE', input.sourceType)
            .withEnvVariable('SOURCE', input.source);

        // Mount registry auth if provided
        if (context.secretRefs.registryAuth && typeof (container as Record<string, unknown>).withMountedSecret === 'function') {
            container = container.withMountedSecret('/run/secrets/registry_auth', context.secretRefs.registryAuth as unknown as DaggerSecret);
        }

        return container.withExec([
            'sh',
            '-c',
            `
#!/bin/sh
set -e

SOURCE_TYPE="${input.sourceType}"
SOURCE="${input.source}"
FAIL_ON="${failOnSeverity || ''}"

# Build source reference
case "$SOURCE_TYPE" in
  image) SOURCE_REF="$SOURCE" ;;
  directory) SOURCE_REF="dir:$SOURCE" ;;
  file) SOURCE_REF="file:$SOURCE" ;;
  sbom) SOURCE_REF="sbom:$SOURCE" ;;
  registry) SOURCE_REF="registry:$SOURCE" ;;
esac

# Apply registry auth if available
if [ -f /run/secrets/registry_auth ]; then
  export GRYPE_REGISTRY_AUTH_FILE=/run/secrets/registry_auth
fi

# Run Grype scan
START_TIME=$(date +%s%3N)
grype "$SOURCE_REF" -o json > /tmp/grype.json 2>/tmp/grype.log || true
END_TIME=$(date +%s%3N)
DURATION=$((END_TIME - START_TIME))

# Parse results
VULNS=$(cat /tmp/grype.json | jq '[.matches[] | {
  id: .vulnerability.id,
  severity: .vulnerability.severity,
  package: .artifact.name,
  version: .artifact.version,
  fixedIn: (.vulnerability.fix.versions[0] // null),
  description: .vulnerability.description,
  dataSource: .vulnerability.dataSource,
  urls: .vulnerability.urls
}]')

CRITICAL=$(echo "$VULNS" | jq '[.[] | select(.severity == "Critical")] | length')
HIGH=$(echo "$VULNS" | jq '[.[] | select(.severity == "High")] | length')
MEDIUM=$(echo "$VULNS" | jq '[.[] | select(.severity == "Medium")] | length')
LOW=$(echo "$VULNS" | jq '[.[] | select(.severity == "Low")] | length')
NEGLIGIBLE=$(echo "$VULNS" | jq '[.[] | select(.severity == "Negligible")] | length')
TOTAL=$(echo "$VULNS" | jq 'length')

# Determine pass/fail
PASSED=true
case "$FAIL_ON" in
  critical) [ "$CRITICAL" -gt 0 ] && PASSED=false ;;
  high) [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ] && PASSED=false ;;
  medium) [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ] || [ "$MEDIUM" -gt 0 ] && PASSED=false ;;
  low) [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ] || [ "$MEDIUM" -gt 0 ] || [ "$LOW" -gt 0 ] && PASSED=false ;;
esac

cat <<EOF
{
  "vulnerabilities": $VULNS,
  "summary": {
    "critical": $CRITICAL,
    "high": $HIGH,
    "medium": $MEDIUM,
    "low": $LOW,
    "negligible": $NEGLIGIBLE,
    "total": $TOTAL
  },
  "source": {
    "type": "$SOURCE_TYPE",
    "target": "$SOURCE"
  },
  "scanDuration": $DURATION,
  "passed": $PASSED
}
EOF
      `.trim(),
        ]);
    },
};
