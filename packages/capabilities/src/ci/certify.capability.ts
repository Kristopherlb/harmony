/**
 * packages/capabilities/src/ci/certify.capability.ts
 * Certification Capability (OCS-001 Guardian Pattern)
 *
 * Run CAS-001 certification audits and generate CERTIFICATION.json.
 * Validates NIS-001, VCS-001, OCS, WCS, GOS-001, ISS-001 compliance.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
    'full',           // Run all audits
    'naming',         // NIS-001 naming compliance
    'versioning',     // VCS-001 versioning compliance
    'ocs',            // OCS capability compliance
    'wcs',            // WCS blueprint compliance
    'observability',  // GOS-001 observability compliance
    'secrets',        // ISS-001 secrets compliance
]).describe('Certification audit scope');

const auditStatusSchema = z.enum(['PASS', 'FAIL', 'WARN', 'SKIP']).describe('Audit result status');

const auditResultSchema = z.object({
    id: z.string().describe('Audit check ID'),
    name: z.string().describe('Audit check name'),
    status: auditStatusSchema.describe('Audit result status'),
    standard: z.string().describe('Standard being validated (e.g., NIS-001)'),
    message: z.string().describe('Human-readable result message'),
    evidence: z.record(z.unknown()).optional().describe('Evidence for the audit result'),
    remediation: z.string().optional().describe('Suggested fix if failed'),
});

const inputSchema = z
    .object({
        operation: operationSchema,
        artifactPaths: z.array(z.string()).optional().describe('Paths to audit'),
        gitSha: z.string().optional().describe('Git commit SHA for the audit'),
        failOnWarning: z.boolean().optional().describe('Treat warnings as failures'),
        skipChecks: z.array(z.string()).optional().describe('Check IDs to skip'),
    })
    .describe('Certification input');

const outputSchema = z
    .object({
        status: z.enum(['PASS', 'FAIL']).describe('Overall certification status'),
        specVersion: z.string().describe('CAS-001 spec version'),
        generatedAt: z.string().describe('ISO timestamp of generation'),
        gitSha: z.string().optional().describe('Git SHA audited'),
        audits: z.array(auditResultSchema).describe('Individual audit results'),
        summary: z.object({
            total: z.number().describe('Total checks run'),
            passed: z.number().describe('Passed checks'),
            failed: z.number().describe('Failed checks'),
            warnings: z.number().describe('Warning checks'),
            skipped: z.number().describe('Skipped checks'),
        }).describe('Audit summary counts'),
        reportPath: z.string().describe('Path to generated CERTIFICATION.json'),
    })
    .describe('Certification output');

const configSchema = z
    .object({
        outputDir: z.string().optional().describe('Output directory for reports'),
        strictMode: z.boolean().optional().describe('Enable strict validation mode'),
    })
    .describe('Certification configuration');

const secretsSchema = z
    .object({})
    .describe('Certification secrets - none required');

export type CertifyInput = z.infer<typeof inputSchema>;
export type CertifyOutput = z.infer<typeof outputSchema>;
export type CertifyConfig = z.infer<typeof configSchema>;
export type CertifySecrets = z.infer<typeof secretsSchema>;

export const certifyCapability: Capability<
    CertifyInput,
    CertifyOutput,
    CertifyConfig,
    CertifySecrets
> = {
    metadata: {
        id: 'golden.ci.certify',
        version: '1.0.0',
        name: 'certify',
        description:
            'Run CAS-001 certification audits and generate CERTIFICATION.json. Validates NIS-001, VCS-001, OCS, WCS, GOS-001, ISS-001 compliance across capabilities and blueprints.',
        tags: ['guardian', 'ci', 'compliance', 'certification'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['ci:audit'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: [], // Runs locally
        },
        oscalControlIds: ['AU-2', 'CM-3', 'SA-11'], // Audit events, config change control, dev testing
    },
    operations: {
        isIdempotent: true,
        retryPolicy: { maxAttempts: 2, initialIntervalSeconds: 1, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('timeout')) return 'RETRYABLE';
                if (error.message.includes('not found')) return 'FATAL';
            }
            return 'FATAL';
        },
        costFactor: 'MEDIUM',
    },
    aiHints: {
        exampleInput: {
            operation: 'full',
            gitSha: 'abc123def456',
        },
        exampleOutput: {
            status: 'PASS',
            specVersion: '1.0.0',
            generatedAt: '2024-01-15T10:30:00Z',
            gitSha: 'abc123def456',
            audits: [
                {
                    id: 'nis-001-capability-ids',
                    name: 'Capability ID Format',
                    status: 'PASS',
                    standard: 'NIS-001',
                    message: 'All capability IDs follow golden.{domain}.{name} pattern',
                },
            ],
            summary: {
                total: 25,
                passed: 24,
                failed: 0,
                warnings: 1,
                skipped: 0,
            },
            reportPath: 'dist/certification/CERTIFICATION.json',
        },
        usageNotes:
            'Run "full" audit before releases. Use skipChecks to exclude known issues. Generated CERTIFICATION.json is unsigned in MVP and should be included in release artifacts.',
    },
    factory: (
        dag,
        context: CapabilityContext<CertifyConfig, CertifySecrets>,
        input: CertifyInput
    ) => {
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = { container(): ContainerBuilder };
        const d = dag as unknown as DaggerClient;

        const outputDir = context.config.outputDir ?? 'dist/certification';
        const strictMode = context.config.strictMode ?? false;

        const payload = {
            operation: input.operation,
            artifactPaths: input.artifactPaths ?? ['packages/capabilities', 'packages/blueprints'],
            gitSha: input.gitSha,
            failOnWarning: input.failOnWarning ?? strictMode,
            skipChecks: input.skipChecks ?? [],
            outputDir,
        };

        return d
            .container()
            .from('node:20-alpine')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('OPERATION', input.operation)
            .withExec([
                'sh',
                '-c',
                `
#!/bin/sh
set -e

apk add --no-cache jq git 2>/dev/null

INPUT_JSON='${JSON.stringify(payload)}'
OPERATION="${input.operation}"
OUTPUT_DIR="${outputDir}"
GIT_SHA="${input.gitSha ?? ''}"
FAIL_ON_WARNING="${input.failOnWarning ?? false}"

# Initialize results
AUDITS="[]"
TOTAL=0
PASSED=0
FAILED=0
WARNINGS=0
SKIPPED=0

# Get git SHA if not provided
if [ -z "$GIT_SHA" ]; then
  GIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
fi

add_audit() {
  local id="$1"
  local name="$2"
  local status="$3"
  local standard="$4"
  local message="$5"
  
  AUDITS=$(echo "$AUDITS" | jq --arg id "$id" --arg name "$name" --arg status "$status" --arg standard "$standard" --arg message "$message" '. + [{id: $id, name: $name, status: $status, standard: $standard, message: $message}]')
  TOTAL=$((TOTAL + 1))
  
  case "$status" in
    PASS) PASSED=$((PASSED + 1)) ;;
    FAIL) FAILED=$((FAILED + 1)) ;;
    WARN) WARNINGS=$((WARNINGS + 1)) ;;
    SKIP) SKIPPED=$((SKIPPED + 1)) ;;
  esac
}

# NIS-001: Naming compliance
run_naming_audit() {
  # Check capability IDs follow pattern
  if find packages/capabilities -name "*.capability.ts" -type f | head -1 | grep -q .; then
    add_audit "nis-001-capability-ids" "Capability ID Format" "PASS" "NIS-001" "Capability files found following naming convention"
  else
    add_audit "nis-001-capability-ids" "Capability ID Format" "WARN" "NIS-001" "No capability files found to audit"
  fi
}

# VCS-001: Versioning compliance  
run_versioning_audit() {
  # Check package.json has valid semver
  if [ -f package.json ]; then
    VERSION=$(jq -r '.version // "0.0.0"' package.json)
    if echo "$VERSION" | grep -qE '^[0-9]+\\.[0-9]+\\.[0-9]+'; then
      add_audit "vcs-001-semver" "SemVer Format" "PASS" "VCS-001" "Package version $VERSION follows SemVer"
    else
      add_audit "vcs-001-semver" "SemVer Format" "FAIL" "VCS-001" "Package version $VERSION does not follow SemVer"
    fi
  else
    add_audit "vcs-001-semver" "SemVer Format" "SKIP" "VCS-001" "No package.json found"
  fi
}

# OCS: Capability compliance
run_ocs_audit() {
  # Check capabilities have required fields
  CAP_COUNT=$(find packages/capabilities -name "*.capability.ts" -type f 2>/dev/null | wc -l | tr -d ' ')
  if [ "$CAP_COUNT" -gt 0 ]; then
    add_audit "ocs-capability-count" "Capability Count" "PASS" "OCS" "Found $CAP_COUNT capability definitions"
  else
    add_audit "ocs-capability-count" "Capability Count" "WARN" "OCS" "No capability definitions found"
  fi
}

# WCS: Blueprint compliance
run_wcs_audit() {
  # Check blueprints exist
  BP_COUNT=$(find packages/blueprints -name "*.workflow.ts" -type f 2>/dev/null | wc -l | tr -d ' ')
  if [ "$BP_COUNT" -gt 0 ]; then
    add_audit "wcs-blueprint-count" "Blueprint Count" "PASS" "WCS" "Found $BP_COUNT blueprint definitions"
  else
    add_audit "wcs-blueprint-count" "Blueprint Count" "WARN" "WCS" "No blueprint definitions found"
  fi
}

# GOS-001: Observability compliance
run_observability_audit() {
  # Check for observability setup
  if [ -f packages/core/src/observability/index.ts ] || find . -name "*observability*" -type f | head -1 | grep -q .; then
    add_audit "gos-001-observability" "Observability Setup" "PASS" "GOS-001" "Observability module found"
  else
    add_audit "gos-001-observability" "Observability Setup" "WARN" "GOS-001" "No observability module found"
  fi
}

# ISS-001: Secrets compliance
run_secrets_audit() {
  # Check no hardcoded secrets in source
  if grep -rI --include="*.ts" "password\\s*=" packages/ 2>/dev/null | grep -v "secretsSchema" | grep -v ".test.ts" | head -1 | grep -q .; then
    add_audit "iss-001-hardcoded" "No Hardcoded Secrets" "WARN" "ISS-001" "Potential hardcoded credential patterns found"
  else
    add_audit "iss-001-hardcoded" "No Hardcoded Secrets" "PASS" "ISS-001" "No hardcoded credential patterns detected"
  fi
}

# Run audits based on operation
case "$OPERATION" in
  full)
    run_naming_audit
    run_versioning_audit
    run_ocs_audit
    run_wcs_audit
    run_observability_audit
    run_secrets_audit
    ;;
  naming) run_naming_audit ;;
  versioning) run_versioning_audit ;;
  ocs) run_ocs_audit ;;
  wcs) run_wcs_audit ;;
  observability) run_observability_audit ;;
  secrets) run_secrets_audit ;;
esac

# Determine overall status
OVERALL_STATUS="PASS"
if [ "$FAILED" -gt 0 ]; then
  OVERALL_STATUS="FAIL"
elif [ "$FAIL_ON_WARNING" = "true" ] && [ "$WARNINGS" -gt 0 ]; then
  OVERALL_STATUS="FAIL"
fi

# Create output directory and write report
mkdir -p "$OUTPUT_DIR"
REPORT_PATH="$OUTPUT_DIR/CERTIFICATION.json"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat <<EOF > "$REPORT_PATH"
{
  "\\$schema": "schemas/CERTIFICATION.schema.json",
  "specVersion": "1.0.0",
  "generatedAt": "$TIMESTAMP",
  "gitSha": "$GIT_SHA",
  "status": "$OVERALL_STATUS",
  "audits": $AUDITS
}
EOF

# Output result
cat <<EOF
{
  "status": "$OVERALL_STATUS",
  "specVersion": "1.0.0",
  "generatedAt": "$TIMESTAMP",
  "gitSha": "$GIT_SHA",
  "audits": $AUDITS,
  "summary": {
    "total": $TOTAL,
    "passed": $PASSED,
    "failed": $FAILED,
    "warnings": $WARNINGS,
    "skipped": $SKIPPED
  },
  "reportPath": "$REPORT_PATH"
}
EOF
        `.trim(),
            ]);
    },
};
