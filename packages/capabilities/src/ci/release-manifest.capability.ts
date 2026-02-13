/**
 * packages/capabilities/src/ci/release-manifest.capability.ts
 * Release Manifest Capability (OCS-001 Transformer Pattern)
 *
 * Bundle all release artifacts into a single manifest with certification,
 * OSCAL, security scans, and flag definitions.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
    'generate',     // Generate release manifest
    'validate',     // Validate existing manifest
    'bundle',       // Bundle all artifacts into release archive
]).describe('Release manifest operation');

const securityArtifactsSchema = z.object({
    trivyScanPath: z.string().optional().describe('Path to Trivy scan results'),
    gitleaksScanPath: z.string().optional().describe('Path to Gitleaks scan results'),
    sbomPath: z.string().optional().describe('Path to SBOM file'),
}).describe('Security scan artifact paths');

const securitySummarySchema = z.object({
    vulnerabilities: z.number().optional().describe('Vulnerability count (fallback if scan file not available)'),
    secretLeaks: z.number().optional().describe('Secret leak count (fallback if scan file not available)'),
    sbomPackages: z.number().optional().describe('SBOM package count (fallback if SBOM file not available)'),
}).describe('Security summary counts');

const changelogEntrySchema = z.object({
    type: z.enum(['feat', 'fix', 'docs', 'chore', 'refactor', 'perf', 'test']).describe('Change type'),
    scope: z.string().optional().describe('Change scope'),
    description: z.string().describe('Change description'),
    commitSha: z.string().optional().describe('Associated commit SHA'),
    breaking: z.boolean().optional().describe('Is breaking change'),
});

const inputSchema = z
    .object({
        operation: operationSchema,
        version: z.string().describe('Release version'),
        gitSha: z.string().optional().describe('Git commit SHA'),
        buildId: z.string().optional().describe('Temporal Worker Build ID'),
        certificationPath: z.string().optional().describe('Path to CERTIFICATION.json'),
        certificationStatus: z.enum(['PASS', 'FAIL', 'UNKNOWN']).optional().describe('Fallback certification status'),
        oscalPath: z.string().optional().describe('Path to OSCAL component definition'),
        oscalControlsCovered: z.array(z.string()).optional().describe('Fallback OSCAL controlsCovered array'),
        security: securityArtifactsSchema.optional().describe('Security artifact paths'),
        securitySummary: securitySummarySchema.optional().describe('Fallback security summary counts'),
        flagsConfigPath: z.string().optional().describe('Path to flagd configuration'),
        flagCount: z.number().optional().describe('Fallback flag count (if flags file not available)'),
        changelog: z.array(changelogEntrySchema).optional().describe('Changelog entries'),
        previousVersion: z.string().optional().describe('Previous version for changelog generation'),
    })
    .describe('Release Manifest input');

const outputSchema = z
    .object({
        manifestPath: z.string().describe('Path to generated release-manifest.json'),
        version: z.string().describe('Release version'),
        gitSha: z.string().describe('Git SHA of release'),
        buildId: z.string().optional().describe('Worker Build ID'),
        certification: z.object({
            status: z.enum(['PASS', 'FAIL', 'UNKNOWN']).describe('Certification status'),
            reportPath: z.string().optional().describe('Path to report'),
        }).describe('Certification summary'),
        oscal: z.object({
            componentDefinitionPath: z.string().optional().describe('OSCAL file path'),
            controlsCovered: z.array(z.string()).optional().describe('NIST controls covered'),
        }).describe('OSCAL summary'),
        coverage: z.object({
            statements: z.number().optional().describe('Statement coverage %'),
            branches: z.number().optional().describe('Branch coverage %'),
            reportPath: z.string().optional().describe('Coverage report path'),
        }).optional().describe('Test coverage'),
        security: z.object({
            vulnerabilities: z.number().optional().describe('Vulnerability count'),
            secretLeaks: z.number().optional().describe('Secret leak count'),
            sbomPackages: z.number().optional().describe('SBOM package count'),
        }).optional().describe('Security summary'),
        featureFlags: z.object({
            flagdConfigPath: z.string().optional().describe('flagd config path'),
            releaseGate: z.string().optional().describe('Release gate flag key'),
            flagCount: z.number().optional().describe('Total flag count'),
        }).optional().describe('Feature flag summary'),
        changelog: z.array(changelogEntrySchema).optional().describe('Release changelog'),
        generatedAt: z.string().describe('Generation timestamp'),
    })
    .describe('Release Manifest output');

const configSchema = z
    .object({
        outputDir: z.string().optional().describe('Output directory for manifest'),
        includeFullArtifacts: z.boolean().optional().describe('Include full artifact content in manifest'),
    })
    .describe('Release Manifest configuration');

const secretsSchema = z
    .object({})
    .describe('Release Manifest secrets - none required');

export type ReleaseManifestInput = z.infer<typeof inputSchema>;
export type ReleaseManifestOutput = z.infer<typeof outputSchema>;
export type ReleaseManifestConfig = z.infer<typeof configSchema>;
export type ReleaseManifestSecrets = z.infer<typeof secretsSchema>;

export const releaseManifestCapability: Capability<
    ReleaseManifestInput,
    ReleaseManifestOutput,
    ReleaseManifestConfig,
    ReleaseManifestSecrets
> = {
    metadata: {
        id: 'golden.ci.release-manifest',
        domain: 'ci',
        version: '1.0.0',
        name: 'releaseManifest',
        description:
            'Bundle all release artifacts into a single manifest with certification, OSCAL, security scans, and flag definitions. Creates release-manifest.json for deployment.',
        tags: ['transformer', 'ci', 'compliance', 'release'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['ci:write'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: [], // Runs locally
        },
        oscalControlIds: ['CM-2', 'CM-3'], // Baseline config, config change control
    },
    operations: {
        isIdempotent: true,
        retryPolicy: { maxAttempts: 2, initialIntervalSeconds: 1, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('not found')) return 'FATAL';
            }
            return 'FATAL';
        },
        costFactor: 'LOW',
    },
    aiHints: {
        exampleInput: {
            operation: 'generate',
            version: '2.0.0',
            gitSha: 'abc123def456',
            certificationPath: 'dist/certification/CERTIFICATION.json',
            oscalPath: 'dist/oscal/component-definition.json',
            security: {
                trivyScanPath: 'dist/security/trivy.json',
                gitleaksScanPath: 'dist/security/gitleaks.json',
                sbomPath: 'dist/sbom/sbom.json',
            },
            flagsConfigPath: 'deploy/flagd/flags.json',
        },
        exampleOutput: {
            manifestPath: 'dist/release-manifest.json',
            version: '2.0.0',
            gitSha: 'abc123def456',
            buildId: 'v2.0.0',
            certification: {
                status: 'PASS',
                reportPath: 'dist/certification/CERTIFICATION.json',
            },
            oscal: {
                componentDefinitionPath: 'dist/oscal/component-definition.json',
                controlsCovered: ['AC-2', 'AU-2', 'CM-2', 'CM-3'],
            },
            security: {
                vulnerabilities: 0,
                secretLeaks: 0,
                sbomPackages: 245,
            },
            featureFlags: {
                flagdConfigPath: 'deploy/flagd/flags.json',
                releaseGate: 'release-2.0.0-enabled',
                flagCount: 15,
            },
            generatedAt: '2024-01-15T10:30:00Z',
        },
        usageNotes:
            'Generate after all CI checks pass. Include in GitHub release artifacts. The manifest provides a single source of truth for what was validated in this release.',
    },
    factory: (
        dag,
        context: CapabilityContext<ReleaseManifestConfig, ReleaseManifestSecrets>,
        input: ReleaseManifestInput
    ) => {
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = { container(): ContainerBuilder };
        const d = dag as unknown as DaggerClient;

        const outputDir = context.config.outputDir ?? 'dist';

        const payload = {
            operation: input.operation,
            version: input.version,
            gitSha: input.gitSha,
            buildId: input.buildId ?? `v${input.version}`,
            certificationPath: input.certificationPath,
            certificationStatus: input.certificationStatus,
            oscalPath: input.oscalPath,
            oscalControlsCovered: input.oscalControlsCovered,
            security: input.security,
            securitySummary: input.securitySummary,
            flagsConfigPath: input.flagsConfigPath,
            flagCount: input.flagCount,
            changelog: input.changelog,
            previousVersion: input.previousVersion,
            outputDir,
        };

        return d
            .container()
            .from('node:20-alpine')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('OPERATION', input.operation)
            .withEnvVariable('VERSION', input.version)
            .withExec([
                'sh',
                '-c',
                `
#!/bin/sh
set -e

apk add --no-cache jq git 2>/dev/null

INPUT_JSON='${JSON.stringify(payload)}'
OPERATION="${input.operation}"
VERSION="${input.version}"
OUTPUT_DIR="${outputDir}"
BUILD_ID="${input.buildId ?? `v${input.version}`}"
GIT_SHA="${input.gitSha ?? ''}"

# Get git SHA if not provided
if [ -z "$GIT_SHA" ]; then
  GIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
fi

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
MANIFEST_PATH="$OUTPUT_DIR/release-manifest.json"

mkdir -p "$OUTPUT_DIR"

# Parse certification status
CERT_STATUS="UNKNOWN"
CERT_PATH="${input.certificationPath ?? ''}"
CERT_STATUS_FALLBACK=$(echo "$INPUT_JSON" | jq -r '.certificationStatus // empty' 2>/dev/null || echo "")
if [ -n "$CERT_PATH" ] && [ -f "$CERT_PATH" ]; then
  CERT_STATUS=$(jq -r '.status // "UNKNOWN"' "$CERT_PATH" 2>/dev/null || echo "UNKNOWN")
elif [ -n "$CERT_STATUS_FALLBACK" ]; then
  CERT_STATUS="$CERT_STATUS_FALLBACK"
fi

# Parse OSCAL controls
OSCAL_PATH="${input.oscalPath ?? ''}"
OSCAL_CONTROLS="[]"
if [ -n "$OSCAL_PATH" ] && [ -f "$OSCAL_PATH" ]; then
  OSCAL_CONTROLS=$(jq '[.["component-definition"].components[].["control-implementations"][].["implemented-requirements"][]."control-id"] | unique' "$OSCAL_PATH" 2>/dev/null || echo "[]")
else
  OSCAL_CONTROLS_FALLBACK=$(echo "$INPUT_JSON" | jq -c '.oscalControlsCovered // empty' 2>/dev/null || echo "")
  if [ -n "$OSCAL_CONTROLS_FALLBACK" ]; then
    OSCAL_CONTROLS="$OSCAL_CONTROLS_FALLBACK"
  fi
fi

# Parse security results
TRIVY_PATH="${input.security?.trivyScanPath ?? ''}"
VULN_COUNT=0
if [ -n "$TRIVY_PATH" ] && [ -f "$TRIVY_PATH" ]; then
  VULN_COUNT=$(jq '[.Results[]?.Vulnerabilities[]?] | length' "$TRIVY_PATH" 2>/dev/null || echo 0)
else
  VULN_FALLBACK=$(echo "$INPUT_JSON" | jq -r '.securitySummary.vulnerabilities // empty' 2>/dev/null || echo "")
  if [ -n "$VULN_FALLBACK" ]; then
    VULN_COUNT="$VULN_FALLBACK"
  fi
fi

GITLEAKS_PATH="${input.security?.gitleaksScanPath ?? ''}"
SECRET_COUNT=0
if [ -n "$GITLEAKS_PATH" ] && [ -f "$GITLEAKS_PATH" ]; then
  SECRET_COUNT=$(jq 'length' "$GITLEAKS_PATH" 2>/dev/null || echo 0)
else
  SECRET_FALLBACK=$(echo "$INPUT_JSON" | jq -r '.securitySummary.secretLeaks // empty' 2>/dev/null || echo "")
  if [ -n "$SECRET_FALLBACK" ]; then
    SECRET_COUNT="$SECRET_FALLBACK"
  fi
fi

SBOM_PATH="${input.security?.sbomPath ?? ''}"
SBOM_PACKAGES=0
if [ -n "$SBOM_PATH" ] && [ -f "$SBOM_PATH" ]; then
  SBOM_PACKAGES=$(jq '.components | length' "$SBOM_PATH" 2>/dev/null || jq '.packages | length' "$SBOM_PATH" 2>/dev/null || echo 0)
else
  SBOM_FALLBACK=$(echo "$INPUT_JSON" | jq -r '.securitySummary.sbomPackages // empty' 2>/dev/null || echo "")
  if [ -n "$SBOM_FALLBACK" ]; then
    SBOM_PACKAGES="$SBOM_FALLBACK"
  fi
fi

# Parse flags config
FLAGS_PATH="${input.flagsConfigPath ?? ''}"
FLAG_COUNT=0
if [ -n "$FLAGS_PATH" ] && [ -f "$FLAGS_PATH" ]; then
  FLAG_COUNT=$(jq '.flags | length' "$FLAGS_PATH" 2>/dev/null || echo 0)
else
  FLAG_COUNT_FALLBACK=$(echo "$INPUT_JSON" | jq -r '.flagCount // empty' 2>/dev/null || echo "")
  if [ -n "$FLAG_COUNT_FALLBACK" ]; then
    FLAG_COUNT="$FLAG_COUNT_FALLBACK"
  fi
fi

# Generate release gate flag key
RELEASE_GATE="release-$VERSION-enabled"

# Generate changelog if not provided
CHANGELOG='${JSON.stringify(input.changelog ?? [])}'
if [ "$CHANGELOG" = "[]" ] && [ -n "${input.previousVersion ?? ''}" ]; then
  # Generate from git log
  CHANGELOG=$(git log --oneline ${input.previousVersion ?? ''}..HEAD 2>/dev/null | head -20 | jq -R -s 'split("\\n") | map(select(length > 0)) | map({type: "chore", description: .})' || echo "[]")
fi

# Build manifest
cat <<EOF > "$MANIFEST_PATH"
{
  "\\$schema": "schemas/release-manifest.schema.json",
  "version": "$VERSION",
  "gitSha": "$GIT_SHA",
  "buildId": "$BUILD_ID",
  "generatedAt": "$TIMESTAMP",
  "certification": {
    "status": "$CERT_STATUS",
    "reportPath": "$CERT_PATH"
  },
  "oscal": {
    "componentDefinitionPath": "$OSCAL_PATH",
    "controlsCovered": $OSCAL_CONTROLS
  },
  "coverage": {
    "statements": null,
    "branches": null,
    "reportPath": null
  },
  "security": {
    "vulnerabilityScanPath": "$TRIVY_PATH",
    "vulnerabilities": $VULN_COUNT,
    "secretScanPath": "$GITLEAKS_PATH",
    "secretLeaks": $SECRET_COUNT,
    "sbomPath": "$SBOM_PATH",
    "sbomPackages": $SBOM_PACKAGES
  },
  "featureFlags": {
    "flagdConfigPath": "$FLAGS_PATH",
    "releaseGate": "$RELEASE_GATE",
    "flagCount": $FLAG_COUNT
  },
  "changelog": $CHANGELOG
}
EOF

# Output result
cat <<EOF
{
  "manifestPath": "$MANIFEST_PATH",
  "version": "$VERSION",
  "gitSha": "$GIT_SHA",
  "buildId": "$BUILD_ID",
  "certification": {
    "status": "$CERT_STATUS",
    "reportPath": "$CERT_PATH"
  },
  "oscal": {
    "componentDefinitionPath": "$OSCAL_PATH",
    "controlsCovered": $OSCAL_CONTROLS
  },
  "security": {
    "vulnerabilities": $VULN_COUNT,
    "secretLeaks": $SECRET_COUNT,
    "sbomPackages": $SBOM_PACKAGES
  },
  "featureFlags": {
    "flagdConfigPath": "$FLAGS_PATH",
    "releaseGate": "$RELEASE_GATE",
    "flagCount": $FLAG_COUNT
  },
  "changelog": $CHANGELOG,
  "generatedAt": "$TIMESTAMP"
}
EOF
        `.trim(),
            ]);
    },
};
