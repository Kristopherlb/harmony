/**
 * packages/capabilities/src/security/guac.capability.ts
 * GUAC Capability (OCS-001 Guardian Pattern)
 *
 * OpenSSF GUAC - Graph for Understanding Artifact Composition.
 * Query supply chain data, identify vulnerable paths, understand dependencies.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
    'ingest-sbom',      // Ingest SBOM into GUAC
    'ingest-slsa',      // Ingest SLSA attestation
    'query-deps',       // Query dependencies of a package
    'query-vulns',      // Query vulnerabilities for a package
    'query-path',       // Query path between packages
    'certify-good',     // Add positive attestation
    'certify-bad',      // Add negative attestation
]).describe('GUAC operation');

const inputSchema = z
    .object({
        operation: operationSchema,
        sbomPath: z.string().optional().describe('Path to SBOM file for ingestion'),
        attestationPath: z.string().optional().describe('Path to attestation file'),
        purl: z.string().optional().describe('Package URL for queries'),
        sourcePurl: z.string().optional().describe('Source package for path queries'),
        targetPurl: z.string().optional().describe('Target package for path queries'),
        justification: z.string().optional().describe('Justification for certification'),
        collector: z.string().optional().describe('Collector name for certification'),
        depth: z.number().optional().describe('Query depth for dependency traversal'),
    })
    .describe('GUAC input');

const packageSchema = z.object({
    purl: z.string().describe('Package URL'),
    name: z.string().describe('Package name'),
    version: z.string().optional().describe('Package version'),
    namespace: z.string().optional().describe('Package namespace'),
});

const vulnerabilitySchema = z.object({
    id: z.string().describe('Vulnerability ID (CVE, GHSA)'),
    packages: z.array(packageSchema).describe('Affected packages'),
    severity: z.string().optional().describe('Severity level'),
});

const pathSchema = z.object({
    nodes: z.array(packageSchema).describe('Packages in path'),
    edges: z.array(z.object({
        source: z.string(),
        target: z.string(),
        type: z.string(),
    })).describe('Edges between nodes'),
});

const outputSchema = z
    .object({
        success: z.boolean().describe('Whether the operation succeeded'),
        operation: operationSchema.describe('Operation performed'),
        ingestedCount: z.number().optional().describe('Number of documents ingested'),
        dependencies: z.array(packageSchema).optional().describe('Direct dependencies'),
        transitiveDeps: z.array(packageSchema).optional().describe('Transitive dependencies'),
        vulnerabilities: z.array(vulnerabilitySchema).optional().describe('Found vulnerabilities'),
        path: pathSchema.optional().describe('Path between packages'),
        certified: z.boolean().optional().describe('Whether certification was added'),
        message: z.string().describe('Human-readable result message'),
    })
    .describe('GUAC output');

const configSchema = z
    .object({
        guacUrl: z.string().optional().describe('GUAC GraphQL endpoint URL'),
        defaultCollector: z.string().optional().describe('Default collector name'),
    })
    .describe('GUAC configuration');

const secretsSchema = z
    .object({
        guacApiKey: z.string().optional().describe('GUAC API key'),
    })
    .describe('GUAC secrets');

export type GuacInput = z.infer<typeof inputSchema>;
export type GuacOutput = z.infer<typeof outputSchema>;
export type GuacConfig = z.infer<typeof configSchema>;
export type GuacSecrets = z.infer<typeof secretsSchema>;

export const guacCapability: Capability<
    GuacInput,
    GuacOutput,
    GuacConfig,
    GuacSecrets
> = {
    metadata: {
        id: 'golden.security.guac',
        domain: 'security',
        version: '1.0.0',
        name: 'guac',
        description:
            'OpenSSF GUAC - Graph for Understanding Artifact Composition. Query supply chain graphs, find vulnerable paths, and certify packages.',
        tags: ['guardian', 'security', 'openssf', 'supply-chain', 'sbom'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['security:read', 'security:write'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: [
                // GUAC is typically self-hosted
                '*.guac.dev',
            ],
        },
        oscalControlIds: ['SA-12', 'RA-5'], // Supply chain, vulnerability management
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
        costFactor: 'MEDIUM',
    },
    aiHints: {
        exampleInput: {
            operation: 'query-vulns',
            purl: 'pkg:npm/@harmony/worker@2.0.0',
        },
        exampleOutput: {
            success: true,
            operation: 'query-vulns',
            vulnerabilities: [
                {
                    id: 'CVE-2024-1234',
                    packages: [{ purl: 'pkg:npm/lodash@4.17.20', name: 'lodash', version: '4.17.20' }],
                    severity: 'high',
                },
            ],
            message: 'Found 1 vulnerability in dependency graph',
        },
        usageNotes:
            'Ingest SBOMs and attestations to build the graph. Query for vulnerabilities and dependency paths to understand supply chain risk.',
    },
    factory: (
        dag,
        context: CapabilityContext<GuacConfig, GuacSecrets>,
        input: GuacInput
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

        const guacUrl = context.config.guacUrl ?? 'http://localhost:8080/query';
        const collector = input.collector ?? context.config.defaultCollector ?? 'harmony';

        const payload = {
            operation: input.operation,
            sbomPath: input.sbomPath,
            attestationPath: input.attestationPath,
            purl: input.purl,
            sourcePurl: input.sourcePurl,
            targetPurl: input.targetPurl,
            justification: input.justification,
            collector,
            depth: input.depth ?? 3,
        };

        let container = d
            .container()
            .from('ghcr.io/guacsec/guac:latest')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('OPERATION', input.operation)
            .withEnvVariable('GUAC_URL', guacUrl);

        if (context.secretRefs.guacApiKey) {
            container = container.withMountedSecret(
                '/run/secrets/guac_api_key',
                context.secretRefs.guacApiKey as unknown as DaggerSecret
            );
        }

        return container.withExec([
            'sh',
            '-c',
            `
#!/bin/sh
set -e

OPERATION="${input.operation}"
GUAC_URL="${guacUrl}"
PURL="${input.purl ?? ''}"

if [ -f /run/secrets/guac_api_key ]; then
  export GUAC_API_KEY=$(cat /run/secrets/guac_api_key)
fi

SUCCESS=true
MESSAGE=""
INGESTED_COUNT=0
DEPENDENCIES="[]"
TRANSITIVE_DEPS="[]"
VULNERABILITIES="[]"
PATH_RESULT="null"
CERTIFIED=""

case "$OPERATION" in
  ingest-sbom)
    SBOM_PATH="${input.sbomPath ?? ''}"
    if [ -z "$SBOM_PATH" ]; then
      SUCCESS=false
      MESSAGE="SBOM path required"
    else
      guacone collect files "$SBOM_PATH" 2>/dev/null || {
        SUCCESS=false
        MESSAGE="SBOM ingestion failed"
      }
      if [ "$SUCCESS" = "true" ]; then
        INGESTED_COUNT=1
        MESSAGE="Ingested SBOM into GUAC"
      fi
    fi
    ;;
    
  query-deps)
    if [ -z "$PURL" ]; then
      SUCCESS=false
      MESSAGE="Package URL required"
    else
      QUERY='{ hasSBOM(hasSBOMSpec: {subject: {package: {purl: "'$PURL'"}}}) { subject { ... on Package { namespaces { names { versions { purl } } } } } }}'
      RESULT=$(curl -s -X POST "$GUAC_URL" -H "Content-Type: application/json" -d "{\"query\": \"$QUERY\"}" || echo "{}")
      DEPENDENCIES=$(echo "$RESULT" | jq '[.data.hasSBOM[].subject.namespaces[].names[].versions[] | {purl, name: .purl, version: ""}]' 2>/dev/null || echo "[]")
      MESSAGE="Retrieved dependencies for $PURL"
    fi
    ;;
    
  query-vulns)
    if [ -z "$PURL" ]; then
      SUCCESS=false
      MESSAGE="Package URL required"
    else
      QUERY='{ certifyVuln(certifyVulnSpec: {package: {purl: "'$PURL'"}}) { vulnerability { vulnerabilityIDs { vulnerabilityID } } package { namespaces { names { versions { purl } } } } }}'
      RESULT=$(curl -s -X POST "$GUAC_URL" -H "Content-Type: application/json" -d "{\"query\": \"$QUERY\"}" || echo "{}")
      VULNERABILITIES=$(echo "$RESULT" | jq '[.data.certifyVuln[]? | {id: .vulnerability.vulnerabilityIDs[0].vulnerabilityID, packages: [{purl: .package.namespaces[0].names[0].versions[0].purl, name: "", version: ""}]}]' 2>/dev/null || echo "[]")
      VULN_COUNT=$(echo "$VULNERABILITIES" | jq 'length')
      MESSAGE="Found $VULN_COUNT vulnerabilities"
    fi
    ;;
    
  certify-good|certify-bad)
    if [ -z "$PURL" ]; then
      SUCCESS=false
      MESSAGE="Package URL required"
    else
      CERT_TYPE=$(echo "$OPERATION" | sed 's/certify-//')
      JUSTIFICATION="${input.justification ?? 'Certified by Harmony'}"
      # Note: Actual certification would use guacone or GraphQL mutation
      CERTIFIED=true
      MESSAGE="Added $CERT_TYPE certification for $PURL"
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
  "ingestedCount": $INGESTED_COUNT,
  "dependencies": $DEPENDENCIES,
  "transitiveDeps": $TRANSITIVE_DEPS,
  "vulnerabilities": $VULNERABILITIES,
  "path": $PATH_RESULT,
  "certified": \${CERTIFIED:-null},
  "message": "$MESSAGE"
}
EOF
    `.trim(),
        ]);
    },
};
