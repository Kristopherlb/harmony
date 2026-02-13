/**
 * packages/capabilities/src/observability/mcp-readiness.capability.ts
 * MCP Server Readiness Capability (OCS-001 Connector Pattern)
 *
 * Checks that the Harmony MCP tool catalog is up and available (Console API path).
 * Use for preflight gates before blueprint generation or agent tool discovery.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const inputSchema = z
  .object({
    baseUrl: z.string().url().describe('Console base URL (e.g. http://localhost:5000)'),
    timeoutMs: z.number().int().positive().optional().describe('Request timeout in milliseconds'),
  })
  .describe('MCP Readiness check input');

const outputSchema = z
  .object({
    available: z.boolean().describe('Whether the MCP catalog endpoint is reachable and returns tools'),
    toolCount: z.number().int().min(0).describe('Number of tools in the catalog'),
    generatedAt: z.string().optional().describe('ISO timestamp from manifest.generated_at'),
    responseTimeMs: z.number().optional().describe('Response time in milliseconds'),
    error: z.string().optional().describe('Error message if unavailable'),
    checkedAt: z.string().describe('ISO timestamp of check'),
  })
  .describe('MCP Readiness check output');

const configSchema = z.object({}).describe('MCP Readiness configuration');
const secretsSchema = z.object({}).describe('MCP Readiness secrets');

export type McpReadinessInput = z.infer<typeof inputSchema>;
export type McpReadinessOutput = z.infer<typeof outputSchema>;
export type McpReadinessConfig = z.infer<typeof configSchema>;
export type McpReadinessSecrets = z.infer<typeof secretsSchema>;

export const mcpReadinessCapability: Capability<
  McpReadinessInput,
  McpReadinessOutput,
  McpReadinessConfig,
  McpReadinessSecrets
> = {
  metadata: {
    id: 'golden.observability.mcp-readiness',
    domain: 'observability',
    version: '1.0.0',
    name: 'mcpReadiness',
    description:
      'Check that the Harmony MCP tool catalog is up and available via the Console API (GET /api/mcp/tools). Use before blueprint generation or agent discovery.',
    tags: ['connector', 'observability', 'health', 'mcp', 'workbench'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['observability:read'],
    dataClassification: 'INTERNAL',
    networkAccess: {
      allowOutbound: ['*'],
    },
  },
  operations: {
    isIdempotent: true,
    retryPolicy: { maxAttempts: 2, initialIntervalSeconds: 1, backoffCoefficient: 1 },
    errorMap: (error: unknown) => {
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) return 'RETRYABLE';
      }
      return 'FATAL';
    },
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {
      baseUrl: 'http://localhost:5000',
      timeoutMs: 5000,
    },
    exampleOutput: {
      available: true,
      toolCount: 42,
      generatedAt: '2026-02-11T12:00:00.000Z',
      responseTimeMs: 120,
      checkedAt: '2026-02-11T12:00:01.000Z',
    },
    usageNotes:
      'Use for MCP hard gate before blueprint-first tests or agent tool discovery. Requires Console to be serving /api/mcp/tools.',
  },
  factory: (dag, _context: CapabilityContext<McpReadinessConfig, McpReadinessSecrets>, input: McpReadinessInput) => {
    type ContainerBuilder = {
      from(image: string): ContainerBuilder;
      withEnvVariable(key: string, value: string): ContainerBuilder;
      withExec(args: string[]): unknown;
    };
    type DaggerClient = { container(): ContainerBuilder };
    const d = dag as unknown as DaggerClient;
    const baseUrl = input.baseUrl.replace(/\/$/, '');
    const url = `${baseUrl}/api/mcp/tools`;
    const timeoutSec = Math.max(1, Math.ceil((input.timeoutMs ?? 5000) / 1000));

    return d
      .container()
      .from('alpine:latest')
      .withEnvVariable('MCP_URL', url)
      .withEnvVariable('TIMEOUT_SEC', String(timeoutSec))
      .withExec([
        'sh',
        '-c',
        `
apk add --no-cache curl jq 2>/dev/null
START=$(date +%s%3N)
RESP=$(curl -s -o /tmp/mcp.json -w "%{http_code}" --max-time "$TIMEOUT_SEC" "$MCP_URL") || true
END=$(date +%s%3N)
RT=$((END - START))

if [ "$RESP" != "200" ]; then
  echo "{\"available\":false,\"toolCount\":0,\"responseTimeMs\":$RT,\"error\":\"HTTP $RESP\",\"checkedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"}"
  exit 0
fi

COUNT=$(jq -r '.tools | length' /tmp/mcp.json 2>/dev/null || echo "0")
GEN=$(jq -r '.manifest.generated_at // empty' /tmp/mcp.json 2>/dev/null)
AVAIL=false
if [ -n "$COUNT" ] && [ "$COUNT" != "null" ] && [ "$COUNT" -ge 0 ]; then
  AVAIL=true
fi
echo "{\"available\":$AVAIL,\"toolCount\":\${COUNT:-0},\"generatedAt\":\"$GEN\",\"responseTimeMs\":$RT,\"checkedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"}"
`.trim(),
      ]);
  },
};
