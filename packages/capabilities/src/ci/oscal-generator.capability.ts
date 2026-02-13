/**
 * packages/capabilities/src/ci/oscal-generator.capability.ts
 * OSCAL Generator Capability (OCS-001 Transformer Pattern)
 *
 * Generate NIST OSCAL Component Definition from OCS/WCS metadata.
 * Extracts oscalControlIds and produces compliance bill of materials.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
    'generate',              // Generate full OSCAL component definition
    'extract-controls',      // Extract oscalControlIds from metadata
    'validate',              // Validate OSCAL output against schema
]).describe('OSCAL generator operation');

const implementedRequirementSchema = z.object({
    uuid: z.string().describe('Unique identifier'),
    controlId: z.string().describe('NIST control ID (e.g., AC-2, AU-2)'),
    description: z.string().describe('Implementation description'),
    implementedBy: z.array(z.string()).describe('Capabilities/blueprints implementing this control'),
});

const inputSchema = z
    .object({
        operation: operationSchema,
        sourcePaths: z.array(z.string()).optional().describe('Paths to scan for OCS/WCS metadata'),
        catalogSource: z.string().optional().describe('OSCAL catalog source URL or path'),
        title: z.string().optional().describe('Component definition title'),
        version: z.string().optional().describe('Component version'),
    })
    .describe('OSCAL Generator input');

const outputSchema = z
    .object({
        outputPath: z.string().describe('Path to generated OSCAL file'),
        format: z.enum(['json', 'yaml']).describe('Output format'),
        controlsCovered: z.array(z.string()).describe('List of NIST control IDs covered'),
        controlCount: z.number().describe('Total controls covered'),
        components: z.array(z.object({
            uuid: z.string(),
            type: z.string(),
            title: z.string(),
            controlCount: z.number(),
        })).describe('Generated component summaries'),
        implementedRequirements: z.array(implementedRequirementSchema).optional().describe('Detailed requirements'),
    })
    .describe('OSCAL Generator output');

const configSchema = z
    .object({
        outputFormat: z.enum(['json', 'yaml']).optional().describe('Output format'),
        outputDir: z.string().optional().describe('Output directory'),
        catalogVersion: z.string().optional().describe('NIST catalog version'),
    })
    .describe('OSCAL Generator configuration');

const secretsSchema = z
    .object({})
    .describe('OSCAL Generator secrets - none required');

export type OscalGeneratorInput = z.infer<typeof inputSchema>;
export type OscalGeneratorOutput = z.infer<typeof outputSchema>;
export type OscalGeneratorConfig = z.infer<typeof configSchema>;
export type OscalGeneratorSecrets = z.infer<typeof secretsSchema>;

export const oscalGeneratorCapability: Capability<
    OscalGeneratorInput,
    OscalGeneratorOutput,
    OscalGeneratorConfig,
    OscalGeneratorSecrets
> = {
    metadata: {
        id: 'golden.ci.oscal-generator',
        domain: 'ci',
        version: '1.0.0',
        name: 'oscalGenerator',
        description:
            'Generate NIST OSCAL Component Definition from OCS/WCS metadata. Extracts oscalControlIds from capability and blueprint security metadata to produce compliance documentation.',
        tags: ['transformer', 'ci', 'compliance', 'oscal', 'nist'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['ci:read'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: [], // Runs locally
        },
        oscalControlIds: ['CA-2', 'SA-11'], // Security assessments, dev testing
    },
    operations: {
        isIdempotent: true,
        retryPolicy: { maxAttempts: 2, initialIntervalSeconds: 1, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('not found')) return 'FATAL';
            }
            return 'FATAL';
        },
        costFactor: 'LOW',
    },
    aiHints: {
        exampleInput: {
            operation: 'generate',
            title: 'Harmony Platform',
            version: '2.0.0',
        },
        exampleOutput: {
            outputPath: 'dist/oscal/component-definition.json',
            format: 'json',
            controlsCovered: ['AC-2', 'AU-2', 'CA-2', 'CM-2', 'CM-3', 'SA-11', 'SI-4'],
            controlCount: 7,
            components: [
                {
                    uuid: '550e8400-e29b-41d4-a716-446655440000',
                    type: 'software',
                    title: 'Harmony Platform',
                    controlCount: 7,
                },
            ],
        },
        usageNotes:
            'Run after certification to generate OSCAL Component Definition. Include in release artifacts for compliance audits. Controls are extracted from security.oscalControlIds in capability metadata.',
    },
    factory: (
        dag,
        context: CapabilityContext<OscalGeneratorConfig, OscalGeneratorSecrets>,
        input: OscalGeneratorInput
    ) => {
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = { container(): ContainerBuilder };
        const d = dag as unknown as DaggerClient;

        const outputFormat = context.config.outputFormat ?? 'json';
        const outputDir = context.config.outputDir ?? 'dist/oscal';

        const payload = {
            operation: input.operation,
            sourcePaths: input.sourcePaths ?? ['packages/capabilities', 'packages/blueprints'],
            catalogSource: input.catalogSource,
            title: input.title ?? 'Harmony Platform',
            version: input.version ?? '1.0.0',
            outputFormat,
            outputDir,
        };

        return d
            .container()
            .from('node:20-alpine')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('OPERATION', input.operation)
            .withExec([
                'sh',
                '-c',
                `
#!/bin/sh
set -e

apk add --no-cache jq 2>/dev/null

INPUT_JSON='${JSON.stringify(payload)}'
OPERATION="${input.operation}"
OUTPUT_DIR="${outputDir}"
OUTPUT_FORMAT="${outputFormat}"
TITLE="${input.title ?? 'Harmony Platform'}"
VERSION="${input.version ?? '1.0.0'}"

mkdir -p "$OUTPUT_DIR"

# Generate UUID (simplified)
gen_uuid() {
  cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "$(date +%s)-$(od -A n -t x -N 4 /dev/urandom | tr -d ' ')"
}

# Extract oscalControlIds from capability files
extract_controls() {
  CONTROLS="[]"
  REQUIREMENTS="[]"
  
  # Scan for oscalControlIds in capability files
  for f in $(find packages/capabilities -name "*.capability.ts" -type f 2>/dev/null); do
    FILENAME=$(basename "$f" .capability.ts)
    
    # Extract control IDs using grep/sed
    FILE_CONTROLS=$(grep -o "oscalControlIds.*\\[.*\\]" "$f" 2>/dev/null | sed "s/.*\\[//" | sed "s/\\].*//" | tr -d "'" | tr -d '"' | tr ',' '\\n' | tr -d ' ' || echo "")
    
    for ctrl in $FILE_CONTROLS; do
      if [ -n "$ctrl" ]; then
        # Add to controls list if not already present
        CONTROLS=$(echo "$CONTROLS" | jq --arg ctrl "$ctrl" 'if . | index($ctrl) then . else . + [$ctrl] end')
        
        # Add requirement
        REQ_UUID=$(gen_uuid)
        REQUIREMENTS=$(echo "$REQUIREMENTS" | jq --arg uuid "$REQ_UUID" --arg ctrl "$ctrl" --arg cap "$FILENAME" '. + [{uuid: $uuid, controlId: $ctrl, description: ("Implemented by capability: " + $cap), implementedBy: [$cap]}]')
      fi
    done
  done
  
  echo "$CONTROLS" > /tmp/controls.json
  echo "$REQUIREMENTS" > /tmp/requirements.json
}

generate_oscal() {
  extract_controls
  
  CONTROLS=$(cat /tmp/controls.json)
  REQUIREMENTS=$(cat /tmp/requirements.json)
  CONTROL_COUNT=$(echo "$CONTROLS" | jq 'length')
  
  COMP_UUID=$(gen_uuid)
  DEF_UUID=$(gen_uuid)
  IMPL_UUID=$(gen_uuid)
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  
  # Build OSCAL Component Definition
  cat <<EOF > "$OUTPUT_DIR/component-definition.json"
{
  "component-definition": {
    "uuid": "$DEF_UUID",
    "metadata": {
      "title": "$TITLE Component Definition",
      "version": "$VERSION",
      "oscal-version": "1.0.4",
      "last-modified": "$TIMESTAMP"
    },
    "components": [
      {
        "uuid": "$COMP_UUID",
        "type": "software",
        "title": "$TITLE",
        "description": "Harmony Platform automation capabilities",
        "control-implementations": [
          {
            "uuid": "$IMPL_UUID",
            "source": "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json",
            "description": "NIST SP 800-53 Rev 5 controls implemented by $TITLE",
            "implemented-requirements": $(echo "$REQUIREMENTS" | jq '[.[] | {"uuid": .uuid, "control-id": .controlId, "description": .description}]')
          }
        ]
      }
    ]
  }
}
EOF

  echo "$CONTROLS" | jq -c '.'
}

case "$OPERATION" in
  generate)
    CONTROLS_COVERED=$(generate_oscal)
    ;;
  extract-controls)
    extract_controls
    CONTROLS_COVERED=$(cat /tmp/controls.json)
    ;;
  validate)
    # Basic validation - check JSON is valid
    if [ -f "$OUTPUT_DIR/component-definition.json" ]; then
      jq '.' "$OUTPUT_DIR/component-definition.json" > /dev/null
      CONTROLS_COVERED=$(jq '[.["component-definition"].components[].["control-implementations"][].["implemented-requirements"][]."control-id"] | unique' "$OUTPUT_DIR/component-definition.json")
    else
      CONTROLS_COVERED="[]"
    fi
    ;;
esac

CONTROL_COUNT=$(echo "$CONTROLS_COVERED" | jq 'length')
REQUIREMENTS=$(cat /tmp/requirements.json 2>/dev/null || echo "[]")

# Output result
cat <<EOF
{
  "outputPath": "$OUTPUT_DIR/component-definition.json",
  "format": "$OUTPUT_FORMAT",
  "controlsCovered": $CONTROLS_COVERED,
  "controlCount": $CONTROL_COUNT,
  "components": [
    {
      "uuid": "$(gen_uuid)",
      "type": "software",
      "title": "$TITLE",
      "controlCount": $CONTROL_COUNT
    }
  ],
  "implementedRequirements": $REQUIREMENTS
}
EOF
        `.trim(),
            ]);
    },
};
