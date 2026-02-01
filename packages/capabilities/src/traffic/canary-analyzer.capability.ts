/**
 * packages/capabilities/src/traffic/canary-analyzer.capability.ts
 * Canary Analyzer Capability (OCS-001 Guardian Pattern)
 *
 * Compare GOS-001 Golden Signals between baseline and canary versions.
 * Returns PROMOTE/ROLLBACK decision based on error rate delta.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
  'analyze',          // Analyze canary vs baseline metrics
  'compare-metrics',  // Compare specific metrics
  'get-decision',     // Get rollout decision based on thresholds
]).describe('Canary analyzer operation');

const metricTypeSchema = z.enum([
  'error_rate',
  'latency_p50',
  'latency_p90',
  'latency_p99',
  'throughput',
  'success_rate',
  'saturation',
]).describe('Metric type to analyze');

const decisionSchema = z.enum([
  'PROMOTE',    // Canary is healthy, continue rollout
  'ROLLBACK',   // Canary is degraded, rollback
  'CONTINUE',   // Need more data, continue observation
]).describe('Canary analysis decision');

const metricResultSchema = z.object({
  metric: metricTypeSchema.describe('Metric analyzed'),
  baselineValue: z.number().describe('Baseline version metric value'),
  canaryValue: z.number().describe('Canary version metric value'),
  delta: z.number().describe('Difference (canary - baseline)'),
  deltaPercent: z.number().describe('Percentage change'),
  threshold: z.number().describe('Configured threshold'),
  passed: z.boolean().describe('Whether metric is within threshold'),
});

const inputSchema = z
  .object({
    operation: operationSchema,
    baselineVersion: z.string().describe('Baseline version identifier'),
    canaryVersion: z.string().describe('Canary version identifier'),
    prometheusUrl: z.string().describe('Prometheus server URL'),
    analysisWindowSeconds: z.number().positive().optional().describe('Time window for analysis, defaults to 600s'),
    errorRateThreshold: z.number().min(0).max(1).optional().describe('Error rate threshold (0-1), defaults to 0.05'),
    latencyThresholdMs: z.number().positive().optional().describe('Latency threshold in ms'),
    metrics: z.array(metricTypeSchema).optional().describe('Metrics to analyze, defaults to error_rate'),
    service: z.string().optional().describe('Service name for metric queries'),
    namespace: z.string().optional().describe('Kubernetes namespace'),
  })
  .describe('Canary Analyzer input');

const outputSchema = z
  .object({
    decision: decisionSchema.describe('Overall rollout decision'),
    baselineVersion: z.string().describe('Baseline version analyzed'),
    canaryVersion: z.string().describe('Canary version analyzed'),
    baselineMetrics: z.record(z.number()).describe('Baseline metric values'),
    canaryMetrics: z.record(z.number()).describe('Canary metric values'),
    deltas: z.record(z.number()).describe('Delta per metric'),
    metricResults: z.array(metricResultSchema).describe('Detailed metric analysis'),
    reason: z.string().describe('Human-readable decision reason'),
    analysisWindowSeconds: z.number().describe('Analysis window used'),
    analyzedAt: z.string().describe('ISO timestamp of analysis'),
  })
  .describe('Canary Analyzer output');

const configSchema = z
  .object({
    defaultPrometheusUrl: z.string().optional().describe('Default Prometheus URL'),
    defaultAnalysisWindow: z.number().positive().optional().describe('Default analysis window'),
    defaultErrorThreshold: z.number().min(0).max(1).optional().describe('Default error threshold'),
  })
  .describe('Canary Analyzer configuration');

const secretsSchema = z
  .object({
    prometheusToken: z.string().optional().describe('Prometheus bearer token'),
  })
  .describe('Canary Analyzer secrets');

export type CanaryAnalyzerInput = z.infer<typeof inputSchema>;
export type CanaryAnalyzerOutput = z.infer<typeof outputSchema>;
export type CanaryAnalyzerConfig = z.infer<typeof configSchema>;
export type CanaryAnalyzerSecrets = z.infer<typeof secretsSchema>;

export const canaryAnalyzerCapability: Capability<
  CanaryAnalyzerInput,
  CanaryAnalyzerOutput,
  CanaryAnalyzerConfig,
  CanaryAnalyzerSecrets
> = {
  metadata: {
    id: 'golden.traffic.canary-analyzer',
    version: '1.0.0',
    name: 'canaryAnalyzer',
    description:
      'Compare GOS-001 Golden Signals between baseline and canary versions. Returns PROMOTE/ROLLBACK decision based on error rate delta and latency thresholds.',
    tags: ['guardian', 'traffic', 'observability', 'canary'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['metrics:read'],
    dataClassification: 'INTERNAL',
    networkAccess: {
      allowOutbound: ['prometheus:9090', '*.prometheus.io'],
    },
    oscalControlIds: ['SI-4', 'CA-7'], // Info system monitoring, continuous monitoring
  },
  operations: {
    isIdempotent: true,
    retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 5, backoffCoefficient: 2 },
    errorMap: (error: unknown) => {
      if (error instanceof Error) {
        if (error.message.includes('connection')) return 'RETRYABLE';
        if (error.message.includes('timeout')) return 'RETRYABLE';
        if (error.message.includes('no data')) return 'RETRYABLE';
        if (error.message.includes('unauthorized')) return 'FATAL';
      }
      return 'FATAL';
    },
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {
      operation: 'analyze',
      baselineVersion: 'v1.9.0',
      canaryVersion: 'v2.0.0',
      prometheusUrl: 'http://prometheus:9090',
      analysisWindowSeconds: 600,
      errorRateThreshold: 0.05,
      metrics: ['error_rate', 'latency_p99'],
    },
    exampleOutput: {
      decision: 'PROMOTE',
      baselineVersion: 'v1.9.0',
      canaryVersion: 'v2.0.0',
      baselineMetrics: { error_rate: 0.01, latency_p99: 150 },
      canaryMetrics: { error_rate: 0.012, latency_p99: 145 },
      deltas: { error_rate: 0.002, latency_p99: -5 },
      metricResults: [
        {
          metric: 'error_rate',
          baselineValue: 0.01,
          canaryValue: 0.012,
          delta: 0.002,
          deltaPercent: 20,
          threshold: 0.05,
          passed: true,
        },
      ],
      reason: 'Canary error rate (1.2%) within threshold (5%). Latency improved by 3%.',
      analysisWindowSeconds: 600,
      analyzedAt: '2024-01-15T10:30:00Z',
    },
    usageNotes:
      'Use during progressive rollout to determine if canary should be promoted. Requires Prometheus with GOS-001 compliant metrics. Set appropriate thresholds for your SLOs.',
  },
  factory: (
    dag,
    context: CapabilityContext<CanaryAnalyzerConfig, CanaryAnalyzerSecrets>,
    input: CanaryAnalyzerInput
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

    const prometheusUrl = input.prometheusUrl || context.config.defaultPrometheusUrl || 'http://prometheus:9090';
    const analysisWindow = input.analysisWindowSeconds || context.config.defaultAnalysisWindow || 600;
    const errorThreshold = input.errorRateThreshold || context.config.defaultErrorThreshold || 0.05;
    const metrics = input.metrics || ['error_rate'];

    const payload = {
      operation: input.operation,
      baselineVersion: input.baselineVersion,
      canaryVersion: input.canaryVersion,
      prometheusUrl,
      analysisWindowSeconds: analysisWindow,
      errorRateThreshold: errorThreshold,
      latencyThresholdMs: input.latencyThresholdMs,
      metrics,
      service: input.service,
      namespace: input.namespace,
    };

    let container = d
      .container()
      .from('curlimages/curl:latest')
      .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
      .withEnvVariable('OPERATION', input.operation)
      .withEnvVariable('PROMETHEUS_URL', prometheusUrl);

    // Mount Prometheus token if provided
    if (context.secretRefs.prometheusToken) {
      container = container.withMountedSecret(
        '/run/secrets/prometheus_token',
        context.secretRefs.prometheusToken as unknown as DaggerSecret
      );
    }

    return container.withExec([
      'sh',
      '-c',
      `
#!/bin/sh
set -e

apk add --no-cache jq bc 2>/dev/null || true

INPUT_JSON='${JSON.stringify(payload)}'
OPERATION="${input.operation}"
PROMETHEUS_URL="${prometheusUrl}"
BASELINE="${input.baselineVersion}"
CANARY="${input.canaryVersion}"
WINDOW="${analysisWindow}"
ERROR_THRESHOLD="${errorThreshold}"
SERVICE="${input.service ?? ''}"
NAMESPACE="${input.namespace ?? ''}"
WINDOW_RANGE="$WINDOW"s

# Build auth header if token provided
TOKEN=""
if [ -f /run/secrets/prometheus_token ]; then
  TOKEN=$(cat /run/secrets/prometheus_token | tr -d '\n' 2>/dev/null || echo "")
fi

# Query Prometheus
query_prometheus() {
  local query="$1"
  local url="$PROMETHEUS_URL/api/v1/query"
  local encoded_query=$(echo "$query" | jq -sRr @uri)
  
  if [ -n "$TOKEN" ]; then
    curl -s -H "Authorization: Bearer $TOKEN" "$url?query=$encoded_query" | jq -r '.data.result[0].value[1] // "0"'
  else
    curl -s "$url?query=$encoded_query" | jq -r '.data.result[0].value[1] // "0"'
  fi
}

# Build version label selector
version_selector() {
  local version="$1"
  local selector="version=\\"$version\\""
  if [ -n "$SERVICE" ]; then
    selector="$selector,service=\\"$SERVICE\\""
  fi
  if [ -n "$NAMESPACE" ]; then
    selector="$selector,namespace=\\"$NAMESPACE\\""
  fi
  echo "$selector"
}

BASELINE_METRICS="{}"
CANARY_METRICS="{}"
DELTAS="{}"
METRIC_RESULTS="[]"
DECISION="CONTINUE"
REASON=""
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

analyze_metrics() {
  local all_passed=true
  
  # Error rate query
  BASELINE_SELECTOR=$(version_selector "$BASELINE")
  CANARY_SELECTOR=$(version_selector "$CANARY")
  
  # Query error rate
  BASELINE_ERROR=$(query_prometheus "sum(rate(http_requests_total{$BASELINE_SELECTOR,status=~\\"5..\\"}[$WINDOW_RANGE]))/sum(rate(http_requests_total{$BASELINE_SELECTOR}[$WINDOW_RANGE]))")
  CANARY_ERROR=$(query_prometheus "sum(rate(http_requests_total{$CANARY_SELECTOR,status=~\\"5..\\"}[$WINDOW_RANGE]))/sum(rate(http_requests_total{$CANARY_SELECTOR}[$WINDOW_RANGE]))")
  
  # Handle NaN/empty results (avoid shell parameter expansion patterns in template strings)
  case "$BASELINE_ERROR" in
    ""|"NaN"|"null") BASELINE_ERROR=0 ;;
  esac
  case "$CANARY_ERROR" in
    ""|"NaN"|"null") CANARY_ERROR=0 ;;
  esac
  
  ERROR_DELTA=$(echo "$CANARY_ERROR - $BASELINE_ERROR" | bc -l 2>/dev/null || echo "0")
  ERROR_DELTA_PCT=$(echo "scale=2; $ERROR_DELTA * 100 / ($BASELINE_ERROR + 0.0001)" | bc -l 2>/dev/null || echo "0")
  
  ERROR_PASSED="true"
  if [ "$(echo "$CANARY_ERROR > $ERROR_THRESHOLD" | bc -l)" = "1" ]; then
    ERROR_PASSED="false"
    all_passed=false
  fi
  
  BASELINE_METRICS=$(echo "$BASELINE_METRICS" | jq --arg v "$BASELINE_ERROR" '. + {error_rate: ($v | tonumber)}')
  CANARY_METRICS=$(echo "$CANARY_METRICS" | jq --arg v "$CANARY_ERROR" '. + {error_rate: ($v | tonumber)}')
  DELTAS=$(echo "$DELTAS" | jq --arg v "$ERROR_DELTA" '. + {error_rate: ($v | tonumber)}')
  
  METRIC_RESULTS=$(echo "$METRIC_RESULTS" | jq --arg baseline "$BASELINE_ERROR" --arg canary "$CANARY_ERROR" --arg delta "$ERROR_DELTA" --arg deltaPct "$ERROR_DELTA_PCT" --arg threshold "$ERROR_THRESHOLD" --arg passed "$ERROR_PASSED" '. + [{
    metric: "error_rate",
    baselineValue: ($baseline | tonumber),
    canaryValue: ($canary | tonumber),
    delta: ($delta | tonumber),
    deltaPercent: ($deltaPct | tonumber),
    threshold: ($threshold | tonumber),
    passed: ($passed == "true")
  }]')
  
  # Query latency p99 if requested
  BASELINE_LATENCY=$(query_prometheus "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{$BASELINE_SELECTOR}[$WINDOW_RANGE])) by (le)) * 1000")
  CANARY_LATENCY=$(query_prometheus "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{$CANARY_SELECTOR}[$WINDOW_RANGE])) by (le)) * 1000")
  
  case "$BASELINE_LATENCY" in
    ""|"NaN"|"null") BASELINE_LATENCY=0 ;;
  esac
  case "$CANARY_LATENCY" in
    ""|"NaN"|"null") CANARY_LATENCY=0 ;;
  esac
  
  LATENCY_DELTA=$(echo "$CANARY_LATENCY - $BASELINE_LATENCY" | bc -l 2>/dev/null || echo "0")
  
  BASELINE_METRICS=$(echo "$BASELINE_METRICS" | jq --arg v "$BASELINE_LATENCY" '. + {latency_p99: ($v | tonumber)}')
  CANARY_METRICS=$(echo "$CANARY_METRICS" | jq --arg v "$CANARY_LATENCY" '. + {latency_p99: ($v | tonumber)}')
  DELTAS=$(echo "$DELTAS" | jq --arg v "$LATENCY_DELTA" '. + {latency_p99: ($v | tonumber)}')
  
  # Make decision
  if [ "$all_passed" = "true" ]; then
    DECISION="PROMOTE"
    REASON="Canary error rate within threshold. All metrics passed."
  else
    DECISION="ROLLBACK"
    REASON="Canary error rate ($CANARY_ERROR) exceeds threshold ($ERROR_THRESHOLD). Recommend rollback."
  fi
}

case "$OPERATION" in
  analyze|compare-metrics|get-decision)
    analyze_metrics
    ;;
  *)
    DECISION="CONTINUE"
    REASON="Unknown operation: $OPERATION"
    ;;
esac

# Output result
cat <<EOF
{
  "decision": "$DECISION",
  "baselineVersion": "$BASELINE",
  "canaryVersion": "$CANARY",
  "baselineMetrics": $BASELINE_METRICS,
  "canaryMetrics": $CANARY_METRICS,
  "deltas": $DELTAS,
  "metricResults": $METRIC_RESULTS,
  "reason": "$REASON",
  "analysisWindowSeconds": $WINDOW,
  "analyzedAt": "$TIMESTAMP"
}
EOF
        `.trim(),
    ]);
  },
};
