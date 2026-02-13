/**
 * packages/capabilities/src/security/slsa-verifier.capability.ts
 * SLSA Verifier Capability (OCS-001 Guardian Pattern)
 *
 * Verify SLSA provenance attestations on artifacts.
 * OpenSSF Graduated project for supply chain security.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
  'verify-artifact',     // Verify artifact against provenance
  'verify-image',        // Verify container image provenance
  'verify-npm',          // Verify npm package provenance
  'inspect-provenance',  // Inspect provenance without verification
]).describe('SLSA verifier operation');

const slsaLevelSchema = z.enum(['1', '2', '3', '4']).describe('SLSA build level');

const inputSchema = z
  .object({
    operation: operationSchema,
    artifactPath: z.string().optional().describe('Path to artifact to verify'),
    imageRef: z.string().optional().describe('Container image reference (for verify-image)'),
    packageName: z.string().optional().describe('npm package name (for verify-npm)'),
    packageVersion: z.string().optional().describe('npm package version'),
    provenancePath: z.string().optional().describe('Path to provenance file'),
    sourceUri: z.string().optional().describe('Expected source repository URI'),
    sourceBranch: z.string().optional().describe('Expected source branch'),
    sourceTag: z.string().optional().describe('Expected source tag'),
    sourceDigest: z.string().optional().describe('Expected source commit digest'),
    builderID: z.string().optional().describe('Expected builder ID'),
    minSlsaLevel: slsaLevelSchema.optional().describe('Minimum required SLSA level'),
  })
  .describe('SLSA Verifier input');

const outputSchema = z
  .object({
    success: z.boolean().describe('Whether the operation succeeded'),
    operation: operationSchema.describe('Operation performed'),
    verified: z.boolean().optional().describe('Whether verification passed'),
    slsaLevel: slsaLevelSchema.optional().describe('Detected SLSA level'),
    builderID: z.string().optional().describe('Builder ID from provenance'),
    sourceUri: z.string().optional().describe('Source repository from provenance'),
    sourceDigest: z.string().optional().describe('Source commit digest'),
    buildTimestamp: z.string().optional().describe('Build timestamp from provenance'),
    subjects: z.array(z.object({
      name: z.string().describe('Subject name'),
      digest: z.record(z.string()).describe('Subject digests'),
    })).optional().describe('Build subjects'),
    verificationErrors: z.array(z.string()).optional().describe('Verification error messages'),
    message: z.string().describe('Human-readable result message'),
  })
  .describe('SLSA Verifier output');

const configSchema = z
  .object({
    defaultMinSlsaLevel: slsaLevelSchema.optional().describe('Default minimum SLSA level'),
    trustedBuilders: z.array(z.string()).optional().describe('List of trusted builder IDs'),
  })
  .describe('SLSA Verifier configuration');

const secretsSchema = z
  .object({
    registryToken: z.string().optional().describe('Registry token for image verification'),
  })
  .describe('SLSA Verifier secrets');

export type SlsaVerifierInput = z.infer<typeof inputSchema>;
export type SlsaVerifierOutput = z.infer<typeof outputSchema>;
export type SlsaVerifierConfig = z.infer<typeof configSchema>;
export type SlsaVerifierSecrets = z.infer<typeof secretsSchema>;

export const slsaVerifierCapability: Capability<
  SlsaVerifierInput,
  SlsaVerifierOutput,
  SlsaVerifierConfig,
  SlsaVerifierSecrets
> = {
  metadata: {
    id: 'golden.security.slsa-verifier',
    domain: 'security',
    version: '1.0.0',
    name: 'slsaVerifier',
    description:
      'Verify SLSA provenance attestations on artifacts, container images, and npm packages. Ensures software was built securely from expected sources.',
    tags: ['guardian', 'security', 'slsa', 'openssf', 'supply-chain'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['security:verify'],
    dataClassification: 'INTERNAL',
    networkAccess: {
      allowOutbound: [
        'rekor.sigstore.dev',
        'ghcr.io',
        '*.docker.io',
        'registry.npmjs.org',
      ],
    },
    oscalControlIds: ['SA-12', 'CM-14'], // Supply chain, software authenticity
  },
  operations: {
    isIdempotent: true,
    retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 2, backoffCoefficient: 2 },
    errorMap: (error: unknown) => {
      if (error instanceof Error) {
        if (error.message.includes('connection')) return 'RETRYABLE';
        if (error.message.includes('timeout')) return 'RETRYABLE';
        if (error.message.includes('not found')) return 'FATAL';
      }
      return 'FATAL';
    },
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {
      operation: 'verify-image',
      imageRef: 'ghcr.io/org/harmony-worker:v2.0.0',
      sourceUri: 'github.com/org/harmony',
      minSlsaLevel: '3',
    },
    exampleOutput: {
      success: true,
      operation: 'verify-image',
      verified: true,
      slsaLevel: '3',
      builderID: 'https://github.com/slsa-framework/slsa-github-generator/.github/workflows/generator_container_slsa3.yml@refs/tags/v1.9.0',
      sourceUri: 'github.com/org/harmony',
      sourceDigest: 'abc123def456',
      buildTimestamp: '2024-01-15T10:30:00Z',
      message: 'SLSA verification passed at level 3',
    },
    usageNotes:
      'Use to verify provenance before deploying artifacts. Supports GitHub Actions, Google Cloud Build, and other SLSA-compliant builders.',
  },
  factory: (
    dag,
    context: CapabilityContext<SlsaVerifierConfig, SlsaVerifierSecrets>,
    input: SlsaVerifierInput
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

    const minSlsaLevel = input.minSlsaLevel ?? context.config.defaultMinSlsaLevel ?? '2';

    const payload = {
      operation: input.operation,
      artifactPath: input.artifactPath,
      imageRef: input.imageRef,
      packageName: input.packageName,
      packageVersion: input.packageVersion,
      provenancePath: input.provenancePath,
      sourceUri: input.sourceUri,
      sourceBranch: input.sourceBranch,
      sourceTag: input.sourceTag,
      sourceDigest: input.sourceDigest,
      builderID: input.builderID,
      minSlsaLevel,
    };

    let container = d
      .container()
      .from('ghcr.io/slsa-framework/slsa-verifier:latest')
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
IMAGE_REF="${input.imageRef ?? ''}"
ARTIFACT_PATH="${input.artifactPath ?? ''}"
PROVENANCE_PATH="${input.provenancePath ?? ''}"
SOURCE_URI="${input.sourceUri ?? ''}"
SOURCE_BRANCH="${input.sourceBranch ?? ''}"
SOURCE_TAG="${input.sourceTag ?? ''}"
SOURCE_DIGEST="${input.sourceDigest ?? ''}"
BUILDER_ID="${input.builderID ?? ''}"
MIN_SLSA_LEVEL="${minSlsaLevel}"

# Registry auth if provided
if [ -f /run/secrets/registry_token ]; then
  export REGISTRY_TOKEN=$(cat /run/secrets/registry_token)
fi

SUCCESS=true
VERIFIED=""
SLSA_LEVEL=""
BUILDER_ID_OUT=""
SOURCE_URI_OUT=""
SOURCE_DIGEST_OUT=""
BUILD_TIMESTAMP=""
SUBJECTS="[]"
VERIFICATION_ERRORS="[]"
MESSAGE=""

build_args() {
  local args=""
  if [ -n "$SOURCE_URI" ]; then
    args="$args --source-uri=$SOURCE_URI"
  fi
  if [ -n "$SOURCE_BRANCH" ]; then
    args="$args --source-branch=$SOURCE_BRANCH"
  fi
  if [ -n "$SOURCE_TAG" ]; then
    args="$args --source-tag=$SOURCE_TAG"
  fi
  if [ -n "$SOURCE_DIGEST" ]; then
    args="$args --source-versioned-tag=$SOURCE_DIGEST"
  fi
  if [ -n "$BUILDER_ID" ]; then
    args="$args --builder-id=$BUILDER_ID"
  fi
  echo "$args"
}

case "$OPERATION" in
  verify-image)
    if [ -z "$IMAGE_REF" ]; then
      SUCCESS=false
      MESSAGE="Image reference required for verify-image"
    else
      ARGS=$(build_args)
      set +e
      slsa-verifier verify-image "$IMAGE_REF" $ARGS 2>&1 | tee /tmp/verify.log
      VERIFY_RC=$?
      set -e
      
      if [ $VERIFY_RC -eq 0 ]; then
        VERIFIED=true
        SLSA_LEVEL="$MIN_SLSA_LEVEL"
        MESSAGE="SLSA verification passed at level $MIN_SLSA_LEVEL"
      else
        VERIFIED=false
        VERIFICATION_ERRORS=$(cat /tmp/verify.log | jq -Rs 'split("\n") | map(select(length > 0))')
        MESSAGE="SLSA verification failed"
      fi
    fi
    ;;
    
  verify-artifact)
    if [ -z "$ARTIFACT_PATH" ] || [ -z "$PROVENANCE_PATH" ]; then
      SUCCESS=false
      MESSAGE="Artifact path and provenance path required"
    else
      ARGS=$(build_args)
      set +e
      slsa-verifier verify-artifact "$ARTIFACT_PATH" --provenance-path="$PROVENANCE_PATH" $ARGS 2>&1 | tee /tmp/verify.log
      VERIFY_RC=$?
      set -e
      
      if [ $VERIFY_RC -eq 0 ]; then
        VERIFIED=true
        SLSA_LEVEL="$MIN_SLSA_LEVEL"
        MESSAGE="SLSA verification passed"
      else
        VERIFIED=false
        VERIFICATION_ERRORS=$(cat /tmp/verify.log | jq -Rs 'split("\n") | map(select(length > 0))')
        MESSAGE="SLSA verification failed"
      fi
    fi
    ;;
    
  verify-npm)
    if [ -z "${input.packageName ?? ''}" ]; then
      SUCCESS=false
      MESSAGE="Package name required for verify-npm"
    else
      PKG="${input.packageName}"
      VER="${input.packageVersion ?? 'latest'}"
      ARGS=$(build_args)
      set +e
      slsa-verifier verify-npm-package "$PKG@$VER" $ARGS 2>&1 | tee /tmp/verify.log
      VERIFY_RC=$?
      set -e
      
      if [ $VERIFY_RC -eq 0 ]; then
        VERIFIED=true
        MESSAGE="npm package SLSA verification passed"
      else
        VERIFIED=false
        VERIFICATION_ERRORS=$(cat /tmp/verify.log | jq -Rs 'split("\n") | map(select(length > 0))')
        MESSAGE="npm package SLSA verification failed"
      fi
    fi
    ;;
    
  inspect-provenance)
    if [ -z "$PROVENANCE_PATH" ]; then
      SUCCESS=false
      MESSAGE="Provenance path required for inspection"
    else
      # Parse provenance JSON
      if [ -f "$PROVENANCE_PATH" ]; then
        PROV=$(cat "$PROVENANCE_PATH")
        BUILDER_ID_OUT=$(echo "$PROV" | jq -r '.predicate.builder.id // empty' 2>/dev/null || echo "")
        SOURCE_URI_OUT=$(echo "$PROV" | jq -r '.predicate.invocation.configSource.uri // empty' 2>/dev/null || echo "")
        SOURCE_DIGEST_OUT=$(echo "$PROV" | jq -r '.predicate.invocation.configSource.digest.sha1 // empty' 2>/dev/null || echo "")
        BUILD_TIMESTAMP=$(echo "$PROV" | jq -r '.predicate.metadata.buildInvokedTimestamp // empty' 2>/dev/null || echo "")
        SUBJECTS=$(echo "$PROV" | jq '.subject // []' 2>/dev/null || echo "[]")
        MESSAGE="Provenance inspected successfully"
      else
        SUCCESS=false
        MESSAGE="Provenance file not found"
      fi
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
  "verified": \${VERIFIED:-null},
  "slsaLevel": "$SLSA_LEVEL",
  "builderID": "$BUILDER_ID_OUT",
  "sourceUri": "$SOURCE_URI_OUT",
  "sourceDigest": "$SOURCE_DIGEST_OUT",
  "buildTimestamp": "$BUILD_TIMESTAMP",
  "subjects": $SUBJECTS,
  "verificationErrors": $VERIFICATION_ERRORS,
  "message": "$MESSAGE"
}
EOF
    `.trim(),
    ]);
  },
};
