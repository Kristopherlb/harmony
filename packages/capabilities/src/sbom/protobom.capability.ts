/**
 * packages/capabilities/src/sbom/protobom.capability.ts
 * Protobom Capability (OCS-001 Transformer Pattern)
 *
 * Format-neutral SBOM representation using OpenSSF Protobom.
 * Convert between SPDX and CycloneDX formats.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
  'convert',      // Convert between SBOM formats
  'validate',     // Validate SBOM structure
  'ingest',       // Ingest SBOM into protobom format
  'export',       // Export from protobom to target format
]).describe('Protobom operation');

const formatSchema = z.enum([
  'spdx-2.3-json',
  'spdx-2.3-tv',
  'spdx-2.2-json',
  'cyclonedx-1.5-json',
  'cyclonedx-1.4-json',
  'protobom',
]).describe('SBOM format');

const inputSchema = z
  .object({
    operation: operationSchema,
    sbomPath: z.string().optional().describe('Path to input SBOM'),
    sbomContent: z.string().optional().describe('SBOM content string'),
    inputFormat: formatSchema.optional().describe('Input format (auto-detected if not specified)'),
    outputFormat: formatSchema.optional().describe('Output format'),
    outputPath: z.string().optional().describe('Output file path'),
  })
  .describe('Protobom input');

const outputSchema = z
  .object({
    success: z.boolean().describe('Whether the operation succeeded'),
    operation: operationSchema.describe('Operation performed'),
    outputPath: z.string().optional().describe('Output file path'),
    sbomContent: z.string().optional().describe('Converted SBOM content'),
    inputFormat: formatSchema.optional().describe('Detected input format'),
    outputFormat: formatSchema.optional().describe('Output format'),
    valid: z.boolean().optional().describe('Whether SBOM is valid'),
    validationErrors: z.array(z.string()).optional().describe('Validation errors'),
    componentCount: z.number().optional().describe('Number of components'),
    message: z.string().describe('Human-readable result message'),
  })
  .describe('Protobom output');

const configSchema = z
  .object({
    defaultOutputFormat: formatSchema.optional().describe('Default output format'),
  })
  .describe('Protobom configuration');

const secretsSchema = z.object({}).describe('Protobom secrets (none required)');

export type ProtobomInput = z.infer<typeof inputSchema>;
export type ProtobomOutput = z.infer<typeof outputSchema>;
export type ProtobomConfig = z.infer<typeof configSchema>;
export type ProtobomSecrets = z.infer<typeof secretsSchema>;

export const protobomCapability: Capability<
  ProtobomInput,
  ProtobomOutput,
  ProtobomConfig,
  ProtobomSecrets
> = {
  metadata: {
    id: 'golden.sbom.protobom',
    version: '1.0.0',
    name: 'protobom',
    description:
      'Convert between SBOM formats using OpenSSF Protobom. Supports SPDX 2.2/2.3 and CycloneDX 1.4/1.5.',
    tags: ['transformer', 'sbom', 'openssf', 'spdx', 'cyclonedx'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['sbom:transform'],
    dataClassification: 'INTERNAL',
    networkAccess: {
      allowOutbound: [], // Pure transformation, no network needed
    },
  },
  operations: {
    isIdempotent: true,
    retryPolicy: { maxAttempts: 2, initialIntervalSeconds: 1, backoffCoefficient: 2 },
    errorMap: (error: unknown) => {
      if (error instanceof Error) {
        if (error.message.includes('invalid format')) return 'FATAL';
      }
      return 'FATAL';
    },
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {
      operation: 'convert',
      sbomPath: 'sbom-spdx.json',
      inputFormat: 'spdx-2.3-json',
      outputFormat: 'cyclonedx-1.5-json',
      outputPath: 'sbom-cdx.json',
    },
    exampleOutput: {
      success: true,
      operation: 'convert',
      inputFormat: 'spdx-2.3-json',
      outputFormat: 'cyclonedx-1.5-json',
      outputPath: 'sbom-cdx.json',
      componentCount: 156,
      message: 'Converted SBOM from SPDX 2.3 to CycloneDX 1.5 (156 components)',
    },
    usageNotes:
      'Use to convert between SPDX and CycloneDX for tool compatibility. Some metadata may not have direct mappings between formats.',
  },
  factory: (
    dag,
    context: CapabilityContext<ProtobomConfig, ProtobomSecrets>,
    input: ProtobomInput
  ) => {
    type ContainerBuilder = {
      from(image: string): ContainerBuilder;
      withEnvVariable(key: string, value: string): ContainerBuilder;
      withExec(args: string[]): unknown;
    };
    type DaggerClient = {
      container(): ContainerBuilder;
    };
    const d = dag as unknown as DaggerClient;

    const outputFormat = input.outputFormat ?? context.config.defaultOutputFormat ?? 'cyclonedx-1.5-json';

    const payload = {
      operation: input.operation,
      sbomPath: input.sbomPath,
      sbomContent: input.sbomContent,
      inputFormat: input.inputFormat,
      outputFormat,
      outputPath: input.outputPath ?? 'output.json',
    };

    const container = d
      .container()
      .from('ghcr.io/protobom/protobom:latest')
      .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
      .withEnvVariable('OPERATION', input.operation);

    return container.withExec([
      'sh',
      '-c',
      `
#!/bin/sh
set -e

OPERATION="${input.operation}"
INPUT_PATH="${input.sbomPath ?? ''}"
INPUT_FORMAT="${input.inputFormat ?? ''}"
OUTPUT_FORMAT="${outputFormat}"
OUTPUT_PATH="${payload.outputPath}"

SUCCESS=true
MESSAGE=""
VALID=""
VALIDATION_ERRORS="[]"
COMPONENT_COUNT=0
SBOM_CONTENT=""
DETECTED_FORMAT=""

# Write inline content if provided
${input.sbomContent ? `echo '${input.sbomContent.replace(/'/g, "'\\''")}' > /tmp/input.sbom
INPUT_PATH="/tmp/input.sbom"` : ''}

case "$OPERATION" in
  convert)
    if [ -z "$INPUT_PATH" ]; then
      SUCCESS=false
      MESSAGE="Input SBOM path required"
    else
      # Map formats to protobom format names
      map_format() {
        case "$1" in
          spdx-2.3-json) echo "spdx23" ;;
          spdx-2.2-json) echo "spdx22" ;;
          spdx-2.3-tv) echo "spdx23tv" ;;
          cyclonedx-1.5-json) echo "cdx15" ;;
          cyclonedx-1.4-json) echo "cdx14" ;;
          *) echo "$1" ;;
        esac
      }
      
      OUT_FMT=$(map_format "$OUTPUT_FORMAT")
      
      set +e
      protobom convert "$INPUT_PATH" --format "$OUT_FMT" > "$OUTPUT_PATH" 2>/dev/null
      CONVERT_RC=$?
      set -e
      
      if [ $CONVERT_RC -eq 0 ]; then
        COMPONENT_COUNT=$(jq '.packages | length' "$OUTPUT_PATH" 2>/dev/null || jq '.components | length' "$OUTPUT_PATH" 2>/dev/null || echo 0)
        DETECTED_FORMAT="$INPUT_FORMAT"
        MESSAGE="Converted SBOM to $OUTPUT_FORMAT ($COMPONENT_COUNT components)"
      else
        SUCCESS=false
        MESSAGE="Conversion failed"
      fi
    fi
    ;;
    
  validate)
    if [ -z "$INPUT_PATH" ]; then
      SUCCESS=false
      MESSAGE="Input SBOM path required"
    else
      set +e
      ERRORS=$(protobom validate "$INPUT_PATH" 2>&1)
      VALIDATE_RC=$?
      set -e
      
      if [ $VALIDATE_RC -eq 0 ]; then
        VALID=true
        MESSAGE="SBOM is valid"
      else
        VALID=false
        VALIDATION_ERRORS=$(echo "$ERRORS" | jq -Rs 'split("\n") | map(select(length > 0))')
        MESSAGE="SBOM validation failed"
      fi
    fi
    ;;
    
  ingest)
    if [ -z "$INPUT_PATH" ]; then
      SUCCESS=false
      MESSAGE="Input SBOM path required"
    else
      set +e
      protobom ingest "$INPUT_PATH" > "$OUTPUT_PATH" 2>/dev/null
      INGEST_RC=$?
      set -e
      
      if [ $INGEST_RC -eq 0 ]; then
        MESSAGE="Ingested SBOM to protobom format"
      else
        SUCCESS=false
        MESSAGE="Ingest failed"
      fi
    fi
    ;;
    
  export)
    if [ -z "$INPUT_PATH" ]; then
      SUCCESS=false
      MESSAGE="Input protobom path required"
    else
      OUT_FMT=$(map_format "$OUTPUT_FORMAT")
      
      set +e
      protobom export "$INPUT_PATH" --format "$OUT_FMT" > "$OUTPUT_PATH" 2>/dev/null
      EXPORT_RC=$?
      set -e
      
      if [ $EXPORT_RC -eq 0 ]; then
        MESSAGE="Exported to $OUTPUT_FORMAT"
      else
        SUCCESS=false
        MESSAGE="Export failed"
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
  "outputPath": "$OUTPUT_PATH",
  "inputFormat": "$DETECTED_FORMAT",
  "outputFormat": "$OUTPUT_FORMAT",
  "valid": \${VALID:-null},
  "validationErrors": $VALIDATION_ERRORS,
  "componentCount": $COMPONENT_COUNT,
  "message": "$MESSAGE"
}
EOF
        `.trim(),
    ]);
  },
};
