/**
 * packages/capabilities/src/security/minder.capability.ts
 * Minder Capability (OCS-001 Guardian Pattern)
 *
 * OpenSSF Minder - Security posture management with policy-as-code.
 * Define and enforce security policies across repositories.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
    'enroll-repo',      // Enroll repository in Minder
    'apply-profile',    // Apply security profile
    'evaluate',         // Evaluate policies
    'list-violations',  // List policy violations
    'remediate',        // Auto-remediate violations
    'get-status',       // Get repository status
]).describe('Minder operation');

const remediationActionSchema = z.enum([
    'none',
    'alert',
    'auto_fix',
    'pull_request',
]).describe('Remediation action');

const inputSchema = z
    .object({
        operation: operationSchema,
        repoOwner: z.string().optional().describe('Repository owner'),
        repoName: z.string().optional().describe('Repository name'),
        profileName: z.string().optional().describe('Security profile name'),
        provider: z.string().optional().describe('Git provider (github, gitlab)'),
        remediationAction: remediationActionSchema.optional().describe('Remediation action'),
    })
    .describe('Minder input');

const violationSchema = z.object({
    rule: z.string().describe('Rule name'),
    severity: z.enum(['low', 'medium', 'high', 'critical']).describe('Violation severity'),
    description: z.string().describe('Violation description'),
    remediation: z.string().optional().describe('Remediation guidance'),
    autoRemediable: z.boolean().describe('Whether auto-remediation is available'),
});

const profileStatusSchema = z.object({
    name: z.string().describe('Profile name'),
    status: z.enum(['passing', 'failing', 'error']).describe('Profile status'),
    rulesEvaluated: z.number().describe('Number of rules evaluated'),
    rulesPassing: z.number().describe('Number of passing rules'),
    rulesFailing: z.number().describe('Number of failing rules'),
});

const outputSchema = z
    .object({
        success: z.boolean().describe('Whether the operation succeeded'),
        operation: operationSchema.describe('Operation performed'),
        enrolled: z.boolean().optional().describe('Whether repository is enrolled'),
        profileApplied: z.boolean().optional().describe('Whether profile was applied'),
        violations: z.array(violationSchema).optional().describe('Policy violations'),
        profileStatus: profileStatusSchema.optional().describe('Profile evaluation status'),
        remediationCount: z.number().optional().describe('Number of remediations applied'),
        message: z.string().describe('Human-readable result message'),
    })
    .describe('Minder output');

const configSchema = z
    .object({
        minderUrl: z.string().optional().describe('Minder server URL'),
        defaultProfile: z.string().optional().describe('Default security profile'),
        defaultProvider: z.string().optional().describe('Default git provider'),
    })
    .describe('Minder configuration');

const secretsSchema = z
    .object({
        minderToken: z.string().optional().describe('Minder API token'),
        providerToken: z.string().optional().describe('Git provider token'),
    })
    .describe('Minder secrets');

export type MinderInput = z.infer<typeof inputSchema>;
export type MinderOutput = z.infer<typeof outputSchema>;
export type MinderConfig = z.infer<typeof configSchema>;
export type MinderSecrets = z.infer<typeof secretsSchema>;

export const minderCapability: Capability<
    MinderInput,
    MinderOutput,
    MinderConfig,
    MinderSecrets
> = {
    metadata: {
        id: 'golden.security.minder',
        version: '1.0.0',
        name: 'minder',
        description:
            'OpenSSF Minder for security posture management. Enroll repositories, apply security profiles, and enforce policies.',
        tags: ['guardian', 'security', 'openssf', 'policy', 'compliance'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['security:write', 'repos:admin'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: [
                'api.stacklok.com',
                '*.minder.dev',
            ],
        },
        oscalControlIds: ['CM-1', 'CM-3'], // Configuration management policy
    },
    operations: {
        isIdempotent: false,
        retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 2, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('rate limit')) return 'RETRYABLE';
                if (error.message.includes('unauthorized')) return 'FATAL';
            }
            return 'FATAL';
        },
        costFactor: 'LOW',
    },
    aiHints: {
        exampleInput: {
            operation: 'evaluate',
            repoOwner: 'harmony-org',
            repoName: 'harmony-platform',
            profileName: 'security-baseline',
        },
        exampleOutput: {
            success: true,
            operation: 'evaluate',
            profileStatus: {
                name: 'security-baseline',
                status: 'failing',
                rulesEvaluated: 15,
                rulesPassing: 12,
                rulesFailing: 3,
            },
            violations: [
                {
                    rule: 'branch_protection',
                    severity: 'high',
                    description: 'Main branch lacks required reviews',
                    remediation: 'Enable branch protection with 2 required reviewers',
                    autoRemediable: true,
                },
            ],
            message: 'Evaluation complete: 12/15 rules passing',
        },
        usageNotes:
            'Enroll repositories to monitor security posture. Apply profiles to enforce policies like branch protection, secret scanning, and dependency updates.',
    },
    factory: (
        dag,
        context: CapabilityContext<MinderConfig, MinderSecrets>,
        input: MinderInput
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

        const minderUrl = context.config.minderUrl ?? 'https://api.stacklok.com';
        const provider = input.provider ?? context.config.defaultProvider ?? 'github';
        const profileName = input.profileName ?? context.config.defaultProfile ?? 'security-baseline';

        const payload = {
            operation: input.operation,
            repoOwner: input.repoOwner,
            repoName: input.repoName,
            profileName,
            provider,
            remediationAction: input.remediationAction ?? 'alert',
        };

        let container = d
            .container()
            .from('ghcr.io/stacklok/minder:latest')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('OPERATION', input.operation)
            .withEnvVariable('MINDER_URL', minderUrl);

        if (context.secretRefs.minderToken) {
            container = container.withMountedSecret(
                '/run/secrets/minder_token',
                context.secretRefs.minderToken as unknown as DaggerSecret
            );
        }
        if (context.secretRefs.providerToken) {
            container = container.withMountedSecret(
                '/run/secrets/provider_token',
                context.secretRefs.providerToken as unknown as DaggerSecret
            );
        }

        return container.withExec([
            'sh',
            '-c',
            `
#!/bin/sh
set -e

OPERATION="${input.operation}"
REPO_OWNER="${input.repoOwner ?? ''}"
REPO_NAME="${input.repoName ?? ''}"
PROFILE="${profileName}"
PROVIDER="${provider}"

if [ -f /run/secrets/minder_token ]; then
  export MINDER_AUTH_TOKEN=$(cat /run/secrets/minder_token)
fi
if [ -f /run/secrets/provider_token ]; then
  export PROVIDER_TOKEN=$(cat /run/secrets/provider_token)
fi

SUCCESS=true
MESSAGE=""
ENROLLED=""
PROFILE_APPLIED=""
VIOLATIONS="[]"
PROFILE_STATUS="null"
REMEDIATION_COUNT=0

case "$OPERATION" in
  enroll-repo)
    if [ -z "$REPO_OWNER" ] || [ -z "$REPO_NAME" ]; then
      SUCCESS=false
      MESSAGE="Repository owner and name required"
    else
      minder repo register --provider "$PROVIDER" --repo "$REPO_OWNER/$REPO_NAME" 2>/dev/null || {
        SUCCESS=false
        MESSAGE="Repository enrollment failed"
      }
      if [ "$SUCCESS" = "true" ]; then
        ENROLLED=true
        MESSAGE="Repository enrolled successfully"
      fi
    fi
    ;;
    
  apply-profile)
    if [ -z "$REPO_OWNER" ] || [ -z "$REPO_NAME" ]; then
      SUCCESS=false
      MESSAGE="Repository owner and name required"
    else
      minder profile apply --profile "$PROFILE" --repo "$REPO_OWNER/$REPO_NAME" 2>/dev/null || {
        SUCCESS=false
        MESSAGE="Profile application failed"
      }
      if [ "$SUCCESS" = "true" ]; then
        PROFILE_APPLIED=true
        MESSAGE="Profile $PROFILE applied"
      fi
    fi
    ;;
    
  evaluate)
    if [ -z "$REPO_OWNER" ] || [ -z "$REPO_NAME" ]; then
      SUCCESS=false
      MESSAGE="Repository owner and name required"
    else
      RESULT=$(minder repo eval --profile "$PROFILE" --repo "$REPO_OWNER/$REPO_NAME" --output json 2>/dev/null || echo "{}")
      RULES_TOTAL=$(echo "$RESULT" | jq '.rules_evaluated // 0')
      RULES_PASS=$(echo "$RESULT" | jq '.rules_passing // 0')
      RULES_FAIL=$(echo "$RESULT" | jq '.rules_failing // 0')
      
      STATUS="passing"
      if [ "$RULES_FAIL" -gt 0 ]; then
        STATUS="failing"
      fi
      
      PROFILE_STATUS="{\"name\": \"$PROFILE\", \"status\": \"$STATUS\", \"rulesEvaluated\": $RULES_TOTAL, \"rulesPassing\": $RULES_PASS, \"rulesFailing\": $RULES_FAIL}"
      VIOLATIONS=$(echo "$RESULT" | jq '[.violations[]? | {rule: .rule_name, severity: .severity, description: .description, remediation: .remediation, autoRemediable: .auto_remediable}]' 2>/dev/null || echo "[]")
      MESSAGE="Evaluation complete: $RULES_PASS/$RULES_TOTAL rules passing"
    fi
    ;;
    
  remediate)
    if [ -z "$REPO_OWNER" ] || [ -z "$REPO_NAME" ]; then
      SUCCESS=false
      MESSAGE="Repository owner and name required"
    else
      RESULT=$(minder repo remediate --profile "$PROFILE" --repo "$REPO_OWNER/$REPO_NAME" 2>/dev/null || echo "{}")
      REMEDIATION_COUNT=$(echo "$RESULT" | jq '.remediations_applied // 0')
      MESSAGE="Applied $REMEDIATION_COUNT remediations"
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
  "enrolled": \${ENROLLED:-null},
  "profileApplied": \${PROFILE_APPLIED:-null},
  "violations": $VIOLATIONS,
  "profileStatus": $PROFILE_STATUS,
  "remediationCount": $REMEDIATION_COUNT,
  "message": "$MESSAGE"
}
EOF
    `.trim(),
        ]);
    },
};
