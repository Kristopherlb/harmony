/**
 * packages/capabilities/src/flags/auto-feature-flag.capability.ts
 * AutoFeatureFlag Capability (OCS-001 Commander Pattern)
 *
 * Manages automatic creation and lifecycle of feature flags during releases.
 * Generates flags for releases, capabilities, and blueprints.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
    'generateReleaseFlags',     // Create flags for a new release
    'generateCapabilityFlags',  // Create flags for all capabilities
    'generateBlueprintFlags',   // Create flags for all blueprints
    'setFlagState',             // Enable/disable a specific flag
    'rollbackRelease',          // Disable all flags for a release version
    'getFlagStatus',            // Get current status of a flag
]).describe('AutoFeatureFlag operation');

const targetingRuleSchema = z.object({
    attribute: z.string().describe('Context attribute to match'),
    operator: z.enum(['equals', 'contains', 'in', 'not_equals', 'starts_with', 'ends_with']).describe('Match operator'),
    value: z.unknown().describe('Value to match against'),
});

const flagDefinitionSchema = z.object({
    flagKey: z.string().describe('Unique flag key'),
    defaultValue: z.boolean().describe('Default value when not targeted'),
    variants: z.record(z.boolean()).describe('Named variants'),
    targeting: z.array(targetingRuleSchema).optional().describe('Targeting rules'),
    state: z.enum(['ENABLED', 'DISABLED']).describe('Flag state'),
    rolloutPercentage: z.number().min(0).max(100).optional().describe('Percentage rollout'),
});

const inputSchema = z
    .object({
        operation: operationSchema,
        releaseVersion: z.string().optional().describe('Release version (e.g., "2.0.0")'),
        targetId: z.string().optional().describe('Target flag key or capability/blueprint ID'),
        enabled: z.boolean().optional().describe('Enable or disable flag'),
        rolloutPercentage: z.number().min(0).max(100).optional().describe('Percentage for progressive rollout'),
        targetingRules: z.array(targetingRuleSchema).optional().describe('Custom targeting rules'),
        sourcePaths: z.array(z.string()).optional().describe('Paths to scan for metadata'),
    })
    .describe('AutoFeatureFlag input');

const outputSchema = z
    .object({
        operation: operationSchema.describe('Operation performed'),
        flagsGenerated: z.array(flagDefinitionSchema).optional().describe('Generated flag definitions'),
        flagsUpdated: z.array(z.string()).optional().describe('Updated flag keys'),
        flagdConfigPath: z.string().optional().describe('Path to generated flagd config'),
        syncStatus: z.enum(['SYNCED', 'PENDING', 'FAILED']).optional().describe('Sync status'),
        message: z.string().describe('Human-readable result message'),
    })
    .describe('AutoFeatureFlag output');

const configSchema = z
    .object({
        outputDir: z.string().optional().describe('Output directory for flag configs'),
        defaultEnabled: z.boolean().optional().describe('Default enabled state for new flags'),
        flagKeyPrefix: z.string().optional().describe('Prefix for generated flag keys'),
    })
    .describe('AutoFeatureFlag configuration');

const secretsSchema = z
    .object({})
    .describe('AutoFeatureFlag secrets - none required');

export type AutoFeatureFlagInput = z.infer<typeof inputSchema>;
export type AutoFeatureFlagOutput = z.infer<typeof outputSchema>;
export type AutoFeatureFlagConfig = z.infer<typeof configSchema>;
export type AutoFeatureFlagSecrets = z.infer<typeof secretsSchema>;

export const autoFeatureFlagCapability: Capability<
    AutoFeatureFlagInput,
    AutoFeatureFlagOutput,
    AutoFeatureFlagConfig,
    AutoFeatureFlagSecrets
> = {
    metadata: {
        id: 'golden.flags.auto-feature-flag',
        version: '1.0.0',
        name: 'autoFeatureFlag',
        description:
            'Automatic feature flag lifecycle management. Generate flags for releases, capabilities, and blueprints. Supports progressive rollout and targeting rules.',
        tags: ['commander', 'flags', 'release', 'rollout'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['flags:write'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: [], // Runs locally for config generation
        },
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
            operation: 'generateReleaseFlags',
            releaseVersion: '2.0.0',
        },
        exampleOutput: {
            operation: 'generateReleaseFlags',
            flagsGenerated: [
                {
                    flagKey: 'release-2.0.0-enabled',
                    defaultValue: false,
                    variants: { on: true, off: false },
                    state: 'DISABLED',
                },
            ],
            flagdConfigPath: 'deploy/flagd/flags.json',
            message: 'Generated 1 release flags for version 2.0.0',
        },
        usageNotes:
            'Use generateReleaseFlags before deployment to create release gates. Use setFlagState for progressive rollout. Use rollbackRelease to disable all flags for a failed release.',
    },
    factory: (
        dag,
        context: CapabilityContext<AutoFeatureFlagConfig, AutoFeatureFlagSecrets>,
        input: AutoFeatureFlagInput
    ) => {
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = { container(): ContainerBuilder };
        const d = dag as unknown as DaggerClient;

        const outputDir = context.config.outputDir ?? 'deploy/flagd';
        const defaultEnabled = context.config.defaultEnabled ?? false;
        const flagKeyPrefix = context.config.flagKeyPrefix ?? '';

        const payload = {
            operation: input.operation,
            releaseVersion: input.releaseVersion,
            targetId: input.targetId,
            enabled: input.enabled ?? defaultEnabled,
            rolloutPercentage: input.rolloutPercentage,
            targetingRules: input.targetingRules,
            sourcePaths: input.sourcePaths ?? ['packages/capabilities', 'packages/blueprints'],
            outputDir,
            flagKeyPrefix,
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

apk add --no-cache jq 2>/dev/null

INPUT_JSON='${JSON.stringify(payload)}'
OPERATION="${input.operation}"
OUTPUT_DIR="${outputDir}"
RELEASE_VERSION="${input.releaseVersion ?? ''}"
TARGET_ID="${input.targetId ?? ''}"
ENABLED="${input.enabled ?? false}"
ROLLOUT_PCT="${input.rolloutPercentage ?? 100}"
PREFIX="${flagKeyPrefix}"

mkdir -p "$OUTPUT_DIR"
FLAGS_FILE="$OUTPUT_DIR/flags.json"

# Initialize flags file if it doesn't exist
if [ ! -f "$FLAGS_FILE" ]; then
  echo '{"$schema": "https://flagd.dev/schema/v0/flags.json", "flags": {}}' > "$FLAGS_FILE"
fi

# Helper to generate flag key
gen_flag_key() {
  local type="$1"
  local id="$2"
  if [ -n "$PREFIX" ]; then
    echo "$PREFIX-$type-$id-enabled"
  else
    echo "$type-$id-enabled"
  fi
}

# Add or update a flag
add_flag() {
  local key="$1"
  local default_value="$2"
  local state="$3"
  local rollout="$4"
  
  # Build targeting if rollout < 100
  local targeting="null"
  if [ "$rollout" -lt 100 ]; then
    targeting=$(cat <<TARGETING
{
  "fractional": [
    ["on", $rollout],
    ["off", $((100 - rollout))]
  ]
}
TARGETING
)
  fi
  
  local flag=$(cat <<FLAG
{
  "state": "$state",
  "variants": {"on": true, "off": false},
  "defaultVariant": $([ "$default_value" = "true" ] && echo '"on"' || echo '"off"')$([ "$targeting" != "null" ] && echo ", \"targeting\": $targeting" || echo "")
}
FLAG
)
  
  # Add to flags file
  jq --arg key "$key" --argjson flag "$flag" '.flags[$key] = $flag' "$FLAGS_FILE" > "$FLAGS_FILE.tmp" && mv "$FLAGS_FILE.tmp" "$FLAGS_FILE"
}

FLAGS_GENERATED="[]"
FLAGS_UPDATED="[]"

case "$OPERATION" in
  generateReleaseFlags)
    FLAG_KEY=$(gen_flag_key "release" "$RELEASE_VERSION")
    add_flag "$FLAG_KEY" "false" "DISABLED" 0
    FLAGS_GENERATED=$(jq -n --arg key "$FLAG_KEY" '[{flagKey: $key, defaultValue: false, variants: {on: true, off: false}, state: "DISABLED"}]')
    MESSAGE="Generated release flag for version $RELEASE_VERSION"
    ;;
    
  generateCapabilityFlags)
    # Scan for capabilities and generate flags
    for f in $(find packages/capabilities -name "*.capability.ts" -type f 2>/dev/null | grep -v test); do
      CAP_ID=$(grep -o "id: '[^']*'" "$f" 2>/dev/null | head -1 | sed "s/id: '\\([^']*\\)'/\\1/" || echo "")
      if [ -n "$CAP_ID" ]; then
        FLAG_KEY=$(gen_flag_key "cap" "$CAP_ID")
        add_flag "$FLAG_KEY" "true" "ENABLED" 100
        FLAGS_GENERATED=$(echo "$FLAGS_GENERATED" | jq --arg key "$FLAG_KEY" '. + [{flagKey: $key, defaultValue: true, variants: {on: true, off: false}, state: "ENABLED"}]')
      fi
    done
    MESSAGE="Generated capability flags"
    ;;
    
  generateBlueprintFlags)
    # Scan for blueprints and generate flags
    for f in $(find packages/blueprints -name "*.workflow.ts" -type f 2>/dev/null | grep -v test); do
      BP_ID=$(grep -o "id: '[^']*'" "$f" 2>/dev/null | head -1 | sed "s/id: '\\([^']*\\)'/\\1/" || echo "")
      if [ -n "$BP_ID" ]; then
        FLAG_KEY=$(gen_flag_key "bp" "$BP_ID")
        add_flag "$FLAG_KEY" "true" "ENABLED" 100
        FLAGS_GENERATED=$(echo "$FLAGS_GENERATED" | jq --arg key "$FLAG_KEY" '. + [{flagKey: $key, defaultValue: true, variants: {on: true, off: false}, state: "ENABLED"}]')
      fi
    done
    MESSAGE="Generated blueprint flags"
    ;;
    
  setFlagState)
    STATE=$([ "$ENABLED" = "true" ] && echo "ENABLED" || echo "DISABLED")
    ROLLOUT_INT=$(printf "%.0f" "$ROLLOUT_PCT")
    add_flag "$TARGET_ID" "$ENABLED" "$STATE" "$ROLLOUT_INT"
    FLAGS_UPDATED=$(jq -n --arg key "$TARGET_ID" '[$key]')
    MESSAGE="Updated flag $TARGET_ID to $STATE with $ROLLOUT_INT% rollout"
    ;;
    
  rollbackRelease)
    # Find and disable all release flags
    RELEASE_FLAG=$(gen_flag_key "release" "$RELEASE_VERSION")
    add_flag "$RELEASE_FLAG" "false" "DISABLED" 0
    FLAGS_UPDATED=$(jq -n --arg key "$RELEASE_FLAG" '[$key]')
    MESSAGE="Rolled back release $RELEASE_VERSION - disabled release flag"
    ;;
    
  getFlagStatus)
    FLAG_DATA=$(jq --arg key "$TARGET_ID" '.flags[$key] // null' "$FLAGS_FILE")
    if [ "$FLAG_DATA" = "null" ]; then
      MESSAGE="Flag $TARGET_ID not found"
    else
      STATE=$(echo "$FLAG_DATA" | jq -r '.state')
      MESSAGE="Flag $TARGET_ID is $STATE"
    fi
    ;;
    
  *)
    MESSAGE="Unknown operation: $OPERATION"
    ;;
esac

# Count generated flags
FLAG_COUNT=$(echo "$FLAGS_GENERATED" | jq 'length')

# Output result
cat <<EOF
{
  "operation": "$OPERATION",
  "flagsGenerated": $FLAGS_GENERATED,
  "flagsUpdated": $FLAGS_UPDATED,
  "flagdConfigPath": "$FLAGS_FILE",
  "syncStatus": "PENDING",
  "message": "$MESSAGE"
}
EOF
        `.trim(),
            ]);
    },
};
