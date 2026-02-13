/**
 * packages/capabilities/src/security/checkov.capability.ts
 * Checkov Capability (OCS-001 Guardian Pattern)
 *
 * Infrastructure-as-Code security scanning for Terraform, CloudFormation,
 * Kubernetes, and other IaC configurations.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
    'scan',           // Scan IaC files
    'scan-plan',      // Scan Terraform plan JSON
    'list-checks',    // List available checks
]).describe('Checkov operation');

const frameworkSchema = z.enum([
    'terraform',
    'terraform_plan',
    'cloudformation',
    'kubernetes',
    'helm',
    'dockerfile',
    'arm',
    'bicep',
    'serverless',
    'all',
]).describe('IaC framework to scan');

const severitySchema = z.enum(['critical', 'high', 'medium', 'low']).describe('Check severity');

const inputSchema = z
    .object({
        operation: operationSchema,
        directory: z.string().optional().describe('Directory to scan'),
        file: z.string().optional().describe('Single file to scan'),
        planFile: z.string().optional().describe('Terraform plan JSON file'),
        framework: frameworkSchema.optional().describe('Framework to scan, defaults to all'),
        checks: z.array(z.string()).optional().describe('Specific checks to run (e.g., CKV_AWS_1)'),
        skipChecks: z.array(z.string()).optional().describe('Checks to skip'),
        softFail: z.boolean().optional().describe('Return success even if checks fail'),
        compactOutput: z.boolean().optional().describe('Compact output format'),
        externalChecksDir: z.string().optional().describe('Directory with custom checks'),
    })
    .describe('Checkov input');

const checkResultSchema = z.object({
    checkId: z.string().describe('Check ID (e.g., CKV_AWS_1)'),
    checkName: z.string().describe('Check name'),
    checkResult: z.enum(['passed', 'failed', 'skipped']).describe('Check result'),
    severity: severitySchema.optional().describe('Check severity'),
    resourceAddress: z.string().optional().describe('Resource address'),
    resourceType: z.string().optional().describe('Resource type'),
    file: z.string().optional().describe('File path'),
    line: z.number().optional().describe('Line number'),
    guideline: z.string().optional().describe('Remediation guideline'),
});

const outputSchema = z
    .object({
        success: z.boolean().describe('Whether the scan passed'),
        operation: operationSchema.describe('Operation performed'),
        passed: z.number().describe('Number of passed checks'),
        failed: z.number().describe('Number of failed checks'),
        skipped: z.number().describe('Number of skipped checks'),
        results: z.array(checkResultSchema).optional().describe('Check results'),
        failedChecks: z.array(checkResultSchema).optional().describe('Failed checks only'),
        framework: frameworkSchema.optional().describe('Framework scanned'),
        scanDuration: z.number().optional().describe('Scan duration in milliseconds'),
        message: z.string().describe('Human-readable result message'),
    })
    .describe('Checkov output');

const configSchema = z
    .object({
        defaultFramework: frameworkSchema.optional().describe('Default framework'),
        defaultSkipChecks: z.array(z.string()).optional().describe('Default checks to skip'),
        externalChecksDir: z.string().optional().describe('Default external checks directory'),
    })
    .describe('Checkov configuration');

const secretsSchema = z
    .object({
        bcApiKey: z.string().optional().describe('Bridgecrew API key for enhanced scanning'),
    })
    .describe('Checkov secrets');

export type CheckovInput = z.infer<typeof inputSchema>;
export type CheckovOutput = z.infer<typeof outputSchema>;
export type CheckovConfig = z.infer<typeof configSchema>;
export type CheckovSecrets = z.infer<typeof secretsSchema>;

export const checkovCapability: Capability<
    CheckovInput,
    CheckovOutput,
    CheckovConfig,
    CheckovSecrets
> = {
    metadata: {
        id: 'golden.security.checkov',
        domain: 'security',
        version: '1.0.0',
        name: 'checkov',
        description:
            'Infrastructure-as-Code security scanning. Detect misconfigurations in Terraform, CloudFormation, Kubernetes, Helm, and Dockerfiles.',
        tags: ['guardian', 'security', 'iac', 'terraform', 'kubernetes'],
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
                'www.bridgecrew.cloud', // For BC API
                'raw.githubusercontent.com', // For check updates
            ],
        },
        oscalControlIds: ['CM-6', 'CM-7'], // Config management, least functionality
    },
    operations: {
        isIdempotent: true,
        retryPolicy: { maxAttempts: 2, initialIntervalSeconds: 5, backoffCoefficient: 2 },
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
            operation: 'scan',
            directory: 'deploy/terraform',
            framework: 'terraform',
            softFail: true,
        },
        exampleOutput: {
            success: true,
            operation: 'scan',
            passed: 45,
            failed: 3,
            skipped: 2,
            failedChecks: [
                {
                    checkId: 'CKV_AWS_20',
                    checkName: 'Ensure S3 bucket has versioning enabled',
                    checkResult: 'failed',
                    severity: 'medium',
                    resourceAddress: 'aws_s3_bucket.logs',
                    file: 'main.tf',
                    line: 42,
                },
            ],
            framework: 'terraform',
            scanDuration: 5200,
            message: 'Scan completed: 45 passed, 3 failed, 2 skipped',
        },
        usageNotes:
            'Run before terraform apply to catch misconfigurations. Use skipChecks for known exceptions. Use softFail in CI to report without blocking.',
    },
    factory: (
        dag,
        context: CapabilityContext<CheckovConfig, CheckovSecrets>,
        input: CheckovInput
    ) => {
        type DaggerSecret = unknown;
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withMountedSecret(path: string, secret: DaggerSecret): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = {
            container(): ContainerBuilder;
        };
        const d = dag as unknown as DaggerClient;

        const framework = input.framework ?? context.config.defaultFramework ?? 'all';
        const skipChecks = input.skipChecks ?? context.config.defaultSkipChecks ?? [];

        const payload = {
            operation: input.operation,
            directory: input.directory,
            file: input.file,
            planFile: input.planFile,
            framework,
            checks: input.checks,
            skipChecks,
            softFail: input.softFail ?? false,
            compactOutput: input.compactOutput ?? false,
        };

        let container = d
            .container()
            .from('bridgecrew/checkov:latest')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('OPERATION', input.operation);

        if (context.secretRefs.bcApiKey) {
            container = container.withMountedSecret(
                '/run/secrets/bc_api_key',
                context.secretRefs.bcApiKey as unknown as DaggerSecret
            );
        }

        return container.withExec([
            'sh',
            '-c',
            `
#!/bin/sh
set -e

OPERATION="${input.operation}"
DIRECTORY="${input.directory ?? '.'}"
FILE="${input.file ?? ''}"
PLAN_FILE="${input.planFile ?? ''}"
FRAMEWORK="${framework}"
SOFT_FAIL="${input.softFail ?? false}"
START_TIME=$(date +%s%3N)

# Build BC API key env if provided
if [ -f /run/secrets/bc_api_key ]; then
  export BC_API_KEY=$(cat /run/secrets/bc_api_key)
fi

SUCCESS=true
PASSED=0
FAILED=0
SKIPPED=0
RESULTS="[]"
FAILED_CHECKS="[]"

case "$OPERATION" in
  scan)
    ARGS="-o json"
    
    if [ -n "$FILE" ]; then
      ARGS="$ARGS -f $FILE"
    else
      ARGS="$ARGS -d $DIRECTORY"
    fi
    
    if [ "$FRAMEWORK" != "all" ]; then
      ARGS="$ARGS --framework $FRAMEWORK"
    fi
    
    ${input.checks?.length ? `ARGS="$ARGS --check ${input.checks.join(',')}"` : ''}
    ${skipChecks.length ? `ARGS="$ARGS --skip-check ${skipChecks.join(',')}"` : ''}
    
    set +e
    OUTPUT=$(checkov $ARGS 2>/dev/null)
    EXIT_CODE=$?
    set -e
    
    PASSED=$(echo "$OUTPUT" | jq '[.results.passed_checks[]?] | length' 2>/dev/null || echo 0)
    FAILED=$(echo "$OUTPUT" | jq '[.results.failed_checks[]?] | length' 2>/dev/null || echo 0)
    SKIPPED=$(echo "$OUTPUT" | jq '[.results.skipped_checks[]?] | length' 2>/dev/null || echo 0)
    
    FAILED_CHECKS=$(echo "$OUTPUT" | jq '[.results.failed_checks[]? | {
      checkId: .check_id,
      checkName: .check.name,
      checkResult: "failed",
      severity: .severity,
      resourceAddress: .resource_address,
      resourceType: .resource,
      file: .file_path,
      line: .file_line_range[0],
      guideline: .guideline
    }]' 2>/dev/null || echo "[]")
    
    if [ "$SOFT_FAIL" = "true" ]; then
      SUCCESS=true
    elif [ $EXIT_CODE -ne 0 ]; then
      SUCCESS=false
    fi
    ;;
    
  scan-plan)
    if [ -z "$PLAN_FILE" ]; then
      echo '{"success":false,"message":"Plan file required for scan-plan"}'
      exit 0
    fi
    
    set +e
    OUTPUT=$(checkov -f "$PLAN_FILE" --framework terraform_plan -o json 2>/dev/null)
    EXIT_CODE=$?
    set -e
    
    PASSED=$(echo "$OUTPUT" | jq '[.results.passed_checks[]?] | length' 2>/dev/null || echo 0)
    FAILED=$(echo "$OUTPUT" | jq '[.results.failed_checks[]?] | length' 2>/dev/null || echo 0)
    
    if [ "$SOFT_FAIL" = "true" ]; then
      SUCCESS=true
    elif [ $EXIT_CODE -ne 0 ]; then
      SUCCESS=false
    fi
    ;;
    
  list-checks)
    OUTPUT=$(checkov --list 2>/dev/null | head -100)
    SUCCESS=true
    ;;
    
  *)
    SUCCESS=false
    ;;
esac

END_TIME=$(date +%s%3N)
DURATION=$((END_TIME - START_TIME))

cat <<EOF
{
  "success": $SUCCESS,
  "operation": "$OPERATION",
  "passed": $PASSED,
  "failed": $FAILED,
  "skipped": $SKIPPED,
  "failedChecks": $FAILED_CHECKS,
  "framework": "$FRAMEWORK",
  "scanDuration": $DURATION,
  "message": "Scan completed: $PASSED passed, $FAILED failed, $SKIPPED skipped"
}
EOF
        `.trim(),
        ]);
    },
};
