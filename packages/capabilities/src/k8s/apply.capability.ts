/**
 * packages/capabilities/src/k8s/apply.capability.ts
 * Kubernetes Apply Capability (OCS-001 Commander Pattern)
 *
 * Apply Kubernetes manifests with variable substitution.
 * Supports apply, delete, rollout-restart, and status operations.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
  'apply',            // Apply manifests to cluster
  'delete',           // Delete resources from manifests
  'rollout-restart',  // Restart a deployment
  'get-status',       // Get deployment status
]).describe('Kubernetes operation type');

const inputSchema = z
  .object({
    operation: operationSchema,
    manifests: z.array(z.string()).optional().describe('YAML manifests to apply (inline)'),
    manifestPath: z.string().optional().describe('Path to manifest file or directory'),
    namespace: z.string().optional().describe('Kubernetes namespace, defaults to default'),
    substitutions: z.record(z.string()).optional().describe('envsubst-style variable replacements'),
    resourceType: z.string().optional().describe('Resource type for rollout-restart (e.g., deployment)'),
    resourceName: z.string().optional().describe('Resource name for rollout-restart'),
    dryRun: z.boolean().optional().describe('Perform dry-run without applying'),
    wait: z.boolean().optional().describe('Wait for resources to be ready'),
    timeoutSeconds: z.number().positive().optional().describe('Timeout for wait operations'),
  })
  .describe('Kubernetes Apply input');

const resourceStatusSchema = z.object({
  kind: z.string().describe('Resource kind'),
  name: z.string().describe('Resource name'),
  namespace: z.string().describe('Resource namespace'),
  status: z.enum(['ready', 'pending', 'failed', 'unknown']).describe('Resource status'),
  replicas: z.number().optional().describe('Total replicas'),
  readyReplicas: z.number().optional().describe('Ready replicas'),
  message: z.string().optional().describe('Status message'),
});

const outputSchema = z
  .object({
    success: z.boolean().describe('Whether the operation succeeded'),
    operation: operationSchema.describe('Operation performed'),
    namespace: z.string().describe('Namespace used'),
    resourcesAffected: z.number().describe('Number of resources affected'),
    resources: z.array(resourceStatusSchema).optional().describe('Status of affected resources'),
    message: z.string().describe('Human-readable result message'),
    dryRun: z.boolean().optional().describe('Whether this was a dry run'),
  })
  .describe('Kubernetes Apply output');

const configSchema = z
  .object({
    defaultNamespace: z.string().optional().describe('Default namespace if not specified'),
    kubeconfigPath: z.string().optional().describe('Path to kubeconfig file'),
    context: z.string().optional().describe('Kubernetes context to use'),
  })
  .describe('Kubernetes Apply configuration');

const secretsSchema = z
  .object({
    kubeconfig: z.string().optional().describe('Base64-encoded kubeconfig'),
    serviceAccountToken: z.string().optional().describe('Service account token'),
  })
  .describe('Kubernetes Apply secrets');

export type K8sApplyInput = z.infer<typeof inputSchema>;
export type K8sApplyOutput = z.infer<typeof outputSchema>;
export type K8sApplyConfig = z.infer<typeof configSchema>;
export type K8sApplySecrets = z.infer<typeof secretsSchema>;

export const k8sApplyCapability: Capability<
  K8sApplyInput,
  K8sApplyOutput,
  K8sApplyConfig,
  K8sApplySecrets
> = {
  metadata: {
    id: 'golden.k8s.apply',
    domain: 'k8s',
    version: '1.0.0',
    name: 'k8sApply',
    description:
      'Apply Kubernetes manifests with variable substitution. Supports apply, delete, rollout-restart, and status operations for deployment management.',
    tags: ['commander', 'k8s', 'kubernetes', 'deployment', 'infrastructure'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['k8s:write'],
    dataClassification: 'INTERNAL',
    networkAccess: {
      allowOutbound: ['kubernetes.default.svc', '*.eks.amazonaws.com', '*.azmk8s.io', '*.gke.io'],
    },
  },
  operations: {
    isIdempotent: true,
    retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 2, backoffCoefficient: 2 },
    errorMap: (error: unknown) => {
      if (error instanceof Error) {
        if (error.message.includes('connection refused')) return 'RETRYABLE';
        if (error.message.includes('timeout')) return 'RETRYABLE';
        if (error.message.includes('conflict')) return 'RETRYABLE';
        if (error.message.includes('unauthorized')) return 'FATAL';
        if (error.message.includes('not found')) return 'FATAL';
      }
      return 'FATAL';
    },
    costFactor: 'MEDIUM',
  },
  aiHints: {
    exampleInput: {
      operation: 'apply',
      manifestPath: 'deploy/k8s/workers',
      namespace: 'production',
      substitutions: { BUILD_ID: 'v2.0.0', IMAGE_TAG: 'v2.0.0' },
      wait: true,
    },
    exampleOutput: {
      success: true,
      operation: 'apply',
      namespace: 'production',
      resourcesAffected: 3,
      resources: [
        {
          kind: 'Deployment',
          name: 'harmony-worker',
          namespace: 'production',
          status: 'ready',
          replicas: 3,
          readyReplicas: 3,
        },
      ],
      message: 'Applied 3 resources to production namespace',
    },
    usageNotes:
      'Use substitutions for environment-specific values like BUILD_ID and IMAGE_TAG. Set wait=true for deployments to ensure rollout completes. Use rollout-restart to restart pods without manifest changes.',
  },
  factory: (
    dag,
    context: CapabilityContext<K8sApplyConfig, K8sApplySecrets>,
    input: K8sApplyInput
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
    const timeoutSeconds = input.timeoutSeconds ?? 300;

    const payload = {
      operation: input.operation,
      manifests: input.manifests,
      manifestPath: input.manifestPath,
      namespace,
      substitutions: input.substitutions ?? {},
      resourceType: input.resourceType ?? 'deployment',
      resourceName: input.resourceName,
      dryRun: input.dryRun ?? false,
      wait: input.wait ?? false,
      timeoutSeconds,
      context: context.config.context,
    };

    let container = d
      .container()
      .from('bitnami/kubectl:latest')
      .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
      .withEnvVariable('OPERATION', input.operation)
      .withEnvVariable('NAMESPACE', namespace);

    // Mount kubeconfig if provided (ISS-compliant)
    if (context.secretRefs.kubeconfig) {
      container = container.withMountedSecret(
        '/run/secrets/kubeconfig',
        context.secretRefs.kubeconfig as unknown as DaggerSecret
      );
    }
    if (context.secretRefs.serviceAccountToken) {
      container = container.withMountedSecret(
        '/run/secrets/sa_token',
        context.secretRefs.serviceAccountToken as unknown as DaggerSecret
      );
    }

    return container.withExec([
      'sh',
      '-c',
      `
#!/bin/sh
set -e

# Parse input
INPUT_JSON="$INPUT_JSON"
OPERATION=$(echo "$INPUT_JSON" | jq -r '.operation')
NAMESPACE=$(echo "$INPUT_JSON" | jq -r '.namespace')
DRY_RUN=$(echo "$INPUT_JSON" | jq -r '.dryRun // false')
WAIT=$(echo "$INPUT_JSON" | jq -r '.wait // false')
TIMEOUT=$(echo "$INPUT_JSON" | jq -r '.timeoutSeconds // 300')
MANIFEST_PATH=$(echo "$INPUT_JSON" | jq -r '.manifestPath // empty')
RESOURCE_TYPE=$(echo "$INPUT_JSON" | jq -r '.resourceType // "deployment"')
RESOURCE_NAME=$(echo "$INPUT_JSON" | jq -r '.resourceName // empty')

# Setup kubeconfig
if [ -f /run/secrets/kubeconfig ]; then
  export KUBECONFIG=/tmp/kubeconfig
  base64 -d /run/secrets/kubeconfig > /tmp/kubeconfig 2>/dev/null || cp /run/secrets/kubeconfig /tmp/kubeconfig
fi

if [ -f /run/secrets/sa_token ]; then
  export KUBERNETES_SERVICE_TOKEN=$(cat /run/secrets/sa_token)
fi

# Apply substitutions to manifests
apply_substitutions() {
  local content="$1"
  for key in $(echo "$INPUT_JSON" | jq -r '.substitutions // {} | keys[]'); do
    value=$(echo "$INPUT_JSON" | jq -r ".substitutions[\\"$key\\"]")
    esc_value=$(printf '%s' "$value" | sed -e 's/[\\/&]/\\\\&/g')
    content=$(echo "$content" | sed "s/\\\${$key}/$esc_value/g" | sed "s/\\$$key/$esc_value/g")
  done
  echo "$content"
}

# Build kubectl command base
KUBECTL_BASE="kubectl -n $NAMESPACE"
if [ "$DRY_RUN" = "true" ]; then
  KUBECTL_BASE="$KUBECTL_BASE --dry-run=client"
fi

SUCCESS=true
ERR_MSG=""
RESOURCES_AFFECTED=0
RESOURCES_JSON="[]"

case "$OPERATION" in
  apply)
    # Handle inline manifests or path
    if [ -n "$MANIFEST_PATH" ]; then
      if [ -d "$MANIFEST_PATH" ]; then
        for f in "$MANIFEST_PATH"/*.yaml "$MANIFEST_PATH"/*.yml; do
          if [ -f "$f" ]; then
            CONTENT=$(apply_substitutions "$(cat "$f")")
            set +e
            echo "$CONTENT" | $KUBECTL_BASE apply -f - -o json > /tmp/result.json 2>&1
            rc=$?
            set -e
            if [ "$rc" -ne 0 ]; then
              SUCCESS=false
              ERR_MSG=$(cat /tmp/result.json 2>/dev/null || echo "kubectl apply failed")
            fi
            RESOURCES_AFFECTED=$((RESOURCES_AFFECTED + 1))
          fi
        done
      else
        CONTENT=$(apply_substitutions "$(cat "$MANIFEST_PATH")")
        set +e
        echo "$CONTENT" | $KUBECTL_BASE apply -f - -o json > /tmp/result.json 2>&1
        rc=$?
        set -e
        if [ "$rc" -ne 0 ]; then
          SUCCESS=false
          ERR_MSG=$(cat /tmp/result.json 2>/dev/null || echo "kubectl apply failed")
        fi
        RESOURCES_AFFECTED=$((RESOURCES_AFFECTED + 1))
      fi
    fi
    
    # Handle inline manifests array
    MANIFEST_COUNT=$(echo "$INPUT_JSON" | jq '.manifests | length // 0')
    i=0
    while [ $i -lt $MANIFEST_COUNT ]; do
      MANIFEST=$(echo "$INPUT_JSON" | jq -r ".manifests[$i]")
      CONTENT=$(apply_substitutions "$MANIFEST")
      set +e
      echo "$CONTENT" | $KUBECTL_BASE apply -f - -o json > /tmp/result.json 2>&1
      rc=$?
      set -e
      if [ "$rc" -ne 0 ]; then
        SUCCESS=false
        ERR_MSG=$(cat /tmp/result.json 2>/dev/null || echo "kubectl apply failed")
      fi
      RESOURCES_AFFECTED=$((RESOURCES_AFFECTED + 1))
      i=$((i + 1))
    done

    if [ "$WAIT" = "true" ]; then
      set +e
      $KUBECTL_BASE wait --for=condition=available --timeout="$TIMEOUT"s deployment --all 2>/dev/null
      set -e
    fi
    MESSAGE="Applied $RESOURCES_AFFECTED resources to $NAMESPACE namespace"
    ;;

  delete)
    if [ -n "$MANIFEST_PATH" ]; then
      set +e
      $KUBECTL_BASE delete -f "$MANIFEST_PATH" --ignore-not-found -o json > /tmp/result.json 2>&1
      rc=$?
      set -e
      if [ "$rc" -ne 0 ]; then
        SUCCESS=false
        ERR_MSG=$(cat /tmp/result.json 2>/dev/null || echo "kubectl delete failed")
      fi
      RESOURCES_AFFECTED=$(jq '.items | length // 1' /tmp/result.json 2>/dev/null || echo 1)
    fi
    MESSAGE="Deleted resources from $NAMESPACE namespace"
    ;;

  rollout-restart)
    if [ -n "$RESOURCE_NAME" ]; then
      set +e
      $KUBECTL_BASE rollout restart "$RESOURCE_TYPE/$RESOURCE_NAME" > /tmp/result.json 2>&1
      rc=$?
      set -e
      if [ "$rc" -ne 0 ]; then
        SUCCESS=false
        ERR_MSG=$(cat /tmp/result.json 2>/dev/null || echo "kubectl rollout restart failed")
      fi
      if [ "$WAIT" = "true" ]; then
        set +e
        $KUBECTL_BASE rollout status "$RESOURCE_TYPE/$RESOURCE_NAME" --timeout="$TIMEOUT"s > /tmp/result.json 2>&1
        rc=$?
        set -e
        if [ "$rc" -ne 0 ]; then
          SUCCESS=false
          ERR_MSG=$(cat /tmp/result.json 2>/dev/null || echo "kubectl rollout status failed")
        fi
      fi
      RESOURCES_AFFECTED=1
    else
      set +e
      $KUBECTL_BASE rollout restart "$RESOURCE_TYPE" --all > /tmp/result.json 2>&1
      rc=$?
      set -e
      if [ "$rc" -ne 0 ]; then
        SUCCESS=false
        ERR_MSG=$(cat /tmp/result.json 2>/dev/null || echo "kubectl rollout restart failed")
      fi
      RESOURCES_AFFECTED=$($KUBECTL_BASE get "$RESOURCE_TYPE" -o json 2>/dev/null | jq '.items | length' 2>/dev/null || echo 0)
    fi
    MESSAGE="Restarted $RESOURCE_TYPE in $NAMESPACE namespace"
    ;;

  get-status)
    DEPLOYMENTS=$($KUBECTL_BASE get deployments -o json 2>/dev/null || echo '{"items":[]}')
    RESOURCES_AFFECTED=$(echo "$DEPLOYMENTS" | jq '.items | length')
    RESOURCES_JSON=$(echo "$DEPLOYMENTS" | jq '[.items[] | {
      kind: "Deployment",
      name: .metadata.name,
      namespace: .metadata.namespace,
      status: (if .status.readyReplicas == .status.replicas then "ready" elif .status.readyReplicas > 0 then "pending" else "unknown" end),
      replicas: .status.replicas,
      readyReplicas: .status.readyReplicas
    }]')
    MESSAGE="Retrieved status of $RESOURCES_AFFECTED deployments in $NAMESPACE"
    ;;

  *)
    echo '{"success":false,"message":"Unknown operation: '$OPERATION'"}'
    exit 1
    ;;
esac

if [ "$SUCCESS" != "true" ]; then
  MESSAGE="Failed: $ERR_MSG"
fi

# Output result
cat <<EOF
{
  "success": $SUCCESS,
  "operation": "$OPERATION",
  "namespace": "$NAMESPACE",
  "resourcesAffected": $RESOURCES_AFFECTED,
  "resources": $RESOURCES_JSON,
  "message": "$MESSAGE",
  "dryRun": $DRY_RUN
}
EOF
        `.trim(),
    ]);
  },
};
