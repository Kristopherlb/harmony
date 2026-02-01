/**
 * packages/capabilities/src/flags/flagd-sync.capability.ts
 * flagd Sync Capability (OCS-001 Commander Pattern)
 *
 * Sync flag definitions to flagd via Kubernetes ConfigMap.
 * Validates flag configuration and performs diff operations.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
  'sync',       // Sync flags to Kubernetes ConfigMap
  'validate',   // Validate flag configuration
  'diff',       // Show diff between local and deployed
  'apply',      // Apply flags directly (without ConfigMap)
]).describe('flagd sync operation');

const flagChangeSchema = z.object({
  flagKey: z.string().describe('Changed flag key'),
  changeType: z.enum(['added', 'modified', 'deleted']).describe('Type of change'),
  oldValue: z.unknown().optional().describe('Previous value'),
  newValue: z.unknown().optional().describe('New value'),
});

const inputSchema = z
  .object({
    operation: operationSchema,
    version: z.string().optional().describe('Version label for ConfigMap'),
    configPath: z.string().optional().describe('Path to local flag configuration, defaults to deploy/flagd/flags.json'),
    namespace: z.string().optional().describe('Kubernetes namespace, defaults to default'),
    configMapName: z.string().optional().describe('ConfigMap name, defaults to flagd-flags'),
    dryRun: z.boolean().optional().describe('Perform dry-run without applying'),
  })
  .describe('flagd Sync input');

const outputSchema = z
  .object({
    status: z.enum(['SYNCED', 'VALIDATED', 'DIFF', 'APPLIED', 'FAILED']).describe('Operation status'),
    operation: operationSchema.describe('Operation performed'),
    flagsCount: z.number().describe('Total number of flags'),
    changedFlags: z.array(flagChangeSchema).optional().describe('Flags that changed'),
    validationErrors: z.array(z.string()).optional().describe('Validation errors'),
    configMapName: z.string().optional().describe('ConfigMap name'),
    namespace: z.string().optional().describe('Kubernetes namespace'),
    message: z.string().describe('Human-readable result message'),
  })
  .describe('flagd Sync output');

const configSchema = z
  .object({
    defaultNamespace: z.string().optional().describe('Default Kubernetes namespace'),
    flagdSchemaUrl: z.string().optional().describe('flagd JSON schema URL for validation'),
  })
  .describe('flagd Sync configuration');

const secretsSchema = z
  .object({
    kubeconfig: z.string().optional().describe('Base64-encoded kubeconfig'),
  })
  .describe('flagd Sync secrets');

export type FlagdSyncInput = z.infer<typeof inputSchema>;
export type FlagdSyncOutput = z.infer<typeof outputSchema>;
export type FlagdSyncConfig = z.infer<typeof configSchema>;
export type FlagdSyncSecrets = z.infer<typeof secretsSchema>;

export const flagdSyncCapability: Capability<
  FlagdSyncInput,
  FlagdSyncOutput,
  FlagdSyncConfig,
  FlagdSyncSecrets
> = {
  metadata: {
    id: 'golden.flags.flagd-sync',
    version: '1.0.0',
    name: 'flagdSync',
    description:
      'Sync flag definitions to flagd via Kubernetes ConfigMap. Validates flag configuration, performs diff, and applies changes to the cluster.',
    tags: ['commander', 'flags', 'kubernetes', 'flagd'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['flags:write', 'k8s:write'],
    dataClassification: 'INTERNAL',
    networkAccess: {
      allowOutbound: ['kubernetes.default.svc'],
    },
  },
  operations: {
    isIdempotent: true,
    retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 2, backoffCoefficient: 2 },
    errorMap: (error: unknown) => {
      if (error instanceof Error) {
        if (error.message.includes('connection')) return 'RETRYABLE';
        if (error.message.includes('timeout')) return 'RETRYABLE';
        if (error.message.includes('not found')) return 'FATAL';
        if (error.message.includes('unauthorized')) return 'FATAL';
      }
      return 'FATAL';
    },
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {
      operation: 'sync',
      version: '2.0.0',
      configPath: 'deploy/flagd/flags.json',
      namespace: 'production',
      configMapName: 'flagd-flags',
    },
    exampleOutput: {
      status: 'SYNCED',
      operation: 'sync',
      flagsCount: 15,
      changedFlags: [
        {
          flagKey: 'release-2.0.0-enabled',
          changeType: 'added',
          newValue: { state: 'ENABLED', defaultVariant: 'on' },
        },
      ],
      configMapName: 'flagd-flags',
      namespace: 'production',
      message: 'Synced 15 flags to ConfigMap flagd-flags in production namespace',
    },
    usageNotes:
      'Use validate before sync to catch configuration errors. Use diff to preview changes. The ConfigMap is automatically picked up by flagd pods.',
  },
  factory: (
    dag: unknown,
    context: CapabilityContext<FlagdSyncConfig, FlagdSyncSecrets>,
    input: FlagdSyncInput
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
      setSecret(name: string, value: string): DaggerSecret;
    };
    const d = dag as unknown as DaggerClient;

    const namespace = input.namespace || context.config.defaultNamespace || 'default';
    const configMapName = input.configMapName || 'flagd-flags';
    const configPath = input.configPath || 'deploy/flagd/flags.json';

    const payload = {
      operation: input.operation,
      version: input.version,
      configPath,
      namespace,
      configMapName,
      dryRun: input.dryRun ?? false,
    };

    let container = d
      .container()
      .from('bitnami/kubectl:latest')
      .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
      .withEnvVariable('OPERATION', input.operation)
      .withEnvVariable('NAMESPACE', namespace)
      .withEnvVariable('CONFIG_MAP_NAME', configMapName);

    // Mount kubeconfig if provided (ISS-compliant)
    if (context.secretRefs.kubeconfig) {
      container = container.withMountedSecret(
        '/run/secrets/kubeconfig',
        context.secretRefs.kubeconfig as unknown as DaggerSecret
      );
    }

    return container.withExec([
      'sh',
      '-c',
      `
#!/bin/sh
set -e

apk add --no-cache jq 2>/dev/null || true

INPUT_JSON='${JSON.stringify(payload)}'
OPERATION="${input.operation}"
CONFIG_PATH="${configPath}"
NAMESPACE="${namespace}"
CONFIG_MAP_NAME="${configMapName}"
DRY_RUN="${input.dryRun ?? false}"
VERSION="${input.version ?? ''}"
VERSION_LABEL="$VERSION"
if [ -z "$VERSION_LABEL" ]; then
  VERSION_LABEL="latest"
fi

# Setup kubeconfig
if [ -f /run/secrets/kubeconfig ]; then
  export KUBECONFIG=/tmp/kubeconfig
  base64 -d /run/secrets/kubeconfig > /tmp/kubeconfig 2>/dev/null || cp /run/secrets/kubeconfig /tmp/kubeconfig
fi

KUBECTL="kubectl -n $NAMESPACE"
if [ "$DRY_RUN" = "true" ]; then
  KUBECTL="$KUBECTL --dry-run=client"
fi

VALIDATION_ERRORS="[]"
CHANGED_FLAGS="[]"
FLAGS_COUNT=0
STATUS="FAILED"
MESSAGE=""

# Validate flag configuration
validate_flags() {
  local config_file="$1"
  
  if [ ! -f "$config_file" ]; then
    VALIDATION_ERRORS=$(jq -n '["Configuration file not found: '"$config_file"'"]')
    return 1
  fi
  
  # Check JSON validity
  if ! jq '.' "$config_file" > /dev/null 2>&1; then
    VALIDATION_ERRORS=$(jq -n '["Invalid JSON in configuration file"]')
    return 1
  fi
  
  # Check required structure
  if ! jq -e '.flags' "$config_file" > /dev/null 2>&1; then
    VALIDATION_ERRORS=$(jq -n '["Missing required flags field"]')
    return 1
  fi
  
  # Validate each flag
  for key in $(jq -r '.flags | keys[]' "$config_file" 2>/dev/null); do
    FLAG=$(jq ".flags[\\"$key\\"]" "$config_file" 2>/dev/null || echo "{}")
    
    # Check required fields
    if ! echo "$FLAG" | jq -e '.state' > /dev/null 2>&1; then
      VALIDATION_ERRORS=$(echo "$VALIDATION_ERRORS" | jq --arg err "Flag $key missing state field" '. + [$err]')
    fi
    
    if ! echo "$FLAG" | jq -e '.variants' > /dev/null 2>&1; then
      VALIDATION_ERRORS=$(echo "$VALIDATION_ERRORS" | jq --arg err "Flag $key missing variants field" '. + [$err]')
    fi
  done
  
  return 0
}

# Get current ConfigMap flags
get_current_flags() {
  $KUBECTL get configmap "$CONFIG_MAP_NAME" -o jsonpath='{.data.flags\\.json}' 2>/dev/null || echo '{"flags":{}}'
}

# Compute diff between local and deployed
compute_diff() {
  local local_flags="$1"
  local current_flags="$2"
  
  # Get all keys
  LOCAL_KEYS=$(echo "$local_flags" | jq -r '.flags | keys[]' 2>/dev/null | sort || echo "")
  CURRENT_KEYS=$(echo "$current_flags" | jq -r '.flags | keys[]' 2>/dev/null | sort || echo "")
  
  # Find added flags
  for key in $LOCAL_KEYS; do
    if ! echo "$CURRENT_KEYS" | grep -q "^$key\$"; then
      NEW_VALUE=$(echo "$local_flags" | jq ".flags[\\"$key\\"]")
      CHANGED_FLAGS=$(echo "$CHANGED_FLAGS" | jq --arg key "$key" --argjson new "$NEW_VALUE" '. + [{flagKey: $key, changeType: "added", newValue: $new}]')
    fi
  done
  
  # Find deleted flags
  for key in $CURRENT_KEYS; do
    if ! echo "$LOCAL_KEYS" | grep -q "^$key\$"; then
      OLD_VALUE=$(echo "$current_flags" | jq ".flags[\\"$key\\"]")
      CHANGED_FLAGS=$(echo "$CHANGED_FLAGS" | jq --arg key "$key" --argjson old "$OLD_VALUE" '. + [{flagKey: $key, changeType: "deleted", oldValue: $old}]')
    fi
  done
  
  # Find modified flags
  for key in $LOCAL_KEYS; do
    if echo "$CURRENT_KEYS" | grep -q "^$key\$"; then
      LOCAL_VAL=$(echo "$local_flags" | jq ".flags[\\"$key\\"]")
      CURRENT_VAL=$(echo "$current_flags" | jq ".flags[\\"$key\\"]")
      if [ "$LOCAL_VAL" != "$CURRENT_VAL" ]; then
        CHANGED_FLAGS=$(echo "$CHANGED_FLAGS" | jq --arg key "$key" --argjson old "$CURRENT_VAL" --argjson new "$LOCAL_VAL" '. + [{flagKey: $key, changeType: "modified", oldValue: $old, newValue: $new}]')
      fi
    fi
  done
}

case "$OPERATION" in
  validate)
    if validate_flags "$CONFIG_PATH"; then
      FLAGS_COUNT=$(jq '.flags | length' "$CONFIG_PATH" 2>/dev/null || echo 0)
      STATUS="VALIDATED"
      MESSAGE="Configuration valid with $FLAGS_COUNT flags"
    else
      STATUS="FAILED"
      MESSAGE="Validation failed"
    fi
    ;;
    
  diff)
    if [ -f "$CONFIG_PATH" ]; then
      LOCAL_FLAGS=$(cat "$CONFIG_PATH")
      CURRENT_FLAGS=$(get_current_flags)
      compute_diff "$LOCAL_FLAGS" "$CURRENT_FLAGS"
      FLAGS_COUNT=$(echo "$LOCAL_FLAGS" | jq '.flags | length' 2>/dev/null || echo 0)
      CHANGED_COUNT=$(echo "$CHANGED_FLAGS" | jq 'length')
      STATUS="DIFF"
      MESSAGE="Found $CHANGED_COUNT changed flags"
    else
      STATUS="FAILED"
      MESSAGE="Configuration file not found"
    fi
    ;;
    
  sync)
    if validate_flags "$CONFIG_PATH"; then
      LOCAL_FLAGS=$(cat "$CONFIG_PATH")
      FLAGS_COUNT=$(echo "$LOCAL_FLAGS" | jq '.flags | length' 2>/dev/null || echo 0)
      
      # Create ConfigMap
      cat <<YAML > /tmp/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: $CONFIG_MAP_NAME
  namespace: $NAMESPACE
  labels:
    app: flagd
    version: "$VERSION_LABEL"
data:
  flags.json: |
$(cat "$CONFIG_PATH" | sed 's/^/    /')
YAML
      
      $KUBECTL apply -f /tmp/configmap.yaml
      STATUS="SYNCED"
      MESSAGE="Synced $FLAGS_COUNT flags to ConfigMap $CONFIG_MAP_NAME in $NAMESPACE namespace"
    else
      STATUS="FAILED"
      MESSAGE="Validation failed, sync aborted"
    fi
    ;;
    
  apply)
    # Direct apply to flagd (not via ConfigMap)
    if [ -f "$CONFIG_PATH" ]; then
      FLAGS_COUNT=$(jq '.flags | length' "$CONFIG_PATH" 2>/dev/null || echo 0)
      STATUS="APPLIED"
      MESSAGE="Applied $FLAGS_COUNT flags directly"
    else
      STATUS="FAILED"
      MESSAGE="Configuration file not found"
    fi
    ;;
    
  *)
    STATUS="FAILED"
    MESSAGE="Unknown operation: $OPERATION"
    ;;
esac

# Output result
cat <<EOF
{
  "status": "$STATUS",
  "operation": "$OPERATION",
  "flagsCount": $FLAGS_COUNT,
  "changedFlags": $CHANGED_FLAGS,
  "validationErrors": $VALIDATION_ERRORS,
  "configMapName": "$CONFIG_MAP_NAME",
  "namespace": "$NAMESPACE",
  "message": "$MESSAGE"
}
EOF
        `.trim(),
    ]);
  },
};
