/**
 * packages/capabilities/src/security/security-insights.capability.ts
<<<<<<< ours
 * Security Insights Capability (OCS-001 Commander Pattern)
 *
 * OpenSSF Security Insights for parsing and generating SECURITY-INSIGHTS.yml files.
=======
 * Security Insights Capability (OCS-001 Transformer Pattern)
 *
 * OpenSSF Security Insights - Parse and generate SECURITY-INSIGHTS.yml files.
>>>>>>> theirs
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
<<<<<<< ours
    'parse',
    'validate',
    'generate',
    'get-contacts',
    'get-policy',
]).describe('Security Insights operation');

=======
    'parse',        // Parse SECURITY-INSIGHTS.yml
    'generate',     // Generate SECURITY-INSIGHTS.yml
    'validate',     // Validate existing file
    'update',       // Update existing file
]).describe('Security Insights operation');

const statusSchema = z.enum([
    'active',
    'inactive',
    'deprecated',
]).describe('Project status');

>>>>>>> theirs
const inputSchema = z
    .object({
        operation: operationSchema,
        filePath: z.string().optional().describe('Path to SECURITY-INSIGHTS.yml'),
<<<<<<< ours
        repoUrl: z.string().optional().describe('Repository URL to fetch from'),
        outputPath: z.string().optional().describe('Output path for generation'),
        contacts: z.array(z.object({
            type: z.enum(['email', 'url']),
            value: z.string(),
            primary: z.boolean().optional(),
        })).optional().describe('Security contacts for generation'),
        vulnerabilityPolicy: z.object({
            reportingUrl: z.string().optional(),
            reportingEmail: z.string().optional(),
            pgpKey: z.string().optional(),
        }).optional().describe('Vulnerability reporting policy'),
    })
    .describe('Security Insights input');

const contactSchema = z.object({
    type: z.enum(['email', 'url']),
    value: z.string(),
    primary: z.boolean().optional(),
});

const policySchema = z.object({
    reportingUrl: z.string().optional(),
    reportingEmail: z.string().optional(),
    pgpKey: z.string().optional(),
    bugBounty: z.boolean().optional(),
    disclosureDeadline: z.number().optional(),
});

const insightsSchema = z.object({
    version: z.string(),
    contacts: z.array(contactSchema),
    vulnerabilityPolicy: policySchema.optional(),
    securityAssessments: z.array(z.string()).optional(),
    securityTools: z.array(z.string()).optional(),
=======
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
>>>>>>> theirs
});

const outputSchema = z
    .object({
        success: z.boolean().describe('Whether the operation succeeded'),
        operation: operationSchema.describe('Operation performed'),
<<<<<<< ours
        insights: insightsSchema.optional().describe('Parsed security insights'),
        contacts: z.array(contactSchema).optional().describe('Security contacts'),
        policy: policySchema.optional().describe('Vulnerability policy'),
        valid: z.boolean().optional().describe('Validation result'),
        validationErrors: z.array(z.string()).optional().describe('Validation errors'),
        outputPath: z.string().optional().describe('Generated file path'),
=======
        parsed: parsedInsightsSchema.optional().describe('Parsed insights'),
        generated: z.string().optional().describe('Generated YAML content'),
        valid: z.boolean().optional().describe('Whether file is valid'),
        validationErrors: z.array(z.string()).optional().describe('Validation errors'),
        outputPath: z.string().optional().describe('Output file path'),
>>>>>>> theirs
        message: z.string().describe('Human-readable result message'),
    })
    .describe('Security Insights output');

<<<<<<< ours
const configSchema = z
    .object({})
    .describe('Security Insights configuration');

const secretsSchema = z
    .object({
        githubToken: z.string().optional().describe('GitHub token for fetching'),
    })
    .describe('Security Insights secrets');
=======
const configSchema = z.object({}).describe('Security Insights configuration');
const secretsSchema = z.object({}).describe('Security Insights secrets');
>>>>>>> theirs

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
        version: '1.0.0',
        name: 'securityInsights',
        description:
<<<<<<< ours
            'OpenSSF Security Insights for SECURITY-INSIGHTS.yml management. Parse, validate, and generate security metadata files.',
        tags: ['commander', 'security', 'metadata', 'openssf'],
=======
            'Parse and generate SECURITY-INSIGHTS.yml files following the OpenSSF Security Insights spec.',
        tags: ['transformer', 'security', 'openssf', 'compliance'],
>>>>>>> theirs
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
<<<<<<< ours
            allowOutbound: ['github.com', 'raw.githubusercontent.com'],
=======
            allowOutbound: [], // Pure transformation
>>>>>>> theirs
        },
    },
    operations: {
        isIdempotent: true,
        retryPolicy: { maxAttempts: 2, initialIntervalSeconds: 1, backoffCoefficient: 2 },
<<<<<<< ours
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('parse')) return 'FATAL';
            }
            return 'FATAL';
        },
=======
        errorMap: () => 'FATAL',
>>>>>>> theirs
        costFactor: 'LOW',
    },
    aiHints: {
        exampleInput: {
<<<<<<< ours
            operation: 'parse',
            repoUrl: 'https://github.com/openssf/scorecard',
        },
        exampleOutput: {
            success: true,
            operation: 'parse',
            insights: {
                version: '1.0.0',
                contacts: [
                    { type: 'email', value: 'security@openssf.org', primary: true },
                ],
                vulnerabilityPolicy: {
                    reportingUrl: 'https://github.com/openssf/scorecard/security/advisories',
                },
            },
            message: 'Parsed security insights from repository',
        },
        usageNotes:
            'Use parse to extract security metadata from repositories. Use generate to create SECURITY-INSIGHTS.yml for your project. Use validate to check file compliance.',
=======
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
>>>>>>> theirs
    },
    factory: (
        dag,
        context: CapabilityContext<SecurityInsightsConfig, SecurityInsightsSecrets>,
        input: SecurityInsightsInput
    ) => {
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
<<<<<<< ours
            withMountedSecret(path: string, secret: unknown): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = { container(): ContainerBuilder };
        const d = dag as unknown as DaggerClient;

        let container = d
            .container()
            .from('alpine:3.19')
            .withEnvVariable('OPERATION', input.operation);

        if (context.secretRefs.githubToken) {
            container = container.withMountedSecret('/run/secrets/github_token', context.secretRefs.githubToken);
        }

        if (input.filePath) {
            container = container.withEnvVariable('FILE_PATH', input.filePath);
        }
        if (input.repoUrl) {
            container = container.withEnvVariable('REPO_URL', input.repoUrl);
        }
        if (input.outputPath) {
            container = container.withEnvVariable('OUTPUT_PATH', input.outputPath);
        }
        if (input.contacts) {
            container = container.withEnvVariable('CONTACTS', JSON.stringify(input.contacts));
        }
        if (input.vulnerabilityPolicy) {
            container = container.withEnvVariable('VULN_POLICY', JSON.stringify(input.vulnerabilityPolicy));
        }

=======
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

>>>>>>> theirs
        return container.withExec([
            'sh',
            '-c',
            `
#!/bin/sh
set -e

<<<<<<< ours
apk add --no-cache curl yq jq >/dev/null 2>&1

OPERATION="$OPERATION"
SUCCESS=true
MESSAGE=""
INSIGHTS="null"
CONTACTS="[]"
POLICY="null"
VALID=""
VALIDATION_ERRORS="[]"
OUTPUT_PATH_OUT=""

# Load GitHub token if available
if [ -f /run/secrets/github_token ]; then
  export GITHUB_TOKEN=$(cat /run/secrets/github_token)
fi

case "$OPERATION" in
  parse)
    if [ -n "$FILE_PATH" ]; then
      # Parse from local file
      if [ -f "$FILE_PATH" ]; then
        INSIGHTS=$(yq -o=json "$FILE_PATH" 2>/dev/null || echo "null")
      else
        SUCCESS=false
        MESSAGE="File not found: $FILE_PATH"
      fi
    elif [ -n "$REPO_URL" ]; then
      # Fetch from repository
      OWNER=$(echo "$REPO_URL" | sed -n 's|.*/\\([^/]*\\)/[^/]*$|\\1|p')
      REPO=$(echo "$REPO_URL" | sed -n 's|.*/\\([^/]*\\)$|\\1|p')
      
      AUTH_HEADER=""
      if [ -n "$GITHUB_TOKEN" ]; then
        AUTH_HEADER="-H 'Authorization: token $GITHUB_TOKEN'"
      fi
      
      RAW_URL="https://raw.githubusercontent.com/$OWNER/$REPO/main/SECURITY-INSIGHTS.yml"
      CONTENT=$(curl -sL $AUTH_HEADER "$RAW_URL" 2>/dev/null || echo "")
      
      if [ -n "$CONTENT" ] && [ "$CONTENT" != "404: Not Found" ]; then
        INSIGHTS=$(echo "$CONTENT" | yq -o=json 2>/dev/null || echo "null")
        MESSAGE="Parsed security insights from repository"
      else
        SUCCESS=false
        MESSAGE="SECURITY-INSIGHTS.yml not found in repository"
      fi
    fi
    
    if [ "$SUCCESS" = "true" ] && [ "$INSIGHTS" != "null" ]; then
      CONTACTS=$(echo "$INSIGHTS" | jq '.contacts // []' 2>/dev/null || echo "[]")
      POLICY=$(echo "$INSIGHTS" | jq '.vulnerabilityPolicy // null' 2>/dev/null || echo "null")
      MESSAGE="Parsed security insights successfully"
    fi
    ;;
    
  validate)
    FILE="$FILE_PATH"
    if [ ! -f "$FILE" ]; then
      SUCCESS=false
      MESSAGE="File not found"
    else
      CONTENT=$(yq -o=json "$FILE" 2>&1) && VALID=true || VALID=false
      
      if [ "$VALID" = "true" ]; then
        # Check required fields
        VERSION=$(echo "$CONTENT" | jq -r '.version // empty' 2>/dev/null)
        CONTACTS_CHECK=$(echo "$CONTENT" | jq '.contacts | length' 2>/dev/null || echo "0")
        
        ERRORS=""
        if [ -z "$VERSION" ]; then
          ERRORS="$ERRORS Missing required field: version."
        fi
        if [ "$CONTACTS_CHECK" = "0" ]; then
          ERRORS="$ERRORS At least one contact required."
        fi
        
        if [ -n "$ERRORS" ]; then
          VALID=false
          VALIDATION_ERRORS=$(echo "$ERRORS" | jq -Rs 'split(". ") | map(select(length > 0))' 2>/dev/null || echo "[]")
          MESSAGE="Validation failed"
        else
          MESSAGE="Security insights file is valid"
        fi
      else
        MESSAGE="YAML parsing failed"
        VALIDATION_ERRORS='["Invalid YAML format"]'
      fi
    fi
    ;;
    
  generate)
    OUTPUT="$OUTPUT_PATH"
    CONTACTS_INPUT="\${CONTACTS:-[]}"
    POLICY_INPUT="\${VULN_POLICY:-{}}"
    
    cat > "$OUTPUT" << YAML
# SECURITY-INSIGHTS.yml
# https://github.com/ossf/security-insights-spec
schema-version: 1.0.0

project-info:
  name: ""
  
contacts:
$(echo "$CONTACTS_INPUT" | jq -r '.[] | "  - type: \\(.type)\\n    value: \\(.value)"' 2>/dev/null || echo "  - type: email\\n    value: security@example.com")

vulnerability-reporting:
  policy-url: $(echo "$POLICY_INPUT" | jq -r '.reportingUrl // ""' 2>/dev/null)
  email: $(echo "$POLICY_INPUT" | jq -r '.reportingEmail // ""' 2>/dev/null)
YAML
    
    OUTPUT_PATH_OUT="$OUTPUT"
    MESSAGE="Generated SECURITY-INSIGHTS.yml"
    ;;
    
  get-contacts)
    FILE="$FILE_PATH"
    if [ -f "$FILE" ]; then
      CONTACTS=$(yq -o=json '.contacts' "$FILE" 2>/dev/null || echo "[]")
      MESSAGE="Retrieved security contacts"
    else
      SUCCESS=false
      MESSAGE="File not found"
    fi
    ;;
    
  get-policy)
    FILE="$FILE_PATH"
    if [ -f "$FILE" ]; then
      POLICY=$(yq -o=json '.vulnerabilityPolicy // .vulnerability-reporting' "$FILE" 2>/dev/null || echo "null")
      MESSAGE="Retrieved vulnerability policy"
    else
      SUCCESS=false
      MESSAGE="File not found"
=======
OPERATION="${input.operation}"

SUCCESS=true
MESSAGE=""
PARSED="null"
GENERATED=""
VALID=""
VALIDATION_ERRORS="[]"

case "$OPERATION" in
  generate)
    PROJECT_NAME="${input.projectName ?? 'unknown'}"
    PROJECT_URL="${input.projectUrl ?? ''}"
    STATUS="${input.status ?? 'active'}"
    
    cat > /tmp/insights.yml << 'YAML'
schema-version: "1.0.0"
project-lifecycle:
  status: ${input.status ?? 'active'}
  
project-metadata:
  name: ${input.projectName ?? 'unknown'}
${input.projectUrl ? `  url: ${input.projectUrl}` : ''}

security-contacts:
${input.securityContacts?.map(c => `  - type: ${c.type}
    value: ${c.value}`).join('\n') ?? '  - type: email\n    value: security@example.com'}

vulnerability-reporting:
  accepts-vulnerability-reports: ${input.vulnerabilityReporting?.acceptsReports ?? true}
${input.vulnerabilityReporting?.securityPolicy ? `  security-policy: ${input.vulnerabilityReporting.securityPolicy}` : ''}
${input.vulnerabilityReporting?.bugBounty !== undefined ? `  bug-bounty-program: ${input.vulnerabilityReporting.bugBounty}` : ''}

${input.dependencies ? `dependencies:
  sbom-available: ${input.dependencies.sbom ?? false}
${input.dependencies.sbomUrl ? `  sbom-url: ${input.dependencies.sbomUrl}` : ''}` : ''}
YAML

    GENERATED=$(cat /tmp/insights.yml)
    MESSAGE="Generated SECURITY-INSIGHTS.yml"
    ;;
    
  parse)
    if [ -n "${input.fileContent ?? ''}" ]; then
      echo '${(input.fileContent ?? '').replace(/'/g, "'\\''")}' > /tmp/insights.yml
    elif [ -n "${input.filePath ?? ''}" ] && [ -f "${input.filePath}" ]; then
      cp "${input.filePath}" /tmp/insights.yml
    else
      SUCCESS=false
      MESSAGE="File content or path required"
    fi
    
    if [ "$SUCCESS" = "true" ]; then
      SCHEMA_VER=$(yq '.schema-version' /tmp/insights.yml)
      PROJECT=$(yq '.project-metadata.name' /tmp/insights.yml)
      STATUS=$(yq '.project-lifecycle.status' /tmp/insights.yml)
      
      PARSED=$(cat <<PJSON
{
  "schemaVersion": "$SCHEMA_VER",
  "projectName": "$PROJECT",
  "projectStatus": "$STATUS",
  "securityContacts": []
}
PJSON
)
      MESSAGE="Parsed SECURITY-INSIGHTS.yml"
    fi
    ;;
    
  validate)
    if [ -n "${input.filePath ?? ''}" ] && [ -f "${input.filePath}" ]; then
      # Basic validation
      SCHEMA_VER=$(yq '.schema-version' "${input.filePath}" 2>/dev/null || echo "")
      if [ -z "$SCHEMA_VER" ]; then
        VALID=false
        VALIDATION_ERRORS='["Missing schema-version field"]'
        MESSAGE="Validation failed"
      else
        VALID=true
        MESSAGE="SECURITY-INSIGHTS.yml is valid"
      fi
    else
      SUCCESS=false
      MESSAGE="File path required"
>>>>>>> theirs
    fi
    ;;
    
  *)
    SUCCESS=false
    MESSAGE="Unknown operation: $OPERATION"
    ;;
esac

<<<<<<< ours
=======
# Escape for JSON
GENERATED_JSON=$(echo "$GENERATED" | jq -Rs . 2>/dev/null || echo '""')

>>>>>>> theirs
cat <<EOF
{
  "success": $SUCCESS,
  "operation": "$OPERATION",
<<<<<<< ours
  "insights": $INSIGHTS,
  "contacts": $CONTACTS,
  "policy": $POLICY,
  "valid": \${VALID:-null},
  "validationErrors": $VALIDATION_ERRORS,
  "outputPath": "$OUTPUT_PATH_OUT",
  "message": "$MESSAGE"
}
EOF
        `.trim(),
=======
  "parsed": $PARSED,
  "generated": $GENERATED_JSON,
  "valid": \${VALID:-null},
  "validationErrors": $VALIDATION_ERRORS,
  "message": "$MESSAGE"
}
EOF
    `.trim(),
>>>>>>> theirs
        ]);
    },
};
