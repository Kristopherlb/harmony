/**
 * packages/capabilities/src/security/osv-scanner.capability.ts
 * OSV Scanner Capability (OCS-001 Commander Pattern)
 *
 * Scans dependencies for vulnerabilities using the OSV (Open Source Vulnerabilities) database.
 * OpenSSF project for comprehensive vulnerability detection.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const sourceTypeSchema = z.enum([
    'lockfile',    // Package lockfile (package-lock.json, yarn.lock, Gemfile.lock, etc.)
    'sbom',        // SBOM file
    'directory',   // Directory with manifest files
    'purl',        // Package URL
]).describe('Type of source to scan');

const ecosystemSchema = z.enum([
    'npm',
    'pypi',
    'go',
    'maven',
    'cargo',
    'nuget',
    'packagist',
    'rubygems',
    'pub',
    'hex',
]).describe('Package ecosystem');

const vulnerabilitySchema = z.object({
    id: z.string().describe('OSV vulnerability ID'),
    aliases: z.array(z.string()).optional().describe('CVE and other aliases'),
    summary: z.string().optional().describe('Vulnerability summary'),
    severity: z.string().optional().describe('Severity level'),
    package: z.string().describe('Affected package name'),
    version: z.string().describe('Affected version'),
    ecosystem: z.string().describe('Package ecosystem'),
    fixedVersions: z.array(z.string()).optional().describe('Versions with fix'),
    affectedRanges: z.array(z.object({
        type: z.string(),
        introduced: z.string().optional(),
        fixed: z.string().optional(),
    })).optional().describe('Affected version ranges'),
});

const inputSchema = z
    .object({
        sourceType: sourceTypeSchema,
        source: z.string().describe('Source to scan (file path, directory, or PURL)'),
        ecosystem: ecosystemSchema.optional().describe('Package ecosystem (auto-detected if not specified)'),
        recursive: z.boolean().optional().describe('Recursively scan directories'),
        format: z.enum(['json', 'table', 'markdown', 'sarif']).optional().describe('Output format'),
        callAnalysis: z.boolean().optional().describe('Enable call graph analysis for Go'),
    })
    .describe('OSV Scanner input');

const outputSchema = z
    .object({
        vulnerabilities: z.array(vulnerabilitySchema).describe('List of vulnerabilities found'),
        packagesScanned: z.number().describe('Number of packages scanned'),
        vulnerablePackages: z.number().describe('Number of vulnerable packages'),
        source: z.object({
            type: z.string(),
            target: z.string(),
        }).describe('Source that was scanned'),
        scanDuration: z.number().describe('Scan duration in milliseconds'),
    })
    .describe('OSV Scanner output');

const configSchema = z
    .object({
        ignoredVulns: z.array(z.string()).optional().describe('Vulnerability IDs to ignore'),
        licenseDenylist: z.array(z.string()).optional().describe('Licenses to flag'),
    })
    .describe('OSV Scanner configuration');

const secretsSchema = z
    .object({})
    .describe('OSV Scanner secrets - none required');

export type OsvScannerInput = z.infer<typeof inputSchema>;
export type OsvScannerOutput = z.infer<typeof outputSchema>;
export type OsvScannerConfig = z.infer<typeof configSchema>;
export type OsvScannerSecrets = z.infer<typeof secretsSchema>;

export const osvScannerCapability: Capability<
    OsvScannerInput,
    OsvScannerOutput,
    OsvScannerConfig,
    OsvScannerSecrets
> = {
    metadata: {
        id: 'golden.security.osv-scanner',
        version: '1.0.0',
        name: 'osvScanner',
        description:
            'Vulnerability scanner using the OSV (Open Source Vulnerabilities) database. OpenSSF project supporting all major package ecosystems.',
        tags: ['commander', 'security', 'vulnerability', 'osv', 'openssf'],
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
            allowOutbound: [
                'api.osv.dev',           // OSV API
                'osv-vulnerabilities.storage.googleapis.com', // OSV data
            ],
        },
    },
    operations: {
        isIdempotent: true,
        retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 1, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('not found')) return 'FATAL';
                if (error.message.includes('invalid')) return 'FATAL';
                if (error.message.includes('timeout')) return 'RETRYABLE';
                if (error.message.includes('connection')) return 'RETRYABLE';
                if (error.message.includes('rate limit')) return 'RETRYABLE';
            }
            return 'FATAL';
        },
        costFactor: 'LOW',
    },
    aiHints: {
        exampleInput: {
            sourceType: 'lockfile',
            source: '/path/to/package-lock.json',
            recursive: false,
        },
        exampleOutput: {
            vulnerabilities: [
                {
                    id: 'GHSA-1234-5678-9abc',
                    aliases: ['CVE-2023-12345'],
                    summary: 'Prototype pollution in lodash',
                    severity: 'high',
                    package: 'lodash',
                    version: '4.17.20',
                    ecosystem: 'npm',
                    fixedVersions: ['4.17.21'],
                },
            ],
            packagesScanned: 150,
            vulnerablePackages: 3,
            source: {
                type: 'lockfile',
                target: '/path/to/package-lock.json',
            },
            scanDuration: 1230,
        },
        usageNotes:
            'OSV Scanner supports all major ecosystems. Use recursive=true to scan monorepos. SARIF output integrates with GitHub Security tab.',
    },
    factory: (
        dag,
        context: CapabilityContext<OsvScannerConfig, OsvScannerSecrets>,
        input: OsvScannerInput
    ) => {
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = { container(): ContainerBuilder };
        const d = dag as unknown as DaggerClient;

        const payload = {
            sourceType: input.sourceType,
            source: input.source,
            ecosystem: input.ecosystem,
            recursive: input.recursive ?? false,
            format: input.format ?? 'json',
            callAnalysis: input.callAnalysis ?? false,
        };

        return d
            .container()
            .from('ghcr.io/google/osv-scanner:latest')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('SOURCE_TYPE', input.sourceType)
            .withEnvVariable('SOURCE', input.source)
            .withExec([
                'sh',
                '-c',
                `
#!/bin/sh
set -e

SOURCE_TYPE="${input.sourceType}"
SOURCE="${input.source}"
RECURSIVE="${input.recursive ?? false}"

# Build osv-scanner command
CMD="osv-scanner --format json"

case "$SOURCE_TYPE" in
  lockfile) CMD="$CMD --lockfile=$SOURCE" ;;
  sbom) CMD="$CMD --sbom=$SOURCE" ;;
  directory) CMD="$CMD $SOURCE" ;;
  purl) CMD="$CMD --purl=$SOURCE" ;;
esac

if [ "$RECURSIVE" = "true" ]; then
  CMD="$CMD --recursive"
fi

${input.callAnalysis ? 'CMD="$CMD --call-analysis"' : ''}

# Run scan
START_TIME=$(date +%s%3N)
$CMD > /tmp/osv.json 2>/tmp/osv.log || true
END_TIME=$(date +%s%3N)
DURATION=$((END_TIME - START_TIME))

# Parse results
if [ -f /tmp/osv.json ] && [ -s /tmp/osv.json ]; then
  VULNS=$(cat /tmp/osv.json | jq '[.results[]?.packages[]?.vulnerabilities[]? | {
    id: .id,
    aliases: .aliases,
    summary: .summary,
    severity: (.severity[]?.type // "unknown"),
    package: .affected[]?.package?.name,
    version: .affected[]?.versions[0],
    ecosystem: .affected[]?.package?.ecosystem,
    fixedVersions: [.affected[]?.ranges[]?.events[]? | select(.fixed) | .fixed]
  }] | map(select(.id != null))')
  
  PKG_COUNT=$(cat /tmp/osv.json | jq '[.results[]?.packages[]?] | length')
  VULN_PKG_COUNT=$(cat /tmp/osv.json | jq '[.results[]?.packages[]? | select(.vulnerabilities)] | length')
else
  VULNS="[]"
  PKG_COUNT=0
  VULN_PKG_COUNT=0
fi

cat <<EOF
{
  "vulnerabilities": $VULNS,
  "packagesScanned": $PKG_COUNT,
  "vulnerablePackages": $VULN_PKG_COUNT,
  "source": {
    "type": "$SOURCE_TYPE",
    "target": "$SOURCE"
  },
  "scanDuration": $DURATION
}
EOF
      `.trim(),
            ]);
    },
};
