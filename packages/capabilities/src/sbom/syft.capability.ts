/**
 * packages/capabilities/src/sbom/syft.capability.ts
 * Syft SBOM Generation Capability (OCS-001 Commander Pattern)
 *
 * Generates Software Bill of Materials (SBOM) from container images,
 * filesystems, and archives using Anchore Syft.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const sourceTypeSchema = z.enum([
    'image',       // Container image (docker:, registry:, oci-dir:)
    'directory',   // Local filesystem directory
    'file',        // Single file or archive
    'registry',    // Container registry image
]).describe('Type of source to generate SBOM from');

const formatSchema = z.enum([
    'spdx-json',
    'cyclonedx-json',
    'syft-json',
    'spdx-tag-value',
    'cyclonedx-xml',
    'github-json',
    'table',
]).describe('SBOM output format');

const packageSchema = z.object({
    name: z.string().describe('Package name'),
    version: z.string().describe('Package version'),
    type: z.string().describe('Package type (npm, pip, gem, etc.)'),
    purl: z.string().optional().describe('Package URL'),
    licenses: z.array(z.string()).optional().describe('Package licenses'),
    cpes: z.array(z.string()).optional().describe('CPE identifiers'),
});

const inputSchema = z
    .object({
        sourceType: sourceTypeSchema,
        source: z.string().describe('Source to scan (image name, path, registry URL)'),
        format: formatSchema.optional().describe('Output format'),
        scope: z.enum(['all', 'os', 'all-layers']).optional().describe('Scan scope for images'),
        catalogers: z.array(z.string()).optional().describe('Specific catalogers to use'),
        excludePaths: z.array(z.string()).optional().describe('Paths to exclude from scan'),
    })
    .describe('Syft SBOM generation input');

const outputSchema = z
    .object({
        sbom: z.string().describe('Generated SBOM content'),
        format: formatSchema.describe('Format of the generated SBOM'),
        packageCount: z.number().describe('Total number of packages found'),
        packages: z.array(packageSchema).describe('Summary of packages (truncated)'),
        source: z.object({
            type: z.string(),
            target: z.string(),
        }).describe('Source that was scanned'),
        scanDuration: z.number().describe('Scan duration in milliseconds'),
    })
    .describe('Syft SBOM generation output');

const configSchema = z
    .object({
        defaultFormat: formatSchema.optional().describe('Default output format'),
        maxPackages: z.number().int().positive().optional().describe('Max packages to include in summary'),
    })
    .describe('Syft configuration');

const secretsSchema = z
    .object({
        registryAuth: z.string().optional().describe('Registry authentication credentials'),
    })
    .describe('Syft secrets');

export type SyftInput = z.infer<typeof inputSchema>;
export type SyftOutput = z.infer<typeof outputSchema>;
export type SyftConfig = z.infer<typeof configSchema>;
export type SyftSecrets = z.infer<typeof secretsSchema>;

export const syftCapability: Capability<
    SyftInput,
    SyftOutput,
    SyftConfig,
    SyftSecrets
> = {
    metadata: {
        id: 'golden.sbom.syft',
        domain: 'sbom',
        version: '1.0.0',
        name: 'syft',
        description:
            'SBOM generation using Anchore Syft. Creates Software Bill of Materials from container images, filesystems, and archives in SPDX, CycloneDX, or Syft native formats.',
        tags: ['commander', 'sbom', 'security', 'supply-chain', 'spdx', 'cyclonedx'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['sbom:generate'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            // May need to pull images from registries
            allowOutbound: [
                '*.docker.io',
                'ghcr.io',
                '*.gcr.io',
                '*.azurecr.io',
                '*.amazonaws.com',
                'quay.io',
            ],
        },
    },
    operations: {
        isIdempotent: true,
        retryPolicy: { maxAttempts: 2, initialIntervalSeconds: 2, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('not found')) return 'FATAL';
                if (error.message.includes('unauthorized')) return 'FATAL';
                if (error.message.includes('timeout')) return 'RETRYABLE';
                if (error.message.includes('connection')) return 'RETRYABLE';
            }
            return 'FATAL';
        },
        costFactor: 'MEDIUM',
    },
    aiHints: {
        exampleInput: {
            sourceType: 'image',
            source: 'alpine:3.18',
            format: 'cyclonedx-json',
        },
        exampleOutput: {
            sbom: '{"bomFormat":"CycloneDX","specVersion":"1.4",...}',
            format: 'cyclonedx-json',
            packageCount: 42,
            packages: [
                {
                    name: 'alpine-baselayout',
                    version: '3.4.3-r1',
                    type: 'apk',
                    purl: 'pkg:apk/alpine/alpine-baselayout@3.4.3-r1',
                    licenses: ['GPL-2.0-only'],
                },
            ],
            source: {
                type: 'image',
                target: 'alpine:3.18',
            },
            scanDuration: 5230,
        },
        usageNotes:
            'Use spdx-json or cyclonedx-json for standard SBOM formats. For container images, use sourceType=image. The SBOM output can be passed to Grype or Bomctl for further processing.',
    },
    factory: (
        dag,
        context: CapabilityContext<SyftConfig, SyftSecrets>,
        input: SyftInput
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

        const format = input.format ?? context.config.defaultFormat ?? 'cyclonedx-json';
        const maxPackages = context.config.maxPackages ?? 50;

        const payload = {
            sourceType: input.sourceType,
            source: input.source,
            format,
            scope: input.scope ?? 'all',
            catalogers: input.catalogers,
            excludePaths: input.excludePaths,
            maxPackages,
        };

        let container = d
            .container()
            .from('anchore/syft:latest')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('SOURCE_TYPE', input.sourceType)
            .withEnvVariable('SOURCE', input.source)
            .withEnvVariable('FORMAT', format);

        // Mount registry auth if provided
        if (context.secretRefs.registryAuth && typeof (container as Record<string, unknown>).withMountedSecret === 'function') {
            container = container.withMountedSecret('/run/secrets/registry_auth', context.secretRefs.registryAuth as unknown as DaggerSecret);
        }

        return container.withExec([
            'sh',
            '-c',
            `
#!/bin/sh
set -e

SOURCE_TYPE="${input.sourceType}"
SOURCE="${input.source}"
FORMAT="${format}"
SCOPE="${input.scope ?? 'all'}"

# Build source reference based on type
case "$SOURCE_TYPE" in
  image)
    SOURCE_REF="$SOURCE"
    ;;
  directory)
    SOURCE_REF="dir:$SOURCE"
    ;;
  file)
    SOURCE_REF="file:$SOURCE"
    ;;
  registry)
    SOURCE_REF="registry:$SOURCE"
    ;;
esac

# Apply registry auth if available
if [ -f /run/secrets/registry_auth ]; then
  export SYFT_REGISTRY_AUTH_FILE=/run/secrets/registry_auth
fi

# Run Syft
START_TIME=$(date +%s%3N)
syft "$SOURCE_REF" -o "$FORMAT" --scope "$SCOPE" > /tmp/sbom.json 2>/tmp/syft.log
END_TIME=$(date +%s%3N)

DURATION=$((END_TIME - START_TIME))

# Parse package count from SBOM
if [ "$FORMAT" = "cyclonedx-json" ]; then
  PKG_COUNT=$(jq '.components | length' /tmp/sbom.json 2>/dev/null || echo 0)
  PACKAGES=$(jq '[.components[:${maxPackages}][] | {name: .name, version: .version, type: .type, purl: .purl, licenses: [.licenses[]?.license?.id // .licenses[]?.license?.name // empty]}]' /tmp/sbom.json 2>/dev/null || echo "[]")
elif [ "$FORMAT" = "spdx-json" ]; then
  PKG_COUNT=$(jq '.packages | length' /tmp/sbom.json 2>/dev/null || echo 0)
  PACKAGES=$(jq '[.packages[:${maxPackages}][] | {name: .name, version: .versionInfo, type: "unknown", purl: .externalRefs[]? | select(.referenceType == "purl") | .referenceLocator}]' /tmp/sbom.json 2>/dev/null || echo "[]")
else
  PKG_COUNT=0
  PACKAGES="[]"
fi

# Read SBOM content
SBOM_CONTENT=$(cat /tmp/sbom.json | jq -c '.')

# Output result
cat <<EOF
{
  "sbom": $(echo "$SBOM_CONTENT" | jq -Rs '.'),
  "format": "$FORMAT",
  "packageCount": $PKG_COUNT,
  "packages": $PACKAGES,
  "source": {
    "type": "$SOURCE_TYPE",
    "target": "$SOURCE"
  },
  "scanDuration": $DURATION
}
EOF
      `.trim(),
        ]);
    },
};
