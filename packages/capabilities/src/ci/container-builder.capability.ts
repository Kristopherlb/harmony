/**
 * packages/capabilities/src/ci/container-builder.capability.ts
 * Container Builder Capability (OCS-001 Transformer Pattern)
 *
 * Build OCI container images using Dagger.
 * Supports multi-stage builds, build args, and registry push.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
    'build',           // Build image only (no push)
    'build-and-push',  // Build and push to registry
]).describe('Container builder operation');

const inputSchema = z
    .object({
        operation: operationSchema,
        context: z.string().describe('Build context path (directory containing Dockerfile)'),
        dockerfile: z.string().optional().describe('Dockerfile path relative to context, defaults to Dockerfile'),
        target: z.string().optional().describe('Multi-stage build target'),
        buildArgs: z.record(z.string()).optional().describe('Build arguments'),
        tags: z.array(z.string()).min(1).describe('Image tags (e.g., ["registry/image:v1.0.0"])'),
        registry: z.string().optional().describe('Registry address for push'),
        platform: z.string().optional().describe('Target platform (e.g., linux/amd64)'),
        labels: z.record(z.string()).optional().describe('OCI image labels'),
        cacheFrom: z.array(z.string()).optional().describe('Cache sources for build'),
        cacheTo: z.string().optional().describe('Cache export destination'),
        noCache: z.boolean().optional().describe('Build without cache'),
    })
    .describe('Container Builder input');

const outputSchema = z
    .object({
        imageRef: z.string().describe('Built image reference'),
        digest: z.string().optional().describe('Image digest (sha256:...) if pushed'),
        size: z.number().optional().describe('Image size in bytes'),
        tags: z.array(z.string()).describe('Applied tags'),
        buildDuration: z.number().describe('Build duration in milliseconds'),
        pushed: z.boolean().describe('Whether image was pushed to registry'),
        layers: z.number().optional().describe('Number of layers in image'),
    })
    .describe('Container Builder output');

const configSchema = z
    .object({
        defaultRegistry: z.string().optional().describe('Default registry for push'),
        defaultPlatform: z.string().optional().describe('Default build platform'),
    })
    .describe('Container Builder configuration');

const secretsSchema = z
    .object({
        registryUsername: z.string().optional().describe('Registry username'),
        registryPassword: z.string().optional().describe('Registry password or token'),
    })
    .describe('Container Builder secrets');

export type ContainerBuilderInput = z.infer<typeof inputSchema>;
export type ContainerBuilderOutput = z.infer<typeof outputSchema>;
export type ContainerBuilderConfig = z.infer<typeof configSchema>;
export type ContainerBuilderSecrets = z.infer<typeof secretsSchema>;

export const containerBuilderCapability: Capability<
    ContainerBuilderInput,
    ContainerBuilderOutput,
    ContainerBuilderConfig,
    ContainerBuilderSecrets
> = {
    metadata: {
        id: 'golden.ci.container-builder',
        domain: 'ci',
        version: '1.0.0',
        name: 'containerBuilder',
        description:
            'Build OCI container images using Dagger. Supports multi-stage builds, build args, labels, caching, and registry push.',
        tags: ['transformer', 'ci', 'containers', 'docker', 'oci'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['ci:build'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: [
                'ghcr.io',
                '*.docker.io',
                '*.gcr.io',
                '*.azurecr.io',
                '*.amazonaws.com',
                'quay.io',
            ],
        },
    },
    operations: {
        isIdempotent: false, // Build may produce different digests
        retryPolicy: { maxAttempts: 2, initialIntervalSeconds: 5, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('network')) return 'RETRYABLE';
                if (error.message.includes('timeout')) return 'RETRYABLE';
                if (error.message.includes('rate limit')) return 'RETRYABLE';
                if (error.message.includes('unauthorized')) return 'FATAL';
                if (error.message.includes('not found')) return 'FATAL';
            }
            return 'FATAL';
        },
        costFactor: 'HIGH',
    },
    aiHints: {
        exampleInput: {
            operation: 'build-and-push',
            context: 'packages/blueprints',
            dockerfile: 'Dockerfile',
            target: 'production',
            tags: ['ghcr.io/org/harmony-worker:v2.0.0'],
            buildArgs: { WORKER_BUILD_ID: 'v2.0.0' },
            registry: 'ghcr.io',
        },
        exampleOutput: {
            imageRef: 'ghcr.io/org/harmony-worker:v2.0.0',
            digest: 'sha256:abc123def456...',
            size: 156000000,
            tags: ['ghcr.io/org/harmony-worker:v2.0.0'],
            buildDuration: 45000,
            pushed: true,
            layers: 12,
        },
        usageNotes:
            'Use target for multi-stage builds to select the final stage. Build args are passed as --build-arg. For CI, ensure registry credentials are provided via secrets.',
    },
    factory: (
        dag,
        context: CapabilityContext<ContainerBuilderConfig, ContainerBuilderSecrets>,
        input: ContainerBuilderInput
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

        const registry = input.registry ?? context.config.defaultRegistry;
        const platform = input.platform ?? context.config.defaultPlatform ?? 'linux/amd64';
        const dockerfile = input.dockerfile || 'Dockerfile';

        const payload = {
            operation: input.operation,
            context: input.context,
            dockerfile,
            target: input.target,
            buildArgs: input.buildArgs ?? {},
            tags: input.tags,
            registry,
            platform,
            labels: input.labels ?? {},
            cacheFrom: input.cacheFrom,
            cacheTo: input.cacheTo,
            noCache: input.noCache ?? false,
        };

        let container = d
            .container()
            .from('docker:24-cli')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('OPERATION', input.operation)
            .withEnvVariable('CONTEXT_PATH', input.context)
            .withEnvVariable('DOCKER_BUILDKIT', '1');

        // Mount registry credentials if provided (ISS-compliant)
        if (context.secretRefs.registryUsername) {
            container = container.withMountedSecret(
                '/run/secrets/registry_username',
                context.secretRefs.registryUsername as unknown as DaggerSecret
            );
        }
        if (context.secretRefs.registryPassword) {
            container = container.withMountedSecret(
                '/run/secrets/registry_password',
                context.secretRefs.registryPassword as unknown as DaggerSecret
            );
        }

        return container.withExec([
            'sh',
            '-c',
            `
#!/bin/sh
set -e

# Parse input
INPUT_JSON='${JSON.stringify(payload)}'
OPERATION="${input.operation}"
CONTEXT_PATH="${input.context}"
DOCKERFILE="${dockerfile}"
TARGET="${input.target ?? ''}"
PLATFORM="${platform}"
NO_CACHE="${input.noCache ?? false}"

apk add --no-cache jq >/dev/null 2>&1

START_TIME=$(date +%s%3N)

# Login to registry if credentials provided
if [ -f /run/secrets/registry_username ] && [ -f /run/secrets/registry_password ]; then
  REGISTRY_USER=$(cat /run/secrets/registry_username)
  REGISTRY_PASS=$(cat /run/secrets/registry_password)
  REGISTRY="${registry ?? ''}"
  if [ -n "$REGISTRY" ]; then
    echo "$REGISTRY_PASS" | docker login "$REGISTRY" -u "$REGISTRY_USER" --password-stdin
  fi
fi

# Build docker build args (avoid eval; reduce injection risk)
set -- docker build --platform "$PLATFORM" -f "$CONTEXT_PATH/$DOCKERFILE"

# Add target if specified
if [ -n "$TARGET" ]; then
  set -- "$@" --target "$TARGET"
fi

# Add build args
BUILD_ARGS='${JSON.stringify(input.buildArgs ?? {})}'
for key in $(echo "$BUILD_ARGS" | jq -r 'keys[]' 2>/dev/null || echo ""); do
  value=$(echo "$BUILD_ARGS" | jq -r ".[\\"$key\\"]")
  set -- "$@" --build-arg "$key=$value"
done

# Add labels
LABELS='${JSON.stringify(input.labels ?? {})}'
for key in $(echo "$LABELS" | jq -r 'keys[]' 2>/dev/null || echo ""); do
  value=$(echo "$LABELS" | jq -r ".[\\"$key\\"]")
  set -- "$@" --label "$key=$value"
done

# Add cache options
if [ "$NO_CACHE" = "true" ]; then
  set -- "$@" --no-cache
fi

# Add tags
FIRST_TAG=""
TAGS='${JSON.stringify(input.tags)}'
for tag in $(echo "$TAGS" | jq -r '.[]'); do
  set -- "$@" -t "$tag"
  if [ -z "$FIRST_TAG" ]; then
    FIRST_TAG="$tag"
  fi
done

# Build the image
set -- "$@" "$CONTEXT_PATH"
"$@"

# Get image size
IMAGE_SIZE=$(docker image inspect "$FIRST_TAG" --format '{{.Size}}' 2>/dev/null || echo 0)
LAYER_COUNT=$(docker image inspect "$FIRST_TAG" --format '{{len .RootFS.Layers}}' 2>/dev/null || echo 0)

# Push if operation is build-and-push
PUSHED=false
DIGEST=""
if [ "$OPERATION" = "build-and-push" ]; then
  for tag in $(echo "$TAGS" | jq -r '.[]'); do
    docker push "$tag"
  done
  PUSHED=true
  # Get digest after push
  DIGEST=$(docker image inspect "$FIRST_TAG" --format '{{index .RepoDigests 0}}' 2>/dev/null | cut -d@ -f2 || echo "")
fi

END_TIME=$(date +%s%3N)
DURATION=$((END_TIME - START_TIME))

# Output result
cat <<EOF
{
  "imageRef": "$FIRST_TAG",
  "digest": "$DIGEST",
  "size": $IMAGE_SIZE,
  "tags": $TAGS,
  "buildDuration": $DURATION,
  "pushed": $PUSHED,
  "layers": $LAYER_COUNT
}
EOF
        `.trim(),
        ]);
    },
};
