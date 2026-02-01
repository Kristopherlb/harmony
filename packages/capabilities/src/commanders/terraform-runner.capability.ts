/**
 * packages/capabilities/src/commanders/terraform-runner.capability.ts
 * Terraform Runner Capability (OCS-001 Commander Pattern)
 *
 * Provides Terraform infrastructure-as-code operations.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const commandSchema = z.enum([
    'init',
    'plan',
    'apply',
    'destroy',
    'output',
    'validate',
    'fmt',
    'show',
    'state',
]).describe('Terraform command to run');

const inputSchema = z
    .object({
        command: commandSchema,
        variables: z.record(z.unknown()).optional().describe('Terraform variables'),
        varFiles: z.array(z.string()).optional().describe('Variable files to use'),
        targets: z.array(z.string()).optional().describe('Resource targets'),
        autoApprove: z.boolean().optional().describe('Auto-approve apply/destroy'),
        planFile: z.string().optional().describe('Plan file for apply'),
        refresh: z.boolean().optional().describe('Refresh state before plan'),
        parallelism: z.number().int().positive().optional().describe('Parallelism limit'),
        stateSubcommand: z.enum(['list', 'show', 'mv', 'rm', 'pull', 'push']).optional().describe('State subcommand'),
        stateArgs: z.array(z.string()).optional().describe('State subcommand arguments'),
    })
    .describe('Terraform Runner input');

const resourceChangeSchema = z.object({
    address: z.string().describe('Resource address'),
    action: z.enum(['create', 'update', 'delete', 'replace', 'read', 'no-op']).describe('Change action'),
    before: z.record(z.unknown()).optional().describe('Before state'),
    after: z.record(z.unknown()).optional().describe('After state'),
});

const outputSchema = z
    .object({
        success: z.boolean().describe('Whether command succeeded'),
        command: commandSchema.describe('Command executed'),
        exitCode: z.number().describe('Exit code'),
        stdout: z.string().optional().describe('Standard output'),
        stderr: z.string().optional().describe('Standard error'),
        plan: z.object({
            hasChanges: z.boolean(),
            add: z.number(),
            change: z.number(),
            destroy: z.number(),
            resourceChanges: z.array(resourceChangeSchema).optional(),
        }).optional().describe('Plan summary'),
        outputs: z.record(z.object({
            value: z.unknown(),
            type: z.unknown(),
            sensitive: z.boolean().optional(),
        })).optional().describe('Terraform outputs'),
        stateResources: z.array(z.string()).optional().describe('State resource list'),
        duration: z.number().describe('Execution duration in milliseconds'),
    })
    .describe('Terraform Runner output');

const configSchema = z
    .object({
        workingDir: z.string().describe('Terraform working directory'),
        backendConfig: z.record(z.string()).optional().describe('Backend configuration'),
        terraformVersion: z.string().optional().describe('Terraform version to use'),
    })
    .describe('Terraform Runner configuration');

const secretsSchema = z
    .object({
        awsAccessKeyId: z.string().optional().describe('AWS access key'),
        awsSecretAccessKey: z.string().optional().describe('AWS secret key'),
        gcpCredentials: z.string().optional().describe('GCP service account JSON'),
        azureSubscriptionId: z.string().optional().describe('Azure subscription ID'),
    })
    .describe('Terraform Runner secrets');

export type TerraformRunnerInput = z.infer<typeof inputSchema>;
export type TerraformRunnerOutput = z.infer<typeof outputSchema>;
export type TerraformRunnerConfig = z.infer<typeof configSchema>;
export type TerraformRunnerSecrets = z.infer<typeof secretsSchema>;

export const terraformRunnerCapability: Capability<
    TerraformRunnerInput,
    TerraformRunnerOutput,
    TerraformRunnerConfig,
    TerraformRunnerSecrets
> = {
    metadata: {
        id: 'golden.commanders.terraform-runner',
        version: '1.0.0',
        name: 'terraformRunner',
        description:
            'Terraform infrastructure-as-code runner supporting init, plan, apply, destroy, and state management.',
        tags: ['commander', 'terraform', 'iac', 'infrastructure'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['infra:read', 'infra:write'],
        dataClassification: 'CONFIDENTIAL',
        networkAccess: {
            allowOutbound: ['*'], // Cloud provider APIs
        },
    },
    operations: {
        isIdempotent: false, // apply/destroy have side effects
        retryPolicy: { maxAttempts: 2, initialIntervalSeconds: 5, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('lock')) return 'RETRYABLE';
                if (error.message.includes('rate')) return 'RETRYABLE';
                if (error.message.includes('syntax')) return 'FATAL';
            }
            return 'FATAL';
        },
        costFactor: 'HIGH',
    },
    aiHints: {
        exampleInput: {
            command: 'plan',
            variables: { instance_type: 't3.micro', region: 'us-east-1' },
        },
        exampleOutput: {
            success: true,
            command: 'plan',
            exitCode: 0,
            plan: {
                hasChanges: true,
                add: 2,
                change: 1,
                destroy: 0,
            },
            duration: 15000,
        },
        usageNotes:
            'Always run plan before apply. Use autoApprove: true only in CI/CD. Target specific resources with targets array. Use state commands for manual state manipulation.',
    },
    factory: (
        dag,
        context: CapabilityContext<TerraformRunnerConfig, TerraformRunnerSecrets>,
        input: TerraformRunnerInput
    ) => {
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = { container(): ContainerBuilder };
        const d = dag as unknown as DaggerClient;

        const payload = {
            command: input.command,
            variables: input.variables,
            varFiles: input.varFiles,
            targets: input.targets,
            autoApprove: input.autoApprove,
            planFile: input.planFile,
            refresh: input.refresh ?? true,
            parallelism: input.parallelism,
            stateSubcommand: input.stateSubcommand,
            stateArgs: input.stateArgs,
            workingDir: context.config.workingDir,
            backendConfig: context.config.backendConfig,
            awsAccessKeyIdRef: context.secretRefs.awsAccessKeyId,
            awsSecretAccessKeyRef: context.secretRefs.awsSecretAccessKey,
        };

        const tfVersion = context.config.terraformVersion ?? '1.6';

        return d
            .container()
            .from(`hashicorp/terraform:${tfVersion}`)
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('TF_COMMAND', input.command)
            .withEnvVariable('TF_IN_AUTOMATION', 'true')
            .withExec([
                'sh',
                '-c',
                `
#!/bin/sh
set -e

INPUT_JSON="\${INPUT_JSON}"
COMMAND=$(echo "$INPUT_JSON" | jq -r '.command')
WORKING_DIR=$(echo "$INPUT_JSON" | jq -r '.workingDir')
START_TIME=$(date +%s%3N)

cd "$WORKING_DIR" 2>/dev/null || cd /terraform

# Set up AWS credentials if provided
AWS_KEY_REF=$(echo "$INPUT_JSON" | jq -r '.awsAccessKeyIdRef // empty')
if [ -n "$AWS_KEY_REF" ] && [ -f "$AWS_KEY_REF" ]; then
  export AWS_ACCESS_KEY_ID=$(cat "$AWS_KEY_REF")
fi
AWS_SECRET_REF=$(echo "$INPUT_JSON" | jq -r '.awsSecretAccessKeyRef // empty')
if [ -n "$AWS_SECRET_REF" ] && [ -f "$AWS_SECRET_REF" ]; then
  export AWS_SECRET_ACCESS_KEY=$(cat "$AWS_SECRET_REF")
fi

# Build terraform command
TF_CMD="terraform"

case "$COMMAND" in
  init)
    TF_CMD="$TF_CMD init -input=false"
    BACKEND_CONFIG=$(echo "$INPUT_JSON" | jq -r '.backendConfig // {} | to_entries[] | "-backend-config=\\(.key)=\\(.value)"' 2>/dev/null | tr '\\n' ' ')
    TF_CMD="$TF_CMD $BACKEND_CONFIG"
    ;;
  plan)
    TF_CMD="$TF_CMD plan -input=false -out=tfplan"
    # Add variables
    VARS=$(echo "$INPUT_JSON" | jq -r '.variables // {} | to_entries[] | "-var \\(.key)=\\(.value)"' 2>/dev/null | tr '\\n' ' ')
    TF_CMD="$TF_CMD $VARS"
    # Add targets
    TARGETS=$(echo "$INPUT_JSON" | jq -r '.targets // [] | .[] | "-target=\\(.)"' 2>/dev/null | tr '\\n' ' ')
    TF_CMD="$TF_CMD $TARGETS"
    ;;
  apply)
    AUTO_APPROVE=$(echo "$INPUT_JSON" | jq -r '.autoApprove')
    PLAN_FILE=$(echo "$INPUT_JSON" | jq -r '.planFile // empty')
    if [ -n "$PLAN_FILE" ]; then
      TF_CMD="$TF_CMD apply -input=false $PLAN_FILE"
    elif [ "$AUTO_APPROVE" = "true" ]; then
      TF_CMD="$TF_CMD apply -input=false -auto-approve"
    else
      TF_CMD="$TF_CMD apply -input=false"
    fi
    VARS=$(echo "$INPUT_JSON" | jq -r '.variables // {} | to_entries[] | "-var \\(.key)=\\(.value)"' 2>/dev/null | tr '\\n' ' ')
    TF_CMD="$TF_CMD $VARS"
    ;;
  destroy)
    AUTO_APPROVE=$(echo "$INPUT_JSON" | jq -r '.autoApprove')
    if [ "$AUTO_APPROVE" = "true" ]; then
      TF_CMD="$TF_CMD destroy -input=false -auto-approve"
    else
      TF_CMD="$TF_CMD destroy -input=false"
    fi
    ;;
  output)
    TF_CMD="$TF_CMD output -json"
    ;;
  validate)
    TF_CMD="$TF_CMD validate -json"
    ;;
  fmt)
    TF_CMD="$TF_CMD fmt -check -diff"
    ;;
  show)
    TF_CMD="$TF_CMD show -json"
    ;;
  state)
    SUBCMD=$(echo "$INPUT_JSON" | jq -r '.stateSubcommand // "list"')
    ARGS=$(echo "$INPUT_JSON" | jq -r '.stateArgs // [] | join(" ")')
    TF_CMD="$TF_CMD state $SUBCMD $ARGS"
    ;;
esac

# Run command
STDOUT=$(mktemp)
STDERR=$(mktemp)
set +e
eval $TF_CMD > "$STDOUT" 2> "$STDERR"
EXIT_CODE=$?
set -e

END_TIME=$(date +%s%3N)
DURATION=$((END_TIME - START_TIME))

# Parse plan output if applicable
PLAN_JSON="{}"
if [ "$COMMAND" = "plan" ] && [ -f tfplan ]; then
  PLAN_JSON=$(terraform show -json tfplan 2>/dev/null | jq '{
    hasChanges: (.resource_changes | map(select(.change.actions != ["no-op"])) | length > 0),
    add: ([.resource_changes[]? | select(.change.actions | contains(["create"]))] | length),
    change: ([.resource_changes[]? | select(.change.actions | contains(["update"]))] | length),
    destroy: ([.resource_changes[]? | select(.change.actions | contains(["delete"]))] | length)
  }' 2>/dev/null || echo '{}')
fi

# Parse outputs if applicable
OUTPUTS="{}"
if [ "$COMMAND" = "output" ]; then
  OUTPUTS=$(cat "$STDOUT" 2>/dev/null || echo '{}')
fi

# Output result
cat << EOF
{
  "success": $([ $EXIT_CODE -eq 0 ] && echo true || echo false),
  "command": "$COMMAND",
  "exitCode": $EXIT_CODE,
  "stdout": $(jq -Rs . < "$STDOUT"),
  "stderr": $(jq -Rs . < "$STDERR"),
  "plan": $PLAN_JSON,
  "outputs": $OUTPUTS,
  "duration": $DURATION
}
EOF

rm -f "$STDOUT" "$STDERR"
        `.trim(),
            ]);
    },
};
