/**
 * packages/capabilities/src/utilities/diff-generator.capability.ts
<<<<<<< ours
 * Diff Generator Capability (OCS-001 Utility Pattern)
 *
 * Generates unified diffs between files or strings.
=======
 * Diff Generator Capability (OCS-001 Transformer Pattern)
 *
 * Generate unified diffs between files or strings.
 * Patch generation and application.
>>>>>>> theirs
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

<<<<<<< ours
const formatSchema = z.enum([
    'unified',
    'side-by-side',
    'json',
    'html',
=======
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
>>>>>>> theirs
]).describe('Diff output format');

const inputSchema = z
    .object({
<<<<<<< ours
        original: z.string().optional().describe('Original content string'),
        modified: z.string().optional().describe('Modified content string'),
        originalPath: z.string().optional().describe('Path to original file'),
        modifiedPath: z.string().optional().describe('Path to modified file'),
        format: formatSchema.optional().describe('Output format (default: unified)'),
        context: z.number().optional().describe('Number of context lines (default: 3)'),
        ignoreWhitespace: z.boolean().optional().describe('Ignore whitespace changes'),
        ignoreCase: z.boolean().optional().describe('Ignore case differences'),
        outputPath: z.string().optional().describe('Path to write diff output'),
    })
    .describe('Diff Generator input');

const changeSchema = z.object({
    type: z.enum(['add', 'remove', 'context']),
    lineOriginal: z.number().optional(),
    lineModified: z.number().optional(),
    content: z.string(),
});

const hunkSchema = z.object({
    originalStart: z.number(),
    originalCount: z.number(),
    modifiedStart: z.number(),
    modifiedCount: z.number(),
    changes: z.array(changeSchema),
=======
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
>>>>>>> theirs
});

const outputSchema = z
    .object({
<<<<<<< ours
        success: z.boolean().describe('Whether diff generation succeeded'),
        diff: z.string().describe('Generated diff output'),
        format: formatSchema.describe('Format used'),
        hunks: z.array(hunkSchema).optional().describe('Structured diff hunks'),
        linesAdded: z.number().describe('Number of lines added'),
        linesRemoved: z.number().describe('Number of lines removed'),
        linesChanged: z.number().describe('Total lines changed'),
        identical: z.boolean().describe('Whether files are identical'),
        outputPath: z.string().optional().describe('Path where diff was written'),
=======
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
>>>>>>> theirs
        message: z.string().describe('Human-readable result message'),
    })
    .describe('Diff Generator output');

const configSchema = z
    .object({
        defaultFormat: formatSchema.optional().describe('Default output format'),
<<<<<<< ours
        defaultContext: z.number().optional().describe('Default context lines'),
    })
    .describe('Diff Generator configuration');

const secretsSchema = z
    .object({})
    .describe('Diff Generator secrets');
=======
        defaultContextLines: z.number().optional().describe('Default context lines'),
    })
    .describe('Diff Generator configuration');

const secretsSchema = z.object({}).describe('Diff Generator secrets (none required)');
>>>>>>> theirs

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
<<<<<<< ours
            'Unified diff generation utility. Compare files or strings and generate diffs in various formats.',
        tags: ['utility', 'diff', 'comparison'],
=======
            'Generate unified diffs between files or strings. Apply and reverse patches. Get diff statistics.',
        tags: ['transformer', 'utilities', 'diff', 'patch'],
>>>>>>> theirs
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
<<<<<<< ours
        requiredScopes: ['utility:diff'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: [],
=======
        requiredScopes: ['utilities:transform'],
        dataClassification: 'INTERNAL',
        networkAccess: {
            allowOutbound: [], // Pure transformation, no network needed
>>>>>>> theirs
        },
    },
    operations: {
        isIdempotent: true,
<<<<<<< ours
        retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 0, backoffCoefficient: 1 },
        errorMap: () => 'FATAL',
=======
        retryPolicy: { maxAttempts: 2, initialIntervalSeconds: 1, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('conflict')) return 'FATAL';
            }
            return 'FATAL';
        },
>>>>>>> theirs
        costFactor: 'LOW',
    },
    aiHints: {
        exampleInput: {
<<<<<<< ours
            original: 'Hello World\nLine 2\nLine 3',
            modified: 'Hello Universe\nLine 2\nLine 3\nLine 4',
            format: 'unified',
            context: 3,
        },
        exampleOutput: {
            success: true,
            diff: '@@ -1,3 +1,4 @@\n-Hello World\n+Hello Universe\n Line 2\n Line 3\n+Line 4',
            format: 'unified',
            linesAdded: 2,
            linesRemoved: 1,
            linesChanged: 3,
            identical: false,
            message: 'Generated diff: 1 removed, 2 added',
        },
        usageNotes:
            'Use for comparing configuration changes, code reviews, or validation. JSON format provides structured hunks for programmatic processing.',
=======
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
>>>>>>> theirs
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
<<<<<<< ours
        type DaggerClient = { container(): ContainerBuilder };
        const d = dag as unknown as DaggerClient;

        const format = input.format ?? context.config.defaultFormat ?? 'unified';
        const contextLines = input.context ?? context.config.defaultContext ?? 3;

        let container = d
            .container()
            .from('alpine:3.19')
            .withEnvVariable('FORMAT', format)
            .withEnvVariable('CONTEXT_LINES', String(contextLines));

        if (input.original) {
            container = container.withEnvVariable('ORIGINAL', input.original);
        }
        if (input.modified) {
            container = container.withEnvVariable('MODIFIED', input.modified);
        }
        if (input.originalPath) {
            container = container.withEnvVariable('ORIGINAL_PATH', input.originalPath);
        }
        if (input.modifiedPath) {
            container = container.withEnvVariable('MODIFIED_PATH', input.modifiedPath);
        }
        if (input.outputPath) {
            container = container.withEnvVariable('OUTPUT_PATH', input.outputPath);
        }
        if (input.ignoreWhitespace) {
            container = container.withEnvVariable('IGNORE_WHITESPACE', 'true');
        }
        if (input.ignoreCase) {
            container = container.withEnvVariable('IGNORE_CASE', 'true');
        }
=======
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
>>>>>>> theirs

        return container.withExec([
            'sh',
            '-c',
            `
#!/bin/sh
set -e

<<<<<<< ours
apk add --no-cache diffutils jq >/dev/null 2>&1

FORMAT="$FORMAT"
CONTEXT_LINES="$CONTEXT_LINES"
SUCCESS=true
MESSAGE=""
DIFF_OUTPUT=""
LINES_ADDED=0
LINES_REMOVED=0
LINES_CHANGED=0
IDENTICAL=false
OUTPUT_PATH_OUT=""
HUNKS="[]"

# Prepare files
if [ -n "$ORIGINAL" ]; then
  echo "$ORIGINAL" > /tmp/original.txt
  ORIGINAL_FILE=/tmp/original.txt
else
  ORIGINAL_FILE="$ORIGINAL_PATH"
fi

if [ -n "$MODIFIED" ]; then
  echo "$MODIFIED" > /tmp/modified.txt
  MODIFIED_FILE=/tmp/modified.txt
else
  MODIFIED_FILE="$MODIFIED_PATH"
fi

# Build diff command
DIFF_ARGS="-U $CONTEXT_LINES"

if [ "$IGNORE_WHITESPACE" = "true" ]; then
  DIFF_ARGS="$DIFF_ARGS -b"
fi

if [ "$IGNORE_CASE" = "true" ]; then
  DIFF_ARGS="$DIFF_ARGS -i"
fi

# Run diff
DIFF_OUTPUT=$(diff $DIFF_ARGS "$ORIGINAL_FILE" "$MODIFIED_FILE" 2>/dev/null) || true

if [ -z "$DIFF_OUTPUT" ]; then
  IDENTICAL=true
  MESSAGE="Files are identical"
else
  IDENTICAL=false
  
  # Count changes
  LINES_ADDED=$(echo "$DIFF_OUTPUT" | grep -c '^+[^+]' 2>/dev/null || echo "0")
  LINES_REMOVED=$(echo "$DIFF_OUTPUT" | grep -c '^-[^-]' 2>/dev/null || echo "0")
  LINES_CHANGED=$((LINES_ADDED + LINES_REMOVED))
  
  MESSAGE="Generated diff: $LINES_REMOVED removed, $LINES_ADDED added"
  
  # Write output if path specified
  if [ -n "$OUTPUT_PATH" ]; then
    echo "$DIFF_OUTPUT" > "$OUTPUT_PATH"
    OUTPUT_PATH_OUT="$OUTPUT_PATH"
  fi
fi

# Convert to requested format
case "$FORMAT" in
  unified)
    # Already in unified format
    ;;
    
  side-by-side)
    DIFF_OUTPUT=$(diff -y -W 120 "$ORIGINAL_FILE" "$MODIFIED_FILE" 2>/dev/null || true)
    ;;
    
  json)
    # Parse unified diff into JSON hunks
    HUNKS=$(echo "$DIFF_OUTPUT" | awk '
      BEGIN { print "["; first=1 }
      /^@@/ {
        if (!first) print ","
        first=0
        match($0, /@@ -([0-9]+),?([0-9]*) \\+([0-9]+),?([0-9]*)/, m)
        printf "{\"originalStart\":%d,\"originalCount\":%d,\"modifiedStart\":%d,\"modifiedCount\":%d,\"changes\":[", \\
          m[1], (m[2]?m[2]:1), m[3], (m[4]?m[4]:1)
        in_hunk=1; first_change=1
        next
      }
      in_hunk && /^[-+]/ {
        if (!first_change) printf ","
        first_change=0
        type = (substr($0,1,1)=="+") ? "add" : "remove"
        content = substr($0,2)
        gsub(/"/, "\\\\\"", content)
        printf "{\"type\":\"%s\",\"content\":\"%s\"}", type, content
      }
      in_hunk && /^ / {
        if (!first_change) printf ","
        first_change=0
        content = substr($0,2)
        gsub(/"/, "\\\\\"", content)
        printf "{\"type\":\"context\",\"content\":\"%s\"}", content
      }
      /^[^-+ @]/ && in_hunk { print "]}"; in_hunk=0 }
      END { if(in_hunk) print "]}"; print "]" }
    ')
    ;;
    
  html)
    DIFF_OUTPUT="<pre class=\\"diff\\">"$(echo "$DIFF_OUTPUT" | sed \\
      -e 's/&/\\&amp;/g' \\
      -e 's/</\\&lt;/g' \\
      -e 's/>/\\&gt;/g' \\
      -e 's/^-.*$/<span class=\"removed\">\\&<\\/span>/' \\
      -e 's/^+.*$/<span class=\"added\">\\&<\\/span>/' \\
      -e 's/^@@.*$/<span class=\"hunk\">\\&<\\/span>/')"</pre>"
    ;;
esac

# Escape diff output for JSON
DIFF_ESCAPED=$(echo "$DIFF_OUTPUT" | jq -Rs . 2>/dev/null || echo '""')
=======
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
>>>>>>> theirs

cat <<EOF
{
  "success": $SUCCESS,
<<<<<<< ours
  "diff": $DIFF_ESCAPED,
  "format": "$FORMAT",
  "hunks": $HUNKS,
  "linesAdded": $LINES_ADDED,
  "linesRemoved": $LINES_REMOVED,
  "linesChanged": $LINES_CHANGED,
  "identical": $IDENTICAL,
  "outputPath": "$OUTPUT_PATH_OUT",
=======
  "operation": "$OPERATION",
  "diff": $DIFF_JSON,
  "patchedContent": $PATCHED_JSON,
  "stats": {
    "linesAdded": $LINES_ADDED,
    "linesRemoved": $LINES_REMOVED,
    "hunks": $HUNKS
  },
>>>>>>> theirs
  "message": "$MESSAGE"
}
EOF
        `.trim(),
        ]);
    },
};
