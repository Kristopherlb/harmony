/**
 * packages/capabilities/src/security/sigstore.capability.ts
 * Sigstore Capability (OCS-001 Guardian Pattern)
 *
 * Keyless signing and verification using Fulcio (certificate authority)
 * and Rekor (transparency log). OpenSSF Graduated project.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
  'sign',           // Sign an artifact with keyless signature
  'verify',         // Verify an artifact signature
  'attest',         // Create and sign an in-toto attestation
  'verify-attest',  // Verify an attestation
]).describe('Sigstore operation');

const signatureFormatSchema = z.enum([
  'bundle',     // Sigstore bundle format (.sigstore)
  'signature',  // Detached signature only
  'certificate', // Certificate only
]).describe('Output format for signing');

const inputSchema = z
  .object({
    operation: operationSchema,
    artifactPath: z.string().optional().describe('Path to artifact to sign/verify'),
    artifactDigest: z.string().optional().describe('SHA256 digest of artifact (alternative to path)'),
    signatureBundle: z.string().optional().describe('Sigstore bundle for verification'),
    signaturePath: z.string().optional().describe('Path to signature file'),
    certificatePath: z.string().optional().describe('Path to certificate file'),
    predicateType: z.string().optional().describe('In-toto predicate type for attestations'),
    predicatePath: z.string().optional().describe('Path to predicate file for attestations'),
    outputFormat: signatureFormatSchema.optional().describe('Output format, defaults to bundle'),
    fulcioUrl: z.string().optional().describe('Fulcio server URL'),
    rekorUrl: z.string().optional().describe('Rekor transparency log URL'),
    oidcIssuer: z.string().optional().describe('OIDC issuer for identity'),
    oidcClientId: z.string().optional().describe('OIDC client ID'),
  })
  .describe('Sigstore input');

const outputSchema = z
  .object({
    success: z.boolean().describe('Whether the operation succeeded'),
    operation: operationSchema.describe('Operation performed'),
    artifactDigest: z.string().optional().describe('SHA256 digest of artifact'),
    signatureBundle: z.string().optional().describe('Base64-encoded Sigstore bundle'),
    certificate: z.string().optional().describe('Signing certificate (PEM)'),
    rekorLogId: z.string().optional().describe('Rekor transparency log entry ID'),
    rekorLogIndex: z.number().optional().describe('Rekor log index'),
    signedTimestamp: z.string().optional().describe('RFC3339 timestamp of signing'),
    issuer: z.string().optional().describe('OIDC issuer used for signing'),
    subject: z.string().optional().describe('OIDC subject (email/identity)'),
    verified: z.boolean().optional().describe('Whether verification passed'),
    verificationErrors: z.array(z.string()).optional().describe('Verification error messages'),
    message: z.string().describe('Human-readable result message'),
  })
  .describe('Sigstore output');

const configSchema = z
  .object({
    defaultFulcioUrl: z.string().optional().describe('Default Fulcio URL, defaults to public instance'),
    defaultRekorUrl: z.string().optional().describe('Default Rekor URL, defaults to public instance'),
    defaultOidcIssuer: z.string().optional().describe('Default OIDC issuer'),
  })
  .describe('Sigstore configuration');

const secretsSchema = z
  .object({
    oidcToken: z.string().optional().describe('OIDC identity token for signing'),
  })
  .describe('Sigstore secrets');

export type SigstoreInput = z.infer<typeof inputSchema>;
export type SigstoreOutput = z.infer<typeof outputSchema>;
export type SigstoreConfig = z.infer<typeof configSchema>;
export type SigstoreSecrets = z.infer<typeof secretsSchema>;

export const sigstoreCapability: Capability<
  SigstoreInput,
  SigstoreOutput,
  SigstoreConfig,
  SigstoreSecrets
> = {
  metadata: {
    id: 'golden.security.sigstore',
    domain: 'security',
    version: '1.0.0',
    name: 'sigstore',
    description:
      'Keyless signing and verification using Sigstore (Fulcio + Rekor). Sign artifacts without managing keys, with transparency log entries for auditability.',
    tags: ['guardian', 'security', 'signing', 'openssf', 'supply-chain'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['security:sign'],
    dataClassification: 'INTERNAL',
    networkAccess: {
      allowOutbound: [
        'fulcio.sigstore.dev',
        'rekor.sigstore.dev',
        'oauth2.sigstore.dev',
        'tuf-repo-cdn.sigstore.dev',
        '*.sigstore.dev',
      ],
    },
    oscalControlIds: ['SA-12', 'SI-7'], // Supply chain verification, software integrity
  },
  operations: {
    isIdempotent: false, // Signing creates new entries
    retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 2, backoffCoefficient: 2 },
    errorMap: (error: unknown) => {
      if (error instanceof Error) {
        if (error.message.includes('connection')) return 'RETRYABLE';
        if (error.message.includes('timeout')) return 'RETRYABLE';
        if (error.message.includes('rate limit')) return 'RETRYABLE';
        if (error.message.includes('unauthorized')) return 'FATAL';
        if (error.message.includes('not found')) return 'FATAL';
      }
      return 'FATAL';
    },
    costFactor: 'MEDIUM',
  },
  aiHints: {
    exampleInput: {
      operation: 'sign',
      artifactPath: 'dist/harmony-worker-v2.0.0.tar.gz',
      outputFormat: 'bundle',
    },
    exampleOutput: {
      success: true,
      operation: 'sign',
      artifactDigest: 'sha256:abc123def456...',
      rekorLogId: 'c0d23d6ad406973f9559f3ba2d1ca01f84147d8ffc5b8445c224f98b9591801d',
      rekorLogIndex: 12345678,
      signedTimestamp: '2024-01-15T10:30:00Z',
      issuer: 'https://oauth2.sigstore.dev/auth',
      subject: 'build@harmony-platform.iam.gserviceaccount.com',
      message: 'Artifact signed successfully, entry logged to Rekor',
    },
    usageNotes:
      'Use for keyless signing in CI/CD pipelines. Requires OIDC identity token from GitHub Actions, GitLab CI, or similar. Signatures are logged to Rekor for transparency.',
  },
  factory: (
    dag,
    context: CapabilityContext<SigstoreConfig, SigstoreSecrets>,
    input: SigstoreInput
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

    const fulcioUrl = input.fulcioUrl ?? context.config.defaultFulcioUrl ?? 'https://fulcio.sigstore.dev';
    const rekorUrl = input.rekorUrl ?? context.config.defaultRekorUrl ?? 'https://rekor.sigstore.dev';
    const outputFormat = input.outputFormat ?? 'bundle';

    const payload = {
      operation: input.operation,
      artifactPath: input.artifactPath,
      artifactDigest: input.artifactDigest,
      signatureBundle: input.signatureBundle,
      signaturePath: input.signaturePath,
      certificatePath: input.certificatePath,
      predicateType: input.predicateType,
      predicatePath: input.predicatePath,
      outputFormat,
      fulcioUrl,
      rekorUrl,
      oidcIssuer: input.oidcIssuer,
      oidcClientId: input.oidcClientId,
    };

    let container = d
      .container()
      .from('cgr.dev/chainguard/cosign:latest')
      .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
      .withEnvVariable('OPERATION', input.operation)
      .withEnvVariable('COSIGN_EXPERIMENTAL', '1');

    // Mount OIDC token if provided (ISS-compliant)
    if (context.secretRefs.oidcToken) {
      container = container.withMountedSecret(
        '/run/secrets/oidc_token',
        context.secretRefs.oidcToken as unknown as DaggerSecret
      );
    }

    return container.withExec([
      'sh',
      '-c',
      `
#!/bin/sh
set -e

OPERATION="${input.operation}"
ARTIFACT_PATH="${input.artifactPath ?? ''}"
ARTIFACT_DIGEST="${input.artifactDigest ?? ''}"
SIGNATURE_BUNDLE="${input.signatureBundle ?? ''}"
FULCIO_URL="${fulcioUrl}"
REKOR_URL="${rekorUrl}"
OUTPUT_FORMAT="${outputFormat}"

# Read OIDC token if provided
OIDC_TOKEN=""
if [ -f /run/secrets/oidc_token ]; then
  OIDC_TOKEN=$(cat /run/secrets/oidc_token)
  export COSIGN_IDENTITY_TOKEN="$OIDC_TOKEN"
fi

SUCCESS=true
MESSAGE=""
ARTIFACT_DIGEST_OUT=""
SIGNATURE_BUNDLE_OUT=""
CERTIFICATE_OUT=""
REKOR_LOG_ID=""
REKOR_LOG_INDEX=""
SIGNED_TIMESTAMP=""
ISSUER=""
SUBJECT=""
VERIFIED=""
VERIFICATION_ERRORS="[]"

case "$OPERATION" in
  sign)
    if [ -z "$ARTIFACT_PATH" ]; then
      SUCCESS=false
      MESSAGE="Artifact path required for signing"
    else
      # Compute digest
      ARTIFACT_DIGEST_OUT=$(sha256sum "$ARTIFACT_PATH" 2>/dev/null | cut -d' ' -f1 || echo "")
      
      # Sign with cosign
      RESULT_FILE="/tmp/result.json"
      set +e
      cosign sign-blob "$ARTIFACT_PATH" \
        --fulcio-url="$FULCIO_URL" \
        --rekor-url="$REKOR_URL" \
        --output-signature=/tmp/signature.sig \
        --output-certificate=/tmp/certificate.pem \
        --bundle=/tmp/bundle.sigstore \
        -y 2>&1 | tee /tmp/cosign.log
      SIGN_RC=$?
      set -e
      
      if [ $SIGN_RC -eq 0 ]; then
        SIGNATURE_BUNDLE_OUT=$(base64 -w0 /tmp/bundle.sigstore 2>/dev/null || base64 /tmp/bundle.sigstore)
        CERTIFICATE_OUT=$(cat /tmp/certificate.pem 2>/dev/null || echo "")
        
        # Extract Rekor entry from log
        REKOR_LOG_ID=$(grep -o 'tlog entry created with index: [0-9]*' /tmp/cosign.log | cut -d: -f2 | tr -d ' ' || echo "")
        REKOR_LOG_INDEX=$(echo "$REKOR_LOG_ID" | head -1)
        
        SIGNED_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        MESSAGE="Artifact signed successfully, entry logged to Rekor"
      else
        SUCCESS=false
        MESSAGE="Signing failed: $(cat /tmp/cosign.log)"
      fi
    fi
    ;;
    
  verify)
    if [ -z "$ARTIFACT_PATH" ]; then
      SUCCESS=false
      MESSAGE="Artifact path required for verification"
    else
      set +e
      if [ -n "$SIGNATURE_BUNDLE" ]; then
        echo "$SIGNATURE_BUNDLE" | base64 -d > /tmp/bundle.sigstore
        cosign verify-blob "$ARTIFACT_PATH" \
          --bundle=/tmp/bundle.sigstore \
          --rekor-url="$REKOR_URL" 2>&1 | tee /tmp/verify.log
        VERIFY_RC=$?
      else
        cosign verify-blob "$ARTIFACT_PATH" \
          --signature="${input.signaturePath ?? ''}" \
          --certificate="${input.certificatePath ?? ''}" \
          --rekor-url="$REKOR_URL" 2>&1 | tee /tmp/verify.log
        VERIFY_RC=$?
      fi
      set -e
      
      if [ $VERIFY_RC -eq 0 ]; then
        VERIFIED=true
        MESSAGE="Signature verification passed"
      else
        VERIFIED=false
        VERIFICATION_ERRORS=$(cat /tmp/verify.log | jq -Rs 'split("\n") | map(select(length > 0))')
        MESSAGE="Signature verification failed"
      fi
    fi
    ;;
    
  attest)
    if [ -z "$ARTIFACT_PATH" ] || [ -z "${input.predicatePath ?? ''}" ]; then
      SUCCESS=false
      MESSAGE="Artifact path and predicate path required for attestation"
    else
      PREDICATE_TYPE="${input.predicateType ?? 'custom'}"
      set +e
      cosign attest "$ARTIFACT_PATH" \
        --predicate="${input.predicatePath}" \
        --type="$PREDICATE_TYPE" \
        --fulcio-url="$FULCIO_URL" \
        --rekor-url="$REKOR_URL" \
        -y 2>&1 | tee /tmp/attest.log
      ATTEST_RC=$?
      set -e
      
      if [ $ATTEST_RC -eq 0 ]; then
        SIGNED_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        MESSAGE="Attestation created and signed successfully"
      else
        SUCCESS=false
        MESSAGE="Attestation failed: $(cat /tmp/attest.log)"
      fi
    fi
    ;;
    
  verify-attest)
    if [ -z "$ARTIFACT_PATH" ]; then
      SUCCESS=false
      MESSAGE="Artifact path required for attestation verification"
    else
      PREDICATE_TYPE="${input.predicateType ?? 'custom'}"
      set +e
      cosign verify-attestation "$ARTIFACT_PATH" \
        --type="$PREDICATE_TYPE" \
        --rekor-url="$REKOR_URL" 2>&1 | tee /tmp/verify-attest.log
      VERIFY_RC=$?
      set -e
      
      if [ $VERIFY_RC -eq 0 ]; then
        VERIFIED=true
        MESSAGE="Attestation verification passed"
      else
        VERIFIED=false
        VERIFICATION_ERRORS=$(cat /tmp/verify-attest.log | jq -Rs 'split("\n") | map(select(length > 0))')
        MESSAGE="Attestation verification failed"
      fi
    fi
    ;;
    
  *)
    SUCCESS=false
    MESSAGE="Unknown operation: $OPERATION"
    ;;
esac

# Output result
cat <<EOF
{
  "success": $SUCCESS,
  "operation": "$OPERATION",
  "artifactDigest": "$ARTIFACT_DIGEST_OUT",
  "signatureBundle": "$SIGNATURE_BUNDLE_OUT",
  "certificate": $(echo "$CERTIFICATE_OUT" | jq -Rs .),
  "rekorLogId": "$REKOR_LOG_ID",
  "rekorLogIndex": \${REKOR_LOG_INDEX:-null},
  "signedTimestamp": "$SIGNED_TIMESTAMP",
  "issuer": "$ISSUER",
  "subject": "$SUBJECT",
  "verified": \${VERIFIED:-null},
  "verificationErrors": $VERIFICATION_ERRORS,
  "message": "$MESSAGE"
}
EOF
        `.trim(),
    ]);
  },
};
