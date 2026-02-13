/**
 * packages/capabilities/src/security/security-insights.capability.ts
 * Security Insights Capability (OCS-001 Transformer Pattern)
 *
 * OpenSSF Security Insights - Parse and generate SECURITY-INSIGHTS.yml files.
 */
import { z } from '@golden/schema-registry';
import { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
  'parse',        // Parse SECURITY-INSIGHTS.yml
  'generate',     // Generate SECURITY-INSIGHTS.yml
  'validate',     // Validate existing file
]).describe('Security Insights operation');

const statusSchema = z.enum([
  'concept',
  'development',
  'active',
  'deprecated',
  'archived',
]).describe('Project status');

const inputSchema = z
  .object({
    operation: operationSchema,
    filePath: z.string().optional().describe('Path to SECURITY-INSIGHTS.yml'),
    fileContent: z.string().optional().describe('SECURITY-INSIGHTS.yml content'),
    projectName: z.string().optional().describe('Project name'),
    projectUrl: z.string().optional().describe('Project URL'),
    status: statusSchema.optional().describe('Project security status'),
    securityContacts: z.array(z.object({
      type: z.enum(['email', 'url']),
      value: z.string(),
    })).optional().describe('Security contacts'),
    vulnerabilityReporting: z.object({
      acceptsReports: z.boolean(),
      securityPolicy: z.string().optional(),
      bugBounty: z.boolean().optional(),
    }).optional().describe('Vulnerability reporting info'),
    dependencies: z.object({
      sbom: z.boolean().optional(),
      sbomUrl: z.string().optional(),
    }).optional().describe('Dependency information'),
  })
  .describe('Security Insights input');

const parsedInsightsSchema = z.object({
  schemaVersion: z.string().describe('Schema version'),
  projectName: z.string().describe('Project name'),
  projectUrl: z.string().optional().describe('Project URL'),
  projectStatus: statusSchema.describe('Project status'),
  securityContacts: z.array(z.object({
    type: z.string(),
    value: z.string(),
  })).describe('Security contacts'),
  vulnerabilityReporting: z.object({
    acceptsReports: z.boolean(),
    securityPolicy: z.string().optional(),
    bugBounty: z.boolean().optional(),
  }).optional().describe('Vulnerability reporting'),
  dependencies: z.object({
    sbom: z.boolean().optional(),
    sbomUrl: z.string().optional(),
  }).optional().describe('Dependencies'),
});

const outputSchema = z
  .object({
    success: z.boolean().describe('Whether the operation succeeded'),
    operation: operationSchema.describe('Operation performed'),
    parsed: parsedInsightsSchema.optional().describe('Parsed insights'),
    generated: z.string().optional().describe('Generated YAML content'),
    valid: z.boolean().optional().describe('Whether file is valid'),
    validationErrors: z.array(z.string()).optional().describe('Validation errors'),
    message: z.string().describe('Human-readable result message'),
  })
  .describe('Security Insights output');

const configSchema = z.object({}).describe('Security Insights configuration');
const secretsSchema = z.object({}).describe('Security Insights secrets');

export type SecurityInsightsInput = z.infer<typeof inputSchema>;
export type SecurityInsightsOutput = z.infer<typeof outputSchema>;
export type SecurityInsightsConfig = z.infer<typeof configSchema>;
export type SecurityInsightsSecrets = z.infer<typeof secretsSchema>;

export const securityInsightsCapability: Capability<
  SecurityInsightsInput,
  SecurityInsightsOutput,
  SecurityInsightsConfig,
  SecurityInsightsSecrets
> = {
  metadata: {
    id: 'golden.security.security-insights',
    domain: 'security',
    version: '1.0.0',
    name: 'securityInsights',
    description:
      'Parse and generate SECURITY-INSIGHTS.yml files following the OpenSSF Security Insights spec.',
    tags: ['transformer', 'security', 'openssf', 'compliance'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['security:read'],
    dataClassification: 'PUBLIC',
    networkAccess: {
      allowOutbound: [], // Pure transformation
    },
  },
  operations: {
    isIdempotent: true,
    retryPolicy: { maxAttempts: 2, initialIntervalSeconds: 1, backoffCoefficient: 2 },
    errorMap: () => 'FATAL',
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {
      operation: 'generate',
      projectName: 'harmony-platform',
      projectUrl: 'https://github.com/harmony-org/harmony',
      status: 'active',
      securityContacts: [
        { type: 'email', value: 'security@harmony.dev' },
      ],
      vulnerabilityReporting: {
        acceptsReports: true,
        securityPolicy: 'https://github.com/harmony-org/harmony/security/policy',
        bugBounty: false,
      },
    },
    exampleOutput: {
      success: true,
      operation: 'generate',
      generated: 'schema-version: 1.0.0\nproject-lifecycle:\n  status: active\n...',
      message: 'Generated SECURITY-INSIGHTS.yml',
    },
    usageNotes:
      'Generate SECURITY-INSIGHTS.yml to document your project security posture. Parse existing files to extract security metadata.',
  },
  factory: (
    dag,
    context: CapabilityContext<SecurityInsightsConfig, SecurityInsightsSecrets>,
    input: SecurityInsightsInput
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

    const payload = {
      operation: input.operation,
      filePath: input.filePath,
      fileContent: input.fileContent,
      projectName: input.projectName,
      projectUrl: input.projectUrl,
      status: input.status,
      securityContacts: input.securityContacts,
      vulnerabilityReporting: input.vulnerabilityReporting,
      dependencies: input.dependencies,
    };

    const container = d
      .container()
      .from('mikefarah/yq:latest')
      .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
      .withEnvVariable('OPERATION', input.operation);

    return container.withExec([
      'sh',
      '-c',
      `
#!/bin/sh
set -e

# jq is not in mikefarah/yq, install it
apk add --no-cache jq >/dev/null 2>&1 || true

OPERATION="${input.operation}"
SUCCESS=true
MESSAGE=""
PARSED="null"
GENERATED=""
VALID=""
VALIDATION_ERRORS="[]"

# Helper to read env input safely
get_input() {
  echo "$INPUT_JSON" | jq -r "$1 // empty"
}

case "$OPERATION" in
  generate)
    echo "$INPUT_JSON" | jq '{
      "schema-version": "1.0.0",
      "project-lifecycle": { status: (.status // "active") },
      "project-metadata": { 
          name: (.projectName // "unknown"), 
          url: (.projectUrl // null) 
      } | del(.[] | select(. == null)),
      "security-contacts": (.securityContacts // [{type: "email", value: "security@example.com"}]),
      "vulnerability-reporting": {
          "accepts-vulnerability-reports": (.vulnerabilityReporting.acceptsReports // true),
          "security-policy": (.vulnerabilityReporting.securityPolicy // null),
          "bug-bounty-program": (.vulnerabilityReporting.bugBounty // null)
      } | del(.[] | select(. == null)),
      dependencies: (if .dependencies then {
          "sbom-available": (.dependencies.sbom // false),
          "sbom-url": (.dependencies.sbomUrl // null)
      } | del(.[] | select(. == null)) else null end)
    } | del(.[] | select(. == null))' > /tmp/formatted.json
    
    yq -P '.' /tmp/formatted.json > /tmp/insights.yml
    
    GENERATED=$(cat /tmp/insights.yml)
    MESSAGE="Generated SECURITY-INSIGHTS.yml"
    ;;
    
  parse)
    INPUT_CONTENT=$(echo "$INPUT_JSON" | jq -r '.fileContent // empty')
    INPUT_PATH=$(echo "$INPUT_JSON" | jq -r '.filePath // empty')
    
    if [ -n "$INPUT_CONTENT" ]; then
      echo "$INPUT_CONTENT" > /tmp/insights.yml
    elif [ -n "$INPUT_PATH" ] && [ -f "$INPUT_PATH" ]; then
      cp "$INPUT_PATH" /tmp/insights.yml
    else
      SUCCESS=false
      MESSAGE="File content or path required"
    fi
    
    if [ "$SUCCESS" = "true" ]; then
      yq -o=json '.' /tmp/insights.yml > /tmp/parsed.json 2>/dev/null || SUCCESS=false
      
      if [ "$SUCCESS" = "true" ]; then
        PARSED=$(jq '{
          schemaVersion: (.["schema-version"] // "1.0.0"),
          projectName: (.["project-metadata"].name // "unknown"),
          projectUrl: (.["project-metadata"].url // null),
          projectStatus: (.["project-lifecycle"].status // "active"),
          securityContacts: (.["security-contacts"] // []),
          vulnerabilityReporting: {
            acceptsReports: (.["vulnerability-reporting"]["accepts-vulnerability-reports"] // true),
            securityPolicy: (.["vulnerability-reporting"]["security-policy"] // null),
            bugBounty: (.["vulnerability-reporting"]["bug-bounty-program"] // null)
          },
          dependencies: (if .dependencies then {
            sbom: (.dependencies["sbom-available"] // false),
            sbomUrl: (.dependencies["sbom-url"] // null)
          } else null end)
        } | del(.. | select(. == null))' /tmp/parsed.json)
        
        MESSAGE="Parsed SECURITY-INSIGHTS.yml"
      else
        MESSAGE="Failed to parse YAML"
      fi
    fi
    ;;
    
  validate)
    INPUT_PATH=$(echo "$INPUT_JSON" | jq -r '.filePath // empty')
    
    if [ -n "$INPUT_PATH" ] && [ -f "$INPUT_PATH" ]; then
      if yq -e '.["schema-version"]' "$INPUT_PATH" >/dev/null 2>&1; then
        VALID=true
        MESSAGE="SECURITY-INSIGHTS.yml is valid"
      else
        VALID=false
        VALIDATION_ERRORS='["Missing schema-version field"]'
        MESSAGE="Validation failed"
      fi
    else
      SUCCESS=false
      MESSAGE="File path required"
    fi
    ;;
    
  *)
    SUCCESS=false
    MESSAGE="Unknown operation: $OPERATION"
    ;;
esac

GENERATED_JSON=$(echo "$GENERATED" | jq -Rs . 2>/dev/null || echo '""')

cat <<EOF
{
  "success": $SUCCESS,
  "operation": "$OPERATION",
  "parsed": $PARSED,
  "generated": $GENERATED_JSON,
  "valid": \${VALID:-null},
  "validationErrors": $VALIDATION_ERRORS,
  "message": "$MESSAGE"
}
EOF
            `.trim(),
    ]);
  },
};
