/**
 * packages/capabilities/src/security/clamav-scanner.capability.ts
 * ClamAV Scanner Capability (OCS-001 Commander Pattern)
 *
 * Provides malware and virus scanning using ClamAV engine.
 * Supports scanning files, directories, and raw data.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const scanTypeSchema = z.enum([
    'data',
    'path',
]).describe('Type of scan to perform');

const dataEncodingSchema = z.enum([
    'base64',
    'hex',
    'utf8',
]).describe('Encoding of input data');

const inputSchema = z
    .object({
        scanType: scanTypeSchema,
        data: z.string().optional().describe('Data to scan (for data scan type)'),
        dataEncoding: dataEncodingSchema.optional().default('base64').describe('Encoding of data'),
        path: z.string().optional().describe('File or directory path to scan (for path scan type)'),
        recursive: z.boolean().optional().default(true).describe('Scan directories recursively'),
        maxFileSize: z.number().positive().optional().describe('Maximum file size to scan in bytes'),
        maxScanSize: z.number().positive().optional().describe('Maximum data scanned per file in bytes'),
        excludePatterns: z.array(z.string()).optional().describe('Glob patterns to exclude from scan'),
    })
    .describe('ClamAV Scanner input');

const findingSchema = z.object({
    file: z.string().describe('File path or identifier'),
    virus: z.string().describe('Detected virus/malware name'),
    status: z.enum(['FOUND', 'OK', 'ERROR']).describe('Finding status'),
});

const outputSchema = z
    .object({
        clean: z.boolean().describe('Whether scan found no threats'),
        scannedFiles: z.number().describe('Number of files scanned'),
        scannedBytes: z.number().describe('Total bytes scanned'),
        infectedFiles: z.number().describe('Number of infected files found'),
        findings: z.array(findingSchema).describe('Detailed findings'),
        scanDuration: z.number().describe('Scan duration in milliseconds'),
        engineVersion: z.string().describe('ClamAV engine version'),
        signatureVersion: z.string().describe('Virus signature database version'),
        errors: z.array(z.string()).optional().describe('Any errors encountered during scan'),
    })
    .describe('ClamAV Scanner output');

const configSchema = z
    .object({
        updateSignatures: z.boolean().optional().default(false).describe('Update signatures before scan'),
        maxRecursion: z.number().int().positive().optional().default(16).describe('Maximum archive recursion depth'),
        alertBrokenExecutables: z.boolean().optional().default(false).describe('Alert on broken executables'),
        alertEncrypted: z.boolean().optional().default(false).describe('Alert on encrypted archives'),
    })
    .describe('ClamAV Scanner configuration');

const secretsSchema = z.object({}).describe('ClamAV Scanner secrets - none required');

export type ClamavScannerInput = z.infer<typeof inputSchema>;
export type ClamavScannerOutput = z.infer<typeof outputSchema>;
export type ClamavScannerConfig = z.infer<typeof configSchema>;
export type ClamavScannerSecrets = z.infer<typeof secretsSchema>;

export const clamavScannerCapability: Capability<
    ClamavScannerInput,
    ClamavScannerOutput,
    ClamavScannerConfig,
    ClamavScannerSecrets
> = {
    metadata: {
        id: 'golden.security.clamav-scanner',
        version: '1.0.0',
        name: 'clamavScanner',
        description:
            'Malware and virus scanning using ClamAV open-source antivirus engine. Scans files, directories, or raw data for known threats.',
        tags: ['commander', 'security', 'antivirus', 'malware', 'scanning'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['security:scan'],
        dataClassification: 'CONFIDENTIAL',
        networkAccess: {
            allowOutbound: ['database.clamav.net', 'clamav.net'], // For signature updates
        },
    },
    operations: {
        isIdempotent: true,
        retryPolicy: { maxAttempts: 2, initialIntervalSeconds: 5, backoffCoefficient: 2 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('database')) return 'TRANSIENT';
                if (error.message.includes('timeout')) return 'TRANSIENT';
                if (error.message.includes('memory')) return 'FATAL';
            }
            return 'FATAL';
        },
        costFactor: 'MEDIUM',
    },
    aiHints: {
        exampleInput: {
            scanType: 'data',
            data: 'SGVsbG8gV29ybGQhIFRoaXMgaXMgYSBjbGVhbiBmaWxlLg==',
            dataEncoding: 'base64',
        },
        exampleOutput: {
            clean: true,
            scannedFiles: 1,
            scannedBytes: 35,
            infectedFiles: 0,
            findings: [],
            scanDuration: 150,
            engineVersion: '0.105.2',
            signatureVersion: '26789',
        },
        usageNotes:
            'Use for scanning uploaded files, downloaded content, or suspicious data. For large file batches, use path scan with recursive option. Consider enabling signature updates for production use.',
    },
    factory: (
        dag,
        context: CapabilityContext<ClamavScannerConfig, ClamavScannerSecrets>,
        input: ClamavScannerInput
    ) => {
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = { container(): ContainerBuilder };
        const d = dag as unknown as DaggerClient;

        const payload = {
            scanType: input.scanType,
            data: input.data,
            dataEncoding: input.dataEncoding ?? 'base64',
            path: input.path,
            recursive: input.recursive ?? true,
            maxFileSize: input.maxFileSize,
            maxScanSize: input.maxScanSize,
            excludePatterns: input.excludePatterns,
            updateSignatures: context.config.updateSignatures ?? false,
            maxRecursion: context.config.maxRecursion ?? 16,
            alertBrokenExecutables: context.config.alertBrokenExecutables ?? false,
            alertEncrypted: context.config.alertEncrypted ?? false,
        };

        return d
            .container()
            .from('clamav/clamav:stable')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('SCAN_TYPE', input.scanType)
            .withEnvVariable('SCAN_PATH', input.path ?? '')
            .withExec([
                'sh',
                '-c',
                `
#!/bin/sh
set -e

# Parse input
INPUT_JSON=\${INPUT_JSON}
SCAN_TYPE=$(echo "$INPUT_JSON" | jq -r '.scanType')
UPDATE_SIGS=$(echo "$INPUT_JSON" | jq -r '.updateSignatures')

# Initialize results
START_TIME=$(date +%s%3N)
ENGINE_VERSION=$(clamscan --version | head -1 | awk '{print $2}')
SIG_VERSION=$(sigtool --version 2>/dev/null | grep -o '[0-9]*' | head -1 || echo "unknown")

# Update signatures if requested
if [ "$UPDATE_SIGS" = "true" ]; then
  freshclam --quiet 2>/dev/null || true
fi

# Create temp file for data scan
SCAN_TARGET=""
if [ "$SCAN_TYPE" = "data" ]; then
  DATA=$(echo "$INPUT_JSON" | jq -r '.data')
  ENCODING=$(echo "$INPUT_JSON" | jq -r '.dataEncoding')
  SCAN_TARGET="/tmp/scan_target"
  
  case "$ENCODING" in
    base64) echo "$DATA" | base64 -d > "$SCAN_TARGET" ;;
    hex) echo "$DATA" | xxd -r -p > "$SCAN_TARGET" ;;
    *) echo "$DATA" > "$SCAN_TARGET" ;;
  esac
else
  SCAN_TARGET=$(echo "$INPUT_JSON" | jq -r '.path')
fi

# Build clamscan options
CLAM_OPTS="--infected --no-summary"
RECURSIVE=$(echo "$INPUT_JSON" | jq -r '.recursive')
if [ "$RECURSIVE" = "true" ]; then
  CLAM_OPTS="$CLAM_OPTS -r"
fi

MAX_RECURSION=$(echo "$INPUT_JSON" | jq -r '.maxRecursion // 16')
CLAM_OPTS="$CLAM_OPTS --max-recursion=$MAX_RECURSION"

# Run scan and capture output
SCAN_OUTPUT=$(clamscan $CLAM_OPTS "$SCAN_TARGET" 2>&1) || true

# Parse results
END_TIME=$(date +%s%3N)
DURATION=$((END_TIME - START_TIME))
INFECTED=$(echo "$SCAN_OUTPUT" | grep -c "FOUND" || echo "0")
SCANNED_FILES=$(find "$SCAN_TARGET" -type f 2>/dev/null | wc -l || echo "1")
SCANNED_BYTES=$(du -sb "$SCAN_TARGET" 2>/dev/null | cut -f1 || echo "0")

# Build findings array
FINDINGS="[]"
if [ "$INFECTED" -gt 0 ]; then
  FINDINGS=$(echo "$SCAN_OUTPUT" | grep "FOUND" | while read line; do
    FILE=$(echo "$line" | cut -d: -f1)
    VIRUS=$(echo "$line" | cut -d: -f2 | sed 's/ FOUND//' | xargs)
    echo "{\\"file\\":\\"$FILE\\",\\"virus\\":\\"$VIRUS\\",\\"status\\":\\"FOUND\\"}"
  done | jq -s '.')
fi

# Clean result
CLEAN="true"
if [ "$INFECTED" -gt 0 ]; then
  CLEAN="false"
fi

# Output JSON result
cat << EOF
{
  "clean": $CLEAN,
  "scannedFiles": $SCANNED_FILES,
  "scannedBytes": $SCANNED_BYTES,
  "infectedFiles": $INFECTED,
  "findings": $FINDINGS,
  "scanDuration": $DURATION,
  "engineVersion": "$ENGINE_VERSION",
  "signatureVersion": "$SIG_VERSION"
}
EOF

# Cleanup
rm -f /tmp/scan_target
        `.trim(),
            ]);
    },
};
