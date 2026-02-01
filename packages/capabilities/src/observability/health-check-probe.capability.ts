/**
 * packages/capabilities/src/observability/health-check-probe.capability.ts
 * Health Check Probe Capability (OCS-001 Connector Pattern)
 *
 * Provides health and connectivity probes for services and endpoints.
 * Supports HTTP, TCP, DNS, and gRPC probe types.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const probeTypeSchema = z.enum([
    'http',
    'tcp',
    'dns',
    'grpc',
]).describe('Type of health check probe');

const inputSchema = z
    .object({
        probeType: probeTypeSchema,
        url: z.string().optional().describe('URL for HTTP probe'),
        host: z.string().optional().describe('Host for TCP/gRPC probe'),
        port: z.number().int().positive().optional().describe('Port for TCP/gRPC probe'),
        hostname: z.string().optional().describe('Hostname for DNS probe'),
        expectedStatus: z.number().int().optional().describe('Expected HTTP status code'),
        expectedBody: z.string().optional().describe('Expected string in response body'),
        headers: z.record(z.string()).optional().describe('HTTP headers to send'),
        timeout: z.number().positive().optional().describe('Probe timeout in milliseconds'),
        retries: z.number().int().min(0).optional().describe('Number of retries'),
        retryDelay: z.number().positive().optional().describe('Delay between retries in ms'),
        dnsType: z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS']).optional().describe('DNS record type'),
        grpcService: z.string().optional().describe('gRPC service name for health check'),
    })
    .describe('Health Check Probe input');

const outputSchema = z
    .object({
        healthy: z.boolean().describe('Whether the target is healthy'),
        probeType: probeTypeSchema.describe('Probe type used'),
        target: z.string().describe('Target checked'),
        responseTime: z.number().describe('Response time in milliseconds'),
        statusCode: z.number().optional().describe('HTTP status code'),
        responseBody: z.string().optional().describe('Response body (truncated)'),
        dnsRecords: z.array(z.string()).optional().describe('DNS records returned'),
        error: z.string().optional().describe('Error message if unhealthy'),
        attempts: z.number().describe('Number of attempts made'),
        checkedAt: z.string().describe('ISO timestamp of check'),
    })
    .describe('Health Check Probe output');

const configSchema = z
    .object({
        defaultTimeout: z.number().positive().optional().describe('Default timeout'),
        maxBodySize: z.number().positive().optional().describe('Max response body to capture'),
    })
    .describe('Health Check Probe configuration');

const secretsSchema = z
    .object({
        authToken: z.string().optional().describe('Auth token for HTTP probes'),
    })
    .describe('Health Check Probe secrets');

export type HealthCheckProbeInput = z.infer<typeof inputSchema>;
export type HealthCheckProbeOutput = z.infer<typeof outputSchema>;
export type HealthCheckProbeConfig = z.infer<typeof configSchema>;
export type HealthCheckProbeSecrets = z.infer<typeof secretsSchema>;

export const healthCheckProbeCapability: Capability<
    HealthCheckProbeInput,
    HealthCheckProbeOutput,
    HealthCheckProbeConfig,
    HealthCheckProbeSecrets
> = {
    metadata: {
        id: 'golden.observability.health-check-probe',
        version: '1.0.0',
        name: 'healthCheckProbe',
        description:
            'Health and connectivity probes for services and endpoints. Supports HTTP, TCP, DNS, and gRPC probe types.',
        tags: ['connector', 'observability', 'health', 'monitoring'],
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
            allowOutbound: ['*'], // Probe targets are dynamic
        },
    },
    operations: {
        isIdempotent: true,
        retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 1, backoffCoefficient: 1 },
        errorMap: (error: unknown) => {
            if (error instanceof Error) {
                if (error.message.includes('timeout')) return 'RETRYABLE';
                if (error.message.includes('ECONNREFUSED')) return 'RETRYABLE';
            }
            return 'FATAL';
        },
        costFactor: 'LOW',
    },
    aiHints: {
        exampleInput: {
            probeType: 'http',
            url: 'https://api.example.com/health',
            expectedStatus: 200,
            timeout: 5000,
        },
        exampleOutput: {
            healthy: true,
            probeType: 'http',
            target: 'https://api.example.com/health',
            responseTime: 125,
            statusCode: 200,
            attempts: 1,
            checkedAt: '2024-01-15T10:30:00Z',
        },
        usageNotes:
            'Use for liveness/readiness checks. HTTP probe checks status codes and optional body content. TCP probe validates port connectivity. DNS probe verifies DNS resolution.',
    },
    factory: (
        dag,
        context: CapabilityContext<HealthCheckProbeConfig, HealthCheckProbeSecrets>,
        input: HealthCheckProbeInput
    ) => {
        type ContainerBuilder = {
            from(image: string): ContainerBuilder;
            withEnvVariable(key: string, value: string): ContainerBuilder;
            withExec(args: string[]): unknown;
        };
        type DaggerClient = { container(): ContainerBuilder };
        const d = dag as unknown as DaggerClient;

        const timeout = input.timeout ?? context.config.defaultTimeout ?? 5000;
        const target = input.url ?? `${input.host}:${input.port}` ?? input.hostname ?? 'unknown';

        const payload = {
            probeType: input.probeType,
            url: input.url,
            host: input.host,
            port: input.port,
            hostname: input.hostname,
            expectedStatus: input.expectedStatus ?? 200,
            expectedBody: input.expectedBody,
            headers: input.headers,
            timeout,
            retries: input.retries ?? 0,
            retryDelay: input.retryDelay ?? 1000,
            dnsType: input.dnsType ?? 'A',
            grpcService: input.grpcService,
            maxBodySize: context.config.maxBodySize ?? 1024,
            authTokenRef: context.secretRefs.authToken,
        };

        return d
            .container()
            .from('alpine:latest')
            .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
            .withEnvVariable('PROBE_TYPE', input.probeType)
            .withEnvVariable('TARGET_URL', target)
            .withExec([
                'sh',
                '-c',
                `
apk add --no-cache curl bind-tools jq netcat-openbsd 2>/dev/null

INPUT_JSON="\${INPUT_JSON}"
PROBE_TYPE=$(echo "$INPUT_JSON" | jq -r '.probeType')
TIMEOUT=$(echo "$INPUT_JSON" | jq -r '.timeout // 5000')
TIMEOUT_SECS=$((TIMEOUT / 1000))
RETRIES=$(echo "$INPUT_JSON" | jq -r '.retries // 0')
RETRY_DELAY=$(echo "$INPUT_JSON" | jq -r '.retryDelay // 1000')
MAX_BODY=$(echo "$INPUT_JSON" | jq -r '.maxBodySize // 1024')

ATTEMPT=0
HEALTHY=false
ERROR=""
RESPONSE_TIME=0
STATUS_CODE=0
RESPONSE_BODY=""
DNS_RECORDS="[]"

while [ $ATTEMPT -le $RETRIES ] && [ "$HEALTHY" = "false" ]; do
  ATTEMPT=$((ATTEMPT + 1))
  START_TIME=$(date +%s%3N)

  case "$PROBE_TYPE" in
    http)
      URL=$(echo "$INPUT_JSON" | jq -r '.url')
      EXPECTED_STATUS=$(echo "$INPUT_JSON" | jq -r '.expectedStatus // 200')
      
      # Build curl command
      CURL_CMD="curl -s -o /tmp/response -w '%{http_code}' --max-time $TIMEOUT_SECS"
      
      # Add headers
      HEADERS=$(echo "$INPUT_JSON" | jq -r '.headers // {} | to_entries[] | "-H \\(.key): \\(.value)"' 2>/dev/null | tr '\\n' ' ')
      CURL_CMD="$CURL_CMD $HEADERS"
      
      STATUS_CODE=$(eval $CURL_CMD "$URL" 2>/dev/null || echo "000")
      RESPONSE_BODY=$(head -c $MAX_BODY /tmp/response 2>/dev/null || echo "")
      
      if [ "$STATUS_CODE" = "$EXPECTED_STATUS" ]; then
        # Check expected body if specified
        EXPECTED_BODY=$(echo "$INPUT_JSON" | jq -r '.expectedBody // empty')
        if [ -n "$EXPECTED_BODY" ]; then
          if echo "$RESPONSE_BODY" | grep -q "$EXPECTED_BODY"; then
            HEALTHY=true
          else
            ERROR="Expected body not found"
          fi
        else
          HEALTHY=true
        fi
      else
        ERROR="Unexpected status: $STATUS_CODE (expected $EXPECTED_STATUS)"
      fi
      TARGET="$URL"
      ;;
      
    tcp)
      HOST=$(echo "$INPUT_JSON" | jq -r '.host')
      PORT=$(echo "$INPUT_JSON" | jq -r '.port')
      
      if nc -z -w $TIMEOUT_SECS "$HOST" "$PORT" 2>/dev/null; then
        HEALTHY=true
      else
        ERROR="TCP connection failed to $HOST:$PORT"
      fi
      TARGET="$HOST:$PORT"
      ;;
      
    dns)
      HOSTNAME=$(echo "$INPUT_JSON" | jq -r '.hostname')
      DNS_TYPE=$(echo "$INPUT_JSON" | jq -r '.dnsType // "A"')
      
      RESULT=$(dig +short "$HOSTNAME" "$DNS_TYPE" 2>/dev/null)
      if [ -n "$RESULT" ]; then
        HEALTHY=true
        DNS_RECORDS=$(echo "$RESULT" | jq -R -s 'split("\\n") | map(select(length > 0))')
      else
        ERROR="DNS resolution failed for $HOSTNAME"
      fi
      TARGET="$HOSTNAME"
      ;;
      
    grpc)
      HOST=$(echo "$INPUT_JSON" | jq -r '.host')
      PORT=$(echo "$INPUT_JSON" | jq -r '.port')
      # For now, just do TCP check (full gRPC would need grpcurl)
      if nc -z -w $TIMEOUT_SECS "$HOST" "$PORT" 2>/dev/null; then
        HEALTHY=true
      else
        ERROR="gRPC connection failed to $HOST:$PORT"
      fi
      TARGET="$HOST:$PORT"
      ;;
  esac
  
  END_TIME=$(date +%s%3N)
  RESPONSE_TIME=$((END_TIME - START_TIME))
  
  if [ "$HEALTHY" = "false" ] && [ $ATTEMPT -le $RETRIES ]; then
    sleep $((RETRY_DELAY / 1000))
  fi
done

# Output result
cat << EOF
{
  "healthy": $HEALTHY,
  "probeType": "$PROBE_TYPE",
  "target": "$TARGET",
  "responseTime": $RESPONSE_TIME,
  "statusCode": $STATUS_CODE,
  "responseBody": $(echo "$RESPONSE_BODY" | jq -Rs .),
  "dnsRecords": $DNS_RECORDS,
  "error": $([ -n "$ERROR" ] && echo "\"$ERROR\"" || echo "null"),
  "attempts": $ATTEMPT,
  "checkedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    `.trim(),
            ]);
    },
};
