/**
 * packages/capabilities/src/security/openvex.capability.ts
 * OpenVEX Capability (OCS-001 Transformer Pattern)
 *
 * Create and validate VEX (Vulnerability Exploitability eXchange) documents.
 * Mark vulnerabilities as "not affected" or "fixed" with justification.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
    'create',       // Create new VEX document
    'add-statement',// Add statement to existing VEX
    'merge',        // Merge multiple VEX documents
    'validate',     // Validate VEX document
    'filter-sbom',  // Filter SBOM vulnerabilities using VEX
]).describe('OpenVEX operation');

const statusSchema = z.enum([
    'not_affected',
    'affected',
    'fixed',
    'under_investigation',
]).describe('Vulnerability status');

const justificationSchema = z.enum([
    'component_not_present',
    'vulnerable_code_not_present',
    'vulnerable_code_not_in_execute_path',
    'vulnerable_code_cannot_be_controlled_by_adversary',
    'inline_mitigations_already_exist',
]).describe('Justification for not_affected status');

const statementSchema = z.object({
    vulnerability: z.string().describe('Vulnerability ID (CVE, GHSA, etc.)'),
    status: statusSchema.describe('Vulnerability status'),
    justification: justificationSchema.optional().describe('Justification (required for not_affected)'),
    impactStatement: z.string().optional().describe('Human-readable impact statement'),
    actionStatement: z.string().optional().describe('Recommended action'),
    products: z.array(z.string()).optional().describe('Product identifiers (PURLs)'),
});

const inputSchema = z
    .object({
        operation: operationSchema,
        author: z.string().optional().describe('VEX document author'),
        role: z.string().optional().describe('Author role'),
        statements: z.array(statementSchema).optional().describe('VEX statements'),
        vexPaths: z.array(z.string()).optional().describe('Paths to VEX documents'),
        sbomPath: z.string().optional().describe('Path to SBOM for filtering'),
        outputPath: z.string().optional().describe('Output file path'),
    })
    .describe('OpenVEX input');

const outputSchema = z
    .object({
        success: z.boolean().describe('Whether the operation succeeded'),
        operation: operationSchema.describe('Operation performed'),
        outputPath: z.string().optional().describe('Output file path'),
        statementCount: z.number().optional().describe('Number of statements in document'),
        statements: z.array(statementSchema).optional().describe('VEX statements'),
        validationErrors: z.array(z.string()).optional().describe('Validation errors'),
        filteredVulnerabilities: z.number().optional().describe('Vulnerabilities filtered from SBOM'),
        message: z.string().describe('Human-readable result message'),
    })
    .describe('OpenVEX output');

const configSchema = z
    .object({
        defaultAuthor: z.string().optional().describe('Default document author'),
        defaultRole: z.string().optional().describe('Default author role'),
    })
    .describe('OpenVEX configuration');

const secretsSchema = z.object({}).describe('OpenVEX secrets (none required)');

export type OpenVexInput = z.infer<typeof inputSchema>;
export type OpenVexOutput = z.infer<typeof outputSchema>;
export type OpenVexConfig = z.infer<typeof configSchema>;
export type OpenVexSecrets = z.infer<typeof secretsSchema>;

export const openvexCapability: Capability<
    OpenVexInput,
    OpenVexOutput,
    OpenVexConfig,
    OpenVexSecrets
> = {
    metadata: {
        id: 'golden.security.openvex',
        version: '1.0.0',
        name: 'openvex',
        description:
            'Create and validate VEX (Vulnerability Exploitability eXchange) documents. Document vulnerability exceptions and filter false positives from scans.',
        tags: ['transformer', 'security', 'vex', 'openssf', 'vulnerabilities'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['security:write'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: [], // Pure transformation, no network needed
        },
    },
    operations: {
        isIdempotent: true,
        retryPolicy: { maxAttempts: 2, initialIntervalSeconds: 1, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('not found')) return 'FATAL';
                if (error.message.includes('invalid')) return 'FATAL';
            }
            return 'FATAL';
        },
        costFactor: 'LOW',
    },
    aiHints: {
        exampleInput: {
            operation: 'create',
            author: 'security-team@example.com',
            role: 'Security Engineer',
            statements: [
                {
                    vulnerability: 'CVE-2024-1234',
                    status: 'not_affected',
                    justification: 'vulnerable_code_not_present',
                    impactStatement: 'The vulnerable function is not used in our codebase',
                    products: ['pkg:npm/@harmony/worker@2.0.0'],
                },
            ],
            outputPath: 'security/vex.json',
        },
        exampleOutput: {
            success: true,
            operation: 'create',
            outputPath: 'security/vex.json',
            statementCount: 1,
            message: 'Created VEX document with 1 statement',
        },
        usageNotes:
            'Use to document false positives and vulnerability exceptions. Apply VEX to SBOMs to filter known non-issues from vulnerability reports.',
    },
    factory: (
        dag,
        context: CapabilityContext<OpenVexConfig, OpenVexSecrets>,
        input: OpenVexInput
    ) => {
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = {
            container(): ContainerBuilder;
        };
        const d = dag as unknown as DaggerClient;

        const author = input.author ?? context.config.defaultAuthor ?? 'unknown';
        const role = input.role ?? context.config.defaultRole ?? 'Security Team';

        const payload = {
            operation: input.operation,
            author,
            role,
            statements: input.statements,
            vexPaths: input.vexPaths,
            sbomPath: input.sbomPath,
            outputPath: input.outputPath ?? 'vex.json',
        };

        const container = d
            .container()
            .from('ghcr.io/openvex/vexctl:latest')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('OPERATION', input.operation);

        return container.withExec([
            'sh',
            '-c',
            `
#!/bin/sh
set -e

OPERATION="${input.operation}"
OUTPUT_PATH="${payload.outputPath}"
AUTHOR="${author}"
ROLE="${role}"

SUCCESS=true
MESSAGE=""
STATEMENT_COUNT=0
STATEMENTS="[]"
VALIDATION_ERRORS="[]"
FILTERED_VULNS=0

case "$OPERATION" in
  create)
    STATEMENTS_JSON='${JSON.stringify(input.statements ?? [])}'
    STATEMENT_COUNT=$(echo "$STATEMENTS_JSON" | jq 'length')
    
    # Build vexctl create command
    vexctl create --author="$AUTHOR" --author-role="$ROLE" \\
      ${input.statements?.map(s => `--vuln="${s.vulnerability}" --status="${s.status}" ${s.justification ? `--justification="${s.justification}"` : ''}`).join(' \\\n      ') ?? ''} \\
      > "$OUTPUT_PATH" 2>/dev/null || {
      SUCCESS=false
      MESSAGE="Failed to create VEX document"
    }
    
    if [ "$SUCCESS" = "true" ]; then
      MESSAGE="Created VEX document with $STATEMENT_COUNT statements"
    fi
    ;;
    
  add-statement)
    VEX_PATH="${input.vexPaths?.[0] ?? ''}"
    if [ -z "$VEX_PATH" ]; then
      SUCCESS=false
      MESSAGE="VEX path required for add-statement"
    else
      STMT='${JSON.stringify(input.statements?.[0] ?? {})}'
      VULN=$(echo "$STMT" | jq -r '.vulnerability')
      STATUS=$(echo "$STMT" | jq -r '.status')
      
      vexctl add --in-place "$VEX_PATH" \\
        --vuln="$VULN" --status="$STATUS" 2>/dev/null || {
        SUCCESS=false
        MESSAGE="Failed to add statement"
      }
      
      if [ "$SUCCESS" = "true" ]; then
        cp "$VEX_PATH" "$OUTPUT_PATH"
        MESSAGE="Added statement to VEX document"
      fi
    fi
    ;;
    
  merge)
    VEX_PATHS="${input.vexPaths?.join(' ') ?? ''}"
    if [ -z "$VEX_PATHS" ]; then
      SUCCESS=false
      MESSAGE="VEX paths required for merge"
    else
      vexctl merge $VEX_PATHS > "$OUTPUT_PATH" 2>/dev/null || {
        SUCCESS=false
        MESSAGE="Failed to merge VEX documents"
      }
      
      if [ "$SUCCESS" = "true" ]; then
        STATEMENT_COUNT=$(jq '.statements | length' "$OUTPUT_PATH" 2>/dev/null || echo 0)
        MESSAGE="Merged VEX documents with $STATEMENT_COUNT statements"
      fi
    fi
    ;;
    
  validate)
    VEX_PATH="${input.vexPaths?.[0] ?? ''}"
    if [ -z "$VEX_PATH" ]; then
      SUCCESS=false
      MESSAGE="VEX path required for validation"
    else
      ERRORS=$(vexctl validate "$VEX_PATH" 2>&1) || {
        SUCCESS=false
        VALIDATION_ERRORS=$(echo "$ERRORS" | jq -Rs 'split("\n") | map(select(length > 0))')
      }
      
      if [ "$SUCCESS" = "true" ]; then
        MESSAGE="VEX document is valid"
      else
        MESSAGE="VEX validation failed"
      fi
    fi
    ;;
    
  filter-sbom)
    VEX_PATH="${input.vexPaths?.[0] ?? ''}"
    SBOM_PATH="${input.sbomPath ?? ''}"
    if [ -z "$VEX_PATH" ] || [ -z "$SBOM_PATH" ]; then
      SUCCESS=false
      MESSAGE="VEX and SBOM paths required for filter"
    else
      BEFORE=$(grype "$SBOM_PATH" -o json 2>/dev/null | jq '.matches | length' || echo 0)
      vexctl filter --vex="$VEX_PATH" "$SBOM_PATH" > "$OUTPUT_PATH" 2>/dev/null
      AFTER=$(grype "$OUTPUT_PATH" -o json 2>/dev/null | jq '.matches | length' || echo 0)
      FILTERED_VULNS=$((BEFORE - AFTER))
      MESSAGE="Filtered $FILTERED_VULNS vulnerabilities using VEX"
    fi
    ;;
    
  *)
    SUCCESS=false
    MESSAGE="Unknown operation: $OPERATION"
    ;;
esac

cat <<EOF
{
  "success": $SUCCESS,
  "operation": "$OPERATION",
  "outputPath": "$OUTPUT_PATH",
  "statementCount": $STATEMENT_COUNT,
  "statements": $STATEMENTS,
  "validationErrors": $VALIDATION_ERRORS,
  "filteredVulnerabilities": $FILTERED_VULNS,
  "message": "$MESSAGE"
}
EOF
        `.trim(),
        ]);
    },
};
