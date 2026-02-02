/**
 * packages/capabilities/src/utilities/diff-generator.capability.ts
 * Diff Generator Capability (OCS-001 Transformer Pattern)
 *
 * Generate unified diffs between files or strings.
 * Patch generation and application.
 */
import { z } from '@golden/schema-registry';
import { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
  'diff',         // Generate diff between two inputs
  'apply-patch',  // Apply a patch to content
  'reverse-patch',// Reverse a patch
  'stat',         // Get diff statistics
]).describe('Diff operation');

const formatSchema = z.enum([
  'unified',      // Unified diff format
  'context',      // Context diff format
  'json',         // Structured JSON diff
  'html',         // HTML formatted diff
]).describe('Diff output format');

const inputSchema = z
  .object({
    operation: operationSchema,
    originalContent: z.string().optional().describe('Original content string'),
    modifiedContent: z.string().optional().describe('Modified content string'),
    originalPath: z.string().optional().describe('Path to original file'),
    modifiedPath: z.string().optional().describe('Path to modified file'),
    patchContent: z.string().optional().describe('Patch to apply'),
    format: formatSchema.optional().describe('Output format, defaults to unified'),
    contextLines: z.number().optional().describe('Number of context lines, defaults to 3'),
    ignoreWhitespace: z.boolean().optional().describe('Ignore whitespace changes'),
    fileName: z.string().optional().describe('File name for diff header'),
  })
  .describe('Diff Generator input');

const diffStatSchema = z.object({
  linesAdded: z.number().describe('Number of lines added'),
  linesRemoved: z.number().describe('Number of lines removed'),
  hunks: z.number().describe('Number of diff hunks'),
  files: z.number().optional().describe('Number of files changed'),
});

const outputSchema = z
  .object({
    success: z.boolean().describe('Whether the operation succeeded'),
    operation: operationSchema.describe('Operation performed'),
    diff: z.string().optional().describe('Generated diff'),
    patchedContent: z.string().optional().describe('Content after patch applied'),
    stats: diffStatSchema.optional().describe('Diff statistics'),
    hunks: z.array(z.object({
      oldStart: z.number(),
      oldLines: z.number(),
      newStart: z.number(),
      newLines: z.number(),
      content: z.string(),
    })).optional().describe('Diff hunks'),
    message: z.string().describe('Human-readable result message'),
  })
  .describe('Diff Generator output');

const configSchema = z
  .object({
    defaultFormat: formatSchema.optional().describe('Default output format'),
    defaultContextLines: z.number().optional().describe('Default context lines'),
  })
  .describe('Diff Generator configuration');

const secretsSchema = z.object({}).describe('Diff Generator secrets (none required)');

export type DiffGeneratorInput = z.infer<typeof inputSchema>;
export type DiffGeneratorOutput = z.infer<typeof outputSchema>;
export type DiffGeneratorConfig = z.infer<typeof configSchema>;
export type DiffGeneratorSecrets = z.infer<typeof secretsSchema>;

export const diffGeneratorCapability: Capability<
  DiffGeneratorInput,
  DiffGeneratorOutput,
  DiffGeneratorConfig,
  DiffGeneratorSecrets
> = {
  metadata: {
    id: 'golden.utilities.diff-generator',
    version: '1.0.0',
    name: 'diffGenerator',
    description:
      'Generate unified diffs between files or strings. Apply and reverse patches. Get diff statistics.',
    tags: ['transformer', 'utilities', 'diff', 'patch'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['utilities:transform'],
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
        if (error.message.includes('conflict')) return 'FATAL';
      }
      return 'FATAL';
    },
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {
      operation: 'diff',
      originalContent: 'Hello World\nLine 2\nLine 3',
      modifiedContent: 'Hello Universe\nLine 2\nLine 3\nLine 4',
      format: 'unified',
      fileName: 'example.txt',
    },
    exampleOutput: {
      success: true,
      operation: 'diff',
      diff: '--- a/example.txt\n+++ b/example.txt\n@@ -1,3 +1,4 @@\n-Hello World\n+Hello Universe\n Line 2\n Line 3\n+Line 4',
      stats: {
        linesAdded: 2,
        linesRemoved: 1,
        hunks: 1,
      },
      message: 'Generated diff: +2 -1 lines in 1 hunk',
    },
    usageNotes:
      'Use for code review summaries, change detection, and patch generation. JSON format is useful for programmatic analysis of changes.',
  },
  factory: (
    dag,
    context: CapabilityContext<DiffGeneratorConfig, DiffGeneratorSecrets>,
    input: DiffGeneratorInput
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

    const format = input.format ?? context.config.defaultFormat ?? 'unified';
    const contextLines = input.contextLines ?? context.config.defaultContextLines ?? 3;

    const payload = {
      operation: input.operation,
      originalContent: input.originalContent,
      modifiedContent: input.modifiedContent,
      originalPath: input.originalPath,
      modifiedPath: input.modifiedPath,
      patchContent: input.patchContent,
      format,
      contextLines,
      ignoreWhitespace: input.ignoreWhitespace ?? false,
      fileName: input.fileName ?? 'file',
    };

    const container = d
      .container()
      .from('alpine:latest')
      .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
      .withEnvVariable('OPERATION', input.operation);

    return container.withExec([
      'sh',
      '-c',
      `
#!/bin/sh
set -e

apk add --no-cache diffutils patch jq >/dev/null 2>&1

OPERATION="${input.operation}"
FORMAT="${format}"
CONTEXT="${contextLines}"
FILENAME="${input.fileName ?? 'file'}"
IGNORE_WS="${input.ignoreWhitespace ?? false}"

SUCCESS=true
MESSAGE=""
DIFF=""
PATCHED=""
LINES_ADDED=0
LINES_REMOVED=0
HUNKS=0

# Write content to temp files
echo '${(input.originalContent ?? '').replace(/'/g, "'\\''")}' > /tmp/original
echo '${(input.modifiedContent ?? '').replace(/'/g, "'\\''")}' > /tmp/modified

case "$OPERATION" in
  diff)
    WS_FLAG=""
    if [ "$IGNORE_WS" = "true" ]; then
      WS_FLAG="-w"
    fi
    
    set +e
    case "$FORMAT" in
      unified)
        DIFF=$(diff -u -U$CONTEXT $WS_FLAG --label "a/$FILENAME" --label "b/$FILENAME" /tmp/original /tmp/modified)
        ;;
      context)
        DIFF=$(diff -c -C$CONTEXT $WS_FLAG /tmp/original /tmp/modified)
        ;;
      *)
        DIFF=$(diff -u -U$CONTEXT $WS_FLAG --label "a/$FILENAME" --label "b/$FILENAME" /tmp/original /tmp/modified)
        ;;
    esac
    DIFF_RC=$?
    set -e
    
    # Count stats
    LINES_ADDED=$(echo "$DIFF" | grep -c '^+[^+]' || echo 0)
    LINES_REMOVED=$(echo "$DIFF" | grep -c '^-[^-]' || echo 0)
    HUNKS=$(echo "$DIFF" | grep -c '^@@' || echo 0)
    
    if [ $DIFF_RC -eq 0 ]; then
      MESSAGE="Files are identical"
    else
      MESSAGE="Generated diff: +$LINES_ADDED -$LINES_REMOVED lines in $HUNKS hunks"
    fi
    ;;
    
  apply-patch)
    echo '${(input.patchContent ?? '').replace(/'/g, "'\\''")}' > /tmp/patch
    echo '${(input.originalContent ?? '').replace(/'/g, "'\\''")}' > /tmp/target
    
    set +e
    patch -p0 /tmp/target < /tmp/patch 2>/dev/null
    PATCH_RC=$?
    set -e
    
    if [ $PATCH_RC -eq 0 ]; then
      PATCHED=$(cat /tmp/target)
      MESSAGE="Patch applied successfully"
    else
      SUCCESS=false
      MESSAGE="Patch application failed"
    fi
    ;;
    
  reverse-patch)
    echo '${(input.patchContent ?? '').replace(/'/g, "'\\''")}' > /tmp/patch
    echo '${(input.modifiedContent ?? '').replace(/'/g, "'\\''")}' > /tmp/target
    
    set +e
    patch -R -p0 /tmp/target < /tmp/patch 2>/dev/null
    PATCH_RC=$?
    set -e
    
    if [ $PATCH_RC -eq 0 ]; then
      PATCHED=$(cat /tmp/target)
      MESSAGE="Patch reversed successfully"
    else
      SUCCESS=false
      MESSAGE="Patch reversal failed"
    fi
    ;;
    
  stat)
    set +e
    DIFF=$(diff -u /tmp/original /tmp/modified)
    set -e
    
    LINES_ADDED=$(echo "$DIFF" | grep -c '^+[^+]' || echo 0)
    LINES_REMOVED=$(echo "$DIFF" | grep -c '^-[^-]' || echo 0)
    HUNKS=$(echo "$DIFF" | grep -c '^@@' || echo 0)
    MESSAGE="Stats: +$LINES_ADDED -$LINES_REMOVED lines in $HUNKS hunks"
    ;;
    
  *)
    SUCCESS=false
    MESSAGE="Unknown operation: $OPERATION"
    ;;
esac

# Escape for JSON
DIFF_JSON=$(echo "$DIFF" | jq -Rs . 2>/dev/null || echo '""')
PATCHED_JSON=$(echo "$PATCHED" | jq -Rs . 2>/dev/null || echo 'null')

cat <<EOF
{
  "success": $SUCCESS,
  "operation": "$OPERATION",
  "diff": $DIFF_JSON,
  "patchedContent": $PATCHED_JSON,
  "stats": {
    "linesAdded": $LINES_ADDED,
    "linesRemoved": $LINES_REMOVED,
    "hunks": $HUNKS
  },
  "message": "$MESSAGE"
}
EOF
            `.trim(),
    ]);
  },
};
