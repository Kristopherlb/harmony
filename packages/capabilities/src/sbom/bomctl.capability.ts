/**
 * packages/capabilities/src/sbom/bomctl.capability.ts
 * Bomctl Capability (OCS-001 Transformer Pattern)
 *
 * SBOM manipulation using OpenSSF Bomctl.
 * Merge, split, diff, and transform SBOMs.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
  'merge',      // Merge multiple SBOMs
  'diff',       // Diff two SBOMs
  'fetch',      // Fetch SBOM from OCI registry
  'push',       // Push SBOM to OCI registry
  'list',       // List components in SBOM
  'import',     // Import SBOM to local store
  'export',     // Export SBOM from local store
]).describe('Bomctl operation');

const formatSchema = z.enum([
  'spdx-json',
  'cyclonedx-json',
  'spdx-tv',
]).describe('SBOM format');

const inputSchema = z
  .object({
    operation: operationSchema,
    sbomPaths: z.array(z.string()).optional().describe('Paths to SBOM files'),
    sbomUrl: z.string().optional().describe('OCI URL for fetch/push'),
    outputPath: z.string().optional().describe('Output file path'),
    outputFormat: formatSchema.optional().describe('Output format'),
    componentName: z.string().optional().describe('Component name filter'),
    depth: z.number().optional().describe('Max depth for list operation'),
  })
  .describe('Bomctl input');

const componentSchema = z.object({
  name: z.string().describe('Component name'),
  version: z.string().optional().describe('Component version'),
  purl: z.string().optional().describe('Package URL'),
  supplier: z.string().optional().describe('Supplier name'),
  licenses: z.array(z.string()).optional().describe('License identifiers'),
});

const diffResultSchema = z.object({
  added: z.array(componentSchema).describe('Added components'),
  removed: z.array(componentSchema).describe('Removed components'),
  modified: z.array(z.object({
    component: componentSchema,
    changes: z.array(z.string()),
  })).describe('Modified components'),
});

const outputSchema = z
  .object({
    success: z.boolean().describe('Whether the operation succeeded'),
    operation: operationSchema.describe('Operation performed'),
    outputPath: z.string().optional().describe('Output file path'),
    components: z.array(componentSchema).optional().describe('Listed components'),
    componentCount: z.number().optional().describe('Number of components'),
    diff: diffResultSchema.optional().describe('Diff results'),
    sbomUrl: z.string().optional().describe('SBOM URL (for push)'),
    message: z.string().describe('Human-readable result message'),
  })
  .describe('Bomctl output');

const configSchema = z
  .object({
    defaultFormat: formatSchema.optional().describe('Default output format'),
    registryUrl: z.string().optional().describe('Default OCI registry'),
  })
  .describe('Bomctl configuration');

const secretsSchema = z
  .object({
    registryToken: z.string().optional().describe('OCI registry auth token'),
  })
  .describe('Bomctl secrets');

export type BomctlInput = z.infer<typeof inputSchema>;
export type BomctlOutput = z.infer<typeof outputSchema>;
export type BomctlConfig = z.infer<typeof configSchema>;
export type BomctlSecrets = z.infer<typeof secretsSchema>;

export const bomctlCapability: Capability<
  BomctlInput,
  BomctlOutput,
  BomctlConfig,
  BomctlSecrets
> = {
  metadata: {
    id: 'golden.sbom.bomctl',
    domain: 'sbom',
    version: '1.0.0',
    name: 'bomctl',
    description:
      'SBOM manipulation using OpenSSF Bomctl. Merge, diff, and transform SBOMs between formats. Push/pull from OCI registries.',
    tags: ['transformer', 'sbom', 'openssf', 'supply-chain'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['sbom:write'],
    dataClassification: 'INTERNAL',
    networkAccess: {
      allowOutbound: [
        'ghcr.io',
        '*.docker.io',
        '*.azurecr.io',
        '*.gcr.io',
      ],
    },
  },
  operations: {
    isIdempotent: true,
    retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 2, backoffCoefficient: 2 },
    errorMap: (error: unknown) => {
      if (error instanceof Error) {
        if (error.message.includes('connection')) return 'RETRYABLE';
        if (error.message.includes('not found')) return 'FATAL';
      }
      return 'FATAL';
    },
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {
      operation: 'merge',
      sbomPaths: ['sbom-frontend.json', 'sbom-backend.json'],
      outputPath: 'sbom-merged.json',
      outputFormat: 'cyclonedx-json',
    },
    exampleOutput: {
      success: true,
      operation: 'merge',
      outputPath: 'sbom-merged.json',
      componentCount: 245,
      message: 'Merged 2 SBOMs with 245 total components',
    },
    usageNotes:
      'Use merge to combine SBOMs from multiple build stages. Use diff to compare SBOMs between releases for dependency changes.',
  },
  factory: (
    dag,
    context: CapabilityContext<BomctlConfig, BomctlSecrets>,
    input: BomctlInput
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

    const outputFormat = input.outputFormat ?? context.config.defaultFormat ?? 'cyclonedx-json';

    const payload = {
      operation: input.operation,
      sbomPaths: input.sbomPaths,
      sbomUrl: input.sbomUrl,
      outputPath: input.outputPath,
      outputFormat,
      componentName: input.componentName,
      depth: input.depth,
    };

    let container = d
      .container()
      .from('ghcr.io/bomctl/bomctl:latest')
      .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
      .withEnvVariable('OPERATION', input.operation);

    if (context.secretRefs.registryToken) {
      container = container.withMountedSecret(
        '/run/secrets/registry_token',
        context.secretRefs.registryToken as unknown as DaggerSecret
      );
    }

    return container.withExec([
      'sh',
      '-c',
      `
#!/bin/sh
set -e

OPERATION="${input.operation}"
OUTPUT_PATH="${input.outputPath ?? 'output.json'}"
OUTPUT_FORMAT="${outputFormat}"

# Registry auth
if [ -f /run/secrets/registry_token ]; then
  export BOMCTL_REGISTRY_TOKEN=$(cat /run/secrets/registry_token)
fi

SUCCESS=true
MESSAGE=""
COMPONENT_COUNT=0
COMPONENTS="[]"
DIFF_RESULT="null"
SBOM_URL=""

case "$OPERATION" in
  merge)
    SBOM_PATHS="${input.sbomPaths?.join(' ') ?? ''}"
    if [ -z "$SBOM_PATHS" ]; then
      SUCCESS=false
      MESSAGE="No SBOM paths provided for merge"
    else
      bomctl merge $SBOM_PATHS --output "$OUTPUT_PATH" --format "$OUTPUT_FORMAT" 2>/dev/null || {
        SUCCESS=false
        MESSAGE="Merge failed"
      }
      if [ "$SUCCESS" = "true" ]; then
        COMPONENT_COUNT=$(bomctl list "$OUTPUT_PATH" 2>/dev/null | wc -l || echo 0)
        MESSAGE="Merged SBOMs with $COMPONENT_COUNT components"
      fi
    fi
    ;;
    
  diff)
    SBOM_PATHS="${input.sbomPaths?.join(' ') ?? ''}"
    SBOM1=$(echo "$SBOM_PATHS" | awk '{print $1}')
    SBOM2=$(echo "$SBOM_PATHS" | awk '{print $2}')
    if [ -z "$SBOM1" ] || [ -z "$SBOM2" ]; then
      SUCCESS=false
      MESSAGE="Two SBOM paths required for diff"
    else
      DIFF_OUTPUT=$(bomctl diff "$SBOM1" "$SBOM2" --format json 2>/dev/null || echo "{}")
      DIFF_RESULT="$DIFF_OUTPUT"
      MESSAGE="Generated diff between SBOMs"
    fi
    ;;
    
  fetch)
    SBOM_URL="${input.sbomUrl ?? ''}"
    if [ -z "$SBOM_URL" ]; then
      SUCCESS=false
      MESSAGE="SBOM URL required for fetch"
    else
      bomctl fetch "$SBOM_URL" --output "$OUTPUT_PATH" 2>/dev/null || {
        SUCCESS=false
        MESSAGE="Fetch failed"
      }
      MESSAGE="Fetched SBOM from $SBOM_URL"
    fi
    ;;
    
  push)
    SBOM_URL="${input.sbomUrl ?? ''}"
    SBOM_PATH="${input.sbomPaths?.[0] ?? ''}"
    if [ -z "$SBOM_URL" ] || [ -z "$SBOM_PATH" ]; then
      SUCCESS=false
      MESSAGE="SBOM URL and path required for push"
    else
      bomctl push "$SBOM_PATH" --target "$SBOM_URL" 2>/dev/null || {
        SUCCESS=false
        MESSAGE="Push failed"
      }
      MESSAGE="Pushed SBOM to $SBOM_URL"
    fi
    ;;
    
  list)
    SBOM_PATH="${input.sbomPaths?.[0] ?? ''}"
    if [ -z "$SBOM_PATH" ]; then
      SUCCESS=false
      MESSAGE="SBOM path required for list"
    else
      COMPONENTS=$(bomctl list "$SBOM_PATH" --format json ${input.depth ? '--depth ' + input.depth : ''} 2>/dev/null || echo "[]")
      COMPONENT_COUNT=$(echo "$COMPONENTS" | jq 'length' 2>/dev/null || echo 0)
      MESSAGE="Listed $COMPONENT_COUNT components"
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
  "components": $COMPONENTS,
  "componentCount": $COMPONENT_COUNT,
  "diff": $DIFF_RESULT,
  "sbomUrl": "$SBOM_URL",
  "message": "$MESSAGE"
}
EOF
        `.trim(),
    ]);
  },
};
