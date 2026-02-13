/**
 * packages/capabilities/src/traffic/mesh-router.capability.ts
 * Mesh Router Capability (OCS-001 Commander Pattern)
 *
 * Control Istio/Linkerd traffic routing. Set weights for canary rollout
 * and configure header-based routing.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
  'set-weights',      // Set traffic weight percentages
  'header-route',     // Configure header-based routing
  'get-status',       // Get current routing status
  'reset',            // Reset to 100% stable
]).describe('Mesh router operation');

const meshTypeSchema = z.enum([
  'istio',
  'linkerd',
]).describe('Service mesh type');

const weightsSchema = z.object({
  stable: z.number().min(0).max(100).describe('Percentage to stable subset'),
  canary: z.number().min(0).max(100).describe('Percentage to canary subset'),
}).refine(data => data.stable + data.canary === 100, {
  message: 'Weights must sum to 100',
});

const headerMatchSchema = z.object({
  header: z.string().describe('Header name to match'),
  value: z.string().describe('Header value to match'),
  matchType: z.enum(['exact', 'prefix', 'regex']).optional().describe('Match type, defaults to exact'),
  subset: z.string().describe('Target subset for matched traffic'),
});

const routeStatusSchema = z.object({
  subset: z.string().describe('Subset name'),
  weight: z.number().describe('Current weight percentage'),
  endpoints: z.number().optional().describe('Number of healthy endpoints'),
});

const inputSchema = z
  .object({
    operation: operationSchema,
    service: z.string().describe('Service name'),
    namespace: z.string().optional().describe('Kubernetes namespace, defaults to default'),
    meshType: meshTypeSchema.optional().describe('Service mesh type, defaults to istio'),
    weights: weightsSchema.optional().describe('Traffic weights for set-weights operation'),
    headerMatch: headerMatchSchema.optional().describe('Header match for header-route operation'),
    virtualServiceName: z.string().optional().describe('VirtualService name (Istio)'),
    destinationRuleName: z.string().optional().describe('DestinationRule name (Istio)'),
  })
  .describe('Mesh Router input');

const outputSchema = z
  .object({
    success: z.boolean().describe('Whether operation succeeded'),
    operation: operationSchema.describe('Operation performed'),
    service: z.string().describe('Service name'),
    namespace: z.string().describe('Namespace'),
    meshType: meshTypeSchema.describe('Mesh type'),
    currentWeights: weightsSchema.optional().describe('Current traffic weights'),
    routes: z.array(routeStatusSchema).optional().describe('Current route status'),
    headerRoutes: z.array(headerMatchSchema).optional().describe('Configured header routes'),
    message: z.string().describe('Human-readable result message'),
  })
  .describe('Mesh Router output');

const configSchema = z
  .object({
    defaultMeshType: meshTypeSchema.optional().describe('Default service mesh type'),
    defaultNamespace: z.string().optional().describe('Default Kubernetes namespace'),
  })
  .describe('Mesh Router configuration');

const secretsSchema = z
  .object({
    kubeconfig: z.string().optional().describe('Base64-encoded kubeconfig'),
  })
  .describe('Mesh Router secrets');

export type MeshRouterInput = z.infer<typeof inputSchema>;
export type MeshRouterOutput = z.infer<typeof outputSchema>;
export type MeshRouterConfig = z.infer<typeof configSchema>;
export type MeshRouterSecrets = z.infer<typeof secretsSchema>;

export const meshRouterCapability: Capability<
  MeshRouterInput,
  MeshRouterOutput,
  MeshRouterConfig,
  MeshRouterSecrets
> = {
  metadata: {
    id: 'golden.traffic.mesh-router',
    domain: 'traffic',
    version: '1.0.0',
    name: 'meshRouter',
    description:
      'Control Istio/Linkerd traffic routing. Set weights for canary rollout, configure header-based routing for testing and gradual migration.',
    tags: ['commander', 'traffic', 'service-mesh', 'istio', 'linkerd'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['mesh:write'],
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
        if (error.message.includes('conflict')) return 'RETRYABLE';
        if (error.message.includes('not found')) return 'FATAL';
        if (error.message.includes('unauthorized')) return 'FATAL';
      }
      return 'FATAL';
    },
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {
      operation: 'set-weights',
      service: 'harmony-mcp',
      namespace: 'production',
      meshType: 'istio',
      weights: { stable: 90, canary: 10 },
    },
    exampleOutput: {
      success: true,
      operation: 'set-weights',
      service: 'harmony-mcp',
      namespace: 'production',
      meshType: 'istio',
      currentWeights: { stable: 90, canary: 10 },
      routes: [
        { subset: 'stable', weight: 90, endpoints: 3 },
        { subset: 'canary', weight: 10, endpoints: 1 },
      ],
      message: 'Updated traffic weights: 90% stable, 10% canary',
    },
    usageNotes:
      'Use for progressive rollout - gradually increase canary weight. Header-based routing enables testing specific versions. Reset to 100% stable after promotion or rollback.',
  },
  factory: (
    dag,
    context: CapabilityContext<MeshRouterConfig, MeshRouterSecrets>,
    input: MeshRouterInput
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

    const meshType = input.meshType || context.config.defaultMeshType || 'istio';
    const namespace = input.namespace || context.config.defaultNamespace || 'default';
    const virtualServiceName = input.virtualServiceName ?? input.service;
    const destinationRuleName = input.destinationRuleName ?? input.service;

    const payload = {
      operation: input.operation,
      service: input.service,
      namespace,
      meshType,
      weights: input.weights,
      headerMatch: input.headerMatch,
      virtualServiceName,
      destinationRuleName,
    };

    let container = d
      .container()
      .from('bitnami/kubectl:latest')
      .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
      .withEnvVariable('OPERATION', input.operation)
      .withEnvVariable('SERVICE', input.service)
      .withEnvVariable('NAMESPACE', namespace)
      .withEnvVariable('MESH_TYPE', meshType);

    // Mount kubeconfig if provided
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
SERVICE="${input.service}"
NAMESPACE="${namespace}"
MESH_TYPE="${meshType}"
VS_NAME="${virtualServiceName}"
DR_NAME="${destinationRuleName}"
STABLE_WEIGHT="${input.weights?.stable ?? 100}"
CANARY_WEIGHT="${input.weights?.canary ?? 0}"

# Setup kubeconfig
if [ -f /run/secrets/kubeconfig ]; then
  export KUBECONFIG=/tmp/kubeconfig
  base64 -d /run/secrets/kubeconfig > /tmp/kubeconfig 2>/dev/null || cp /run/secrets/kubeconfig /tmp/kubeconfig
fi

KUBECTL="kubectl -n $NAMESPACE"
SUCCESS="true"
MESSAGE=""
CURRENT_WEIGHTS='{"stable": 100, "canary": 0}'
ROUTES="[]"
HEADER_ROUTES="[]"

case "$MESH_TYPE" in
  istio)
    case "$OPERATION" in
      set-weights)
        # Update VirtualService weights
        cat <<VS > /tmp/vs-patch.yaml
spec:
  http:
  - route:
    - destination:
        host: $SERVICE
        subset: stable
      weight: $STABLE_WEIGHT
    - destination:
        host: $SERVICE
        subset: canary
      weight: $CANARY_WEIGHT
VS
        $KUBECTL patch virtualservice "$VS_NAME" --type=merge --patch-file=/tmp/vs-patch.yaml 2>/dev/null || {
          # Create VirtualService if it doesn't exist
          cat <<VS | $KUBECTL apply -f -
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: $VS_NAME
  namespace: $NAMESPACE
spec:
  hosts:
  - $SERVICE
  http:
  - route:
    - destination:
        host: $SERVICE
        subset: stable
      weight: $STABLE_WEIGHT
    - destination:
        host: $SERVICE
        subset: canary
      weight: $CANARY_WEIGHT
VS
        }
        CURRENT_WEIGHTS='{"stable": '$STABLE_WEIGHT', "canary": '$CANARY_WEIGHT'}'
        MESSAGE="Updated traffic weights: $STABLE_WEIGHT% stable, $CANARY_WEIGHT% canary"
        ;;

      header-route)
        HEADER="${input.headerMatch?.header ?? 'x-version'}"
        VALUE="${input.headerMatch?.value ?? 'canary'}"
        SUBSET="${input.headerMatch?.subset ?? 'canary'}"
        
        cat <<VS | $KUBECTL apply -f -
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: $VS_NAME
  namespace: $NAMESPACE
spec:
  hosts:
  - $SERVICE
  http:
  - match:
    - headers:
        $HEADER:
          exact: "$VALUE"
    route:
    - destination:
        host: $SERVICE
        subset: $SUBSET
  - route:
    - destination:
        host: $SERVICE
        subset: stable
VS
        HEADER_ROUTES='[{"header": "'$HEADER'", "value": "'$VALUE'", "matchType": "exact", "subset": "'$SUBSET'"}]'
        MESSAGE="Configured header routing: $HEADER=$VALUE -> $SUBSET"
        ;;

      get-status)
        VS_JSON=$($KUBECTL get virtualservice "$VS_NAME" -o json 2>/dev/null || echo '{}')
        if [ "$VS_JSON" != "{}" ]; then
          ROUTES=$(echo "$VS_JSON" | jq '[.spec.http[].route[]? | {subset: .destination.subset, weight: (.weight // 100)}]' 2>/dev/null || echo "[]")
          
          # Extract current weights
          STABLE_W=$(echo "$ROUTES" | jq '[.[] | select(.subset == "stable")][0].weight // 100')
          CANARY_W=$(echo "$ROUTES" | jq '[.[] | select(.subset == "canary")][0].weight // 0')
          CURRENT_WEIGHTS='{"stable": '$STABLE_W', "canary": '$CANARY_W'}'
        fi
        MESSAGE="Retrieved routing status for $SERVICE"
        ;;

      reset)
        cat <<VS | $KUBECTL apply -f -
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: $VS_NAME
  namespace: $NAMESPACE
spec:
  hosts:
  - $SERVICE
  http:
  - route:
    - destination:
        host: $SERVICE
        subset: stable
      weight: 100
VS
        CURRENT_WEIGHTS='{"stable": 100, "canary": 0}'
        MESSAGE="Reset traffic to 100% stable"
        ;;

      *)
        SUCCESS="false"
        MESSAGE="Unknown operation: $OPERATION"
        ;;
    esac
    ;;

  linkerd)
    # Linkerd uses TrafficSplit CRD
    case "$OPERATION" in
      set-weights)
        cat <<TS | $KUBECTL apply -f -
apiVersion: split.smi-spec.io/v1alpha2
kind: TrafficSplit
metadata:
  name: $SERVICE-split
  namespace: $NAMESPACE
spec:
  service: $SERVICE
  backends:
  - service: $SERVICE-stable
    weight: $STABLE_WEIGHT
  - service: $SERVICE-canary
    weight: $CANARY_WEIGHT
TS
        CURRENT_WEIGHTS='{"stable": '$STABLE_WEIGHT', "canary": '$CANARY_WEIGHT'}'
        MESSAGE="Updated TrafficSplit: $STABLE_WEIGHT% stable, $CANARY_WEIGHT% canary"
        ;;

      get-status)
        TS_JSON=$($KUBECTL get trafficsplit "$SERVICE-split" -o json 2>/dev/null || echo '{}')
        if [ "$TS_JSON" != "{}" ]; then
          ROUTES=$(echo "$TS_JSON" | jq '[.spec.backends[] | {subset: .service, weight: .weight}]' 2>/dev/null || echo "[]")
        fi
        MESSAGE="Retrieved TrafficSplit status for $SERVICE"
        ;;

      reset)
        cat <<TS | $KUBECTL apply -f -
apiVersion: split.smi-spec.io/v1alpha2
kind: TrafficSplit
metadata:
  name: $SERVICE-split
  namespace: $NAMESPACE
spec:
  service: $SERVICE
  backends:
  - service: $SERVICE-stable
    weight: 100
TS
        CURRENT_WEIGHTS='{"stable": 100, "canary": 0}'
        MESSAGE="Reset TrafficSplit to 100% stable"
        ;;

      *)
        SUCCESS="false"
        MESSAGE="Operation $OPERATION not supported for Linkerd"
        ;;
    esac
    ;;

  *)
    SUCCESS="false"
    MESSAGE="Unknown mesh type: $MESH_TYPE"
    ;;
esac

# Output result
cat <<EOF
{
  "success": $SUCCESS,
  "operation": "$OPERATION",
  "service": "$SERVICE",
  "namespace": "$NAMESPACE",
  "meshType": "$MESH_TYPE",
  "currentWeights": $CURRENT_WEIGHTS,
  "routes": $ROUTES,
  "headerRoutes": $HEADER_ROUTES,
  "message": "$MESSAGE"
}
EOF
        `.trim(),
    ]);
  },
};
