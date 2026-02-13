/**
 * packages/capabilities/src/connectors/redis.capability.ts
 * Redis Connector Capability (OCS-001 Commander Pattern)
 *
 * Redis connector for cache operations, pub/sub, and data structures.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
  'get',           // Get key value
  'set',           // Set key value
  'delete',        // Delete key(s)
  'exists',        // Check if key exists
  'expire',        // Set key expiration
  'ttl',           // Get key TTL
  'incr',          // Increment value
  'decr',          // Decrement value
  'hget',          // Get hash field
  'hset',          // Set hash field
  'hgetall',       // Get all hash fields
  'lpush',         // Push to list head
  'rpush',         // Push to list tail
  'lpop',          // Pop from list head
  'lrange',        // Get list range
  'sadd',          // Add to set
  'smembers',      // Get set members
  'publish',       // Publish to channel
  'keys',          // Get keys matching pattern
]).describe('Redis operation');

const inputSchema = z
  .object({
    operation: operationSchema,
    key: z.string().optional().describe('Key name'),
    keys: z.array(z.string()).optional().describe('Multiple keys'),
    value: z.union([z.string(), z.number(), z.record(z.unknown())]).optional().describe('Value to set'),
    field: z.string().optional().describe('Hash field name'),
    fields: z.record(z.string()).optional().describe('Multiple hash fields'),
    values: z.array(z.string()).optional().describe('Multiple values for list/set'),
    ttlSeconds: z.number().positive().optional().describe('TTL in seconds'),
    start: z.number().optional().describe('Start index for lrange'),
    stop: z.number().optional().describe('Stop index for lrange'),
    pattern: z.string().optional().describe('Key pattern for keys command'),
    channel: z.string().optional().describe('Pub/sub channel'),
    message: z.string().optional().describe('Message for publish'),
  })
  .describe('Redis Connector input');

const outputSchema = z
  .object({
    success: z.boolean().describe('Whether the operation succeeded'),
    operation: operationSchema.describe('Operation performed'),
    key: z.string().optional().describe('Key operated on'),
    value: z.union([z.string(), z.number(), z.null()]).optional().describe('Retrieved value'),
    values: z.array(z.string()).optional().describe('Retrieved list/set values'),
    hash: z.record(z.string()).optional().describe('Retrieved hash'),
    exists: z.boolean().optional().describe('Whether key exists'),
    ttl: z.number().optional().describe('Key TTL in seconds'),
    count: z.number().optional().describe('Number of affected items'),
    keys: z.array(z.string()).optional().describe('Matched keys'),
    message: z.string().describe('Human-readable result message'),
  })
  .describe('Redis Connector output');

const configSchema = z
  .object({
    host: z.string().optional().describe('Redis host, defaults to localhost'),
    port: z.number().optional().describe('Redis port, defaults to 6379'),
    database: z.number().optional().describe('Redis database number, defaults to 0'),
    keyPrefix: z.string().optional().describe('Prefix for all keys'),
    cluster: z.boolean().optional().describe('Whether to use cluster mode'),
  })
  .describe('Redis Connector configuration');

const secretsSchema = z
  .object({
    password: z.string().optional().describe('Redis password'),
    tlsCert: z.string().optional().describe('TLS certificate for secure connections'),
  })
  .describe('Redis Connector secrets');

export type RedisInput = z.infer<typeof inputSchema>;
export type RedisOutput = z.infer<typeof outputSchema>;
export type RedisConfig = z.infer<typeof configSchema>;
export type RedisSecrets = z.infer<typeof secretsSchema>;

export const redisCapability: Capability<
  RedisInput,
  RedisOutput,
  RedisConfig,
  RedisSecrets
> = {
  metadata: {
    id: 'golden.connectors.redis',
    domain: 'connectors',
    version: '1.0.0',
    name: 'redis',
    description:
      'Redis connector for cache operations, pub/sub messaging, and data structures. Supports strings, hashes, lists, sets, and pub/sub.',
    tags: ['commander', 'connectors', 'redis', 'cache', 'pubsub'],
    maintainer: 'platform',
  },
  schemas: {
    input: inputSchema,
    output: outputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['redis:write'],
    dataClassification: 'INTERNAL',
    networkAccess: {
      allowOutbound: [
        // Redis connections are typically internal
        '*.redis.cache.windows.net',
        '*.cache.amazonaws.com',
        '*.redis.cloud',
      ],
    },
  },
  operations: {
    isIdempotent: false, // Depends on operation
    retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 1, backoffCoefficient: 2 },
    errorMap: (error: unknown) => {
      if (error instanceof Error) {
        if (error.message.includes('connection')) return 'RETRYABLE';
        if (error.message.includes('timeout')) return 'RETRYABLE';
        if (error.message.includes('READONLY')) return 'RETRYABLE';
        if (error.message.includes('NOAUTH')) return 'FATAL';
      }
      return 'FATAL';
    },
    costFactor: 'LOW',
  },
  aiHints: {
    exampleInput: {
      operation: 'set',
      key: 'workflow:abc123:status',
      value: 'running',
      ttlSeconds: 3600,
    },
    exampleOutput: {
      success: true,
      operation: 'set',
      key: 'workflow:abc123:status',
      message: 'Key set successfully with TTL 3600s',
    },
    usageNotes:
      'Use for caching workflow state, rate limiting, and pub/sub messaging between services. Set TTL for cache entries to prevent memory bloat.',
  },
  factory: (
    dag,
    context: CapabilityContext<RedisConfig, RedisSecrets>,
    input: RedisInput
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

    const host = context.config.host ?? 'localhost';
    const port = context.config.port ?? 6379;
    const database = context.config.database ?? 0;
    const keyPrefix = context.config.keyPrefix ?? '';

    const payload = {
      operation: input.operation,
      key: input.key ? `${keyPrefix}${input.key}` : undefined,
      keys: input.keys?.map(k => `${keyPrefix}${k}`),
      value: input.value,
      field: input.field,
      fields: input.fields,
      values: input.values,
      ttlSeconds: input.ttlSeconds,
      start: input.start,
      stop: input.stop,
      pattern: input.pattern ? `${keyPrefix}${input.pattern}` : undefined,
      channel: input.channel,
      message: input.message,
    };

    let container = d
      .container()
      .from('redis:7-alpine')
      .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
      .withEnvVariable('OPERATION', input.operation)
      .withEnvVariable('REDIS_HOST', host)
      .withEnvVariable('REDIS_PORT', String(port))
      .withEnvVariable('REDIS_DB', String(database));

    if (context.secretRefs.password) {
      container = container.withMountedSecret(
        '/run/secrets/redis_password',
        context.secretRefs.password as unknown as DaggerSecret
      );
    }

    return container.withExec([
      'sh',
      '-c',
      `
#!/bin/sh
set -e

OPERATION="${input.operation}"
KEY="${payload.key ?? ''}"
REDIS_HOST="${host}"
REDIS_PORT="${port}"
REDIS_DB="${database}"

# Build redis-cli command
REDIS_CLI="redis-cli -h $REDIS_HOST -p $REDIS_PORT -n $REDIS_DB"

if [ -f /run/secrets/redis_password ]; then
  REDIS_PASSWORD=$(cat /run/secrets/redis_password)
  REDIS_CLI="$REDIS_CLI -a $REDIS_PASSWORD --no-auth-warning"
fi

SUCCESS=true
MESSAGE=""
VALUE=""
VALUES="[]"
HASH="{}"
EXISTS=""
TTL=""
COUNT=""
KEYS="[]"

case "$OPERATION" in
  get)
    VALUE=$($REDIS_CLI GET "$KEY" 2>/dev/null || echo "")
    MESSAGE="Retrieved value for key $KEY"
    ;;
    
  set)
    VAL='${typeof input.value === 'object' ? JSON.stringify(input.value) : String(input.value ?? '')}'
    if [ -n "${input.ttlSeconds ?? ''}" ]; then
      $REDIS_CLI SET "$KEY" "$VAL" EX ${input.ttlSeconds ?? 0} >/dev/null
      MESSAGE="Key set successfully with TTL ${input.ttlSeconds ?? 0}s"
    else
      $REDIS_CLI SET "$KEY" "$VAL" >/dev/null
      MESSAGE="Key set successfully"
    fi
    ;;
    
  delete)
    if [ -n "${input.keys ? input.keys.join(' ') : ''}" ]; then
      COUNT=$($REDIS_CLI DEL ${input.keys?.map(k => `"${keyPrefix}${k}"`).join(' ') ?? ''} 2>/dev/null || echo "0")
    else
      COUNT=$($REDIS_CLI DEL "$KEY" 2>/dev/null || echo "0")
    fi
    MESSAGE="Deleted $COUNT key(s)"
    ;;
    
  exists)
    RESULT=$($REDIS_CLI EXISTS "$KEY" 2>/dev/null || echo "0")
    if [ "$RESULT" = "1" ]; then
      EXISTS=true
    else
      EXISTS=false
    fi
    MESSAGE="Key exists: $EXISTS"
    ;;
    
  expire)
    $REDIS_CLI EXPIRE "$KEY" ${input.ttlSeconds ?? 60} >/dev/null
    MESSAGE="Set expiration to ${input.ttlSeconds ?? 60}s"
    ;;
    
  ttl)
    TTL=$($REDIS_CLI TTL "$KEY" 2>/dev/null || echo "-1")
    MESSAGE="TTL for key: $TTL seconds"
    ;;
    
  incr)
    VALUE=$($REDIS_CLI INCR "$KEY" 2>/dev/null || echo "0")
    MESSAGE="Incremented to $VALUE"
    ;;
    
  decr)
    VALUE=$($REDIS_CLI DECR "$KEY" 2>/dev/null || echo "0")
    MESSAGE="Decremented to $VALUE"
    ;;
    
  hget)
    VALUE=$($REDIS_CLI HGET "$KEY" "${input.field ?? ''}" 2>/dev/null || echo "")
    MESSAGE="Retrieved hash field"
    ;;
    
  hset)
    FIELDS='${JSON.stringify(input.fields ?? {})}'
    for field in $(echo "$FIELDS" | jq -r 'keys[]' 2>/dev/null); do
      val=$(echo "$FIELDS" | jq -r ".[\\\"$field\\\"]")
      $REDIS_CLI HSET "$KEY" "$field" "$val" >/dev/null
    done
    MESSAGE="Set hash fields"
    ;;
    
  hgetall)
    HASH=$($REDIS_CLI HGETALL "$KEY" 2>/dev/null | awk 'NR%2{key=$0;next}{print key": "$0}' | jq -Rs 'split("\n") | map(select(length > 0)) | map(split(": ") | {(.[0]): .[1]}) | add // {}')
    MESSAGE="Retrieved all hash fields"
    ;;
    
  lpush|rpush)
    CMD=$(echo "$OPERATION" | tr '[:lower:]' '[:upper:]')
    for val in ${input.values?.map(v => `"${v}"`).join(' ') ?? ''}; do
      $REDIS_CLI $CMD "$KEY" "$val" >/dev/null
    done
    MESSAGE="Pushed to list"
    ;;
    
  lpop)
    VALUE=$($REDIS_CLI LPOP "$KEY" 2>/dev/null || echo "")
    MESSAGE="Popped from list"
    ;;
    
  lrange)
    VALUES=$($REDIS_CLI LRANGE "$KEY" ${input.start ?? 0} ${input.stop ?? -1} 2>/dev/null | jq -Rs 'split("\n") | map(select(length > 0))')
    MESSAGE="Retrieved list range"
    ;;
    
  sadd)
    for val in ${input.values?.map(v => `"${v}"`).join(' ') ?? ''}; do
      $REDIS_CLI SADD "$KEY" "$val" >/dev/null
    done
    MESSAGE="Added to set"
    ;;
    
  smembers)
    VALUES=$($REDIS_CLI SMEMBERS "$KEY" 2>/dev/null | jq -Rs 'split("\n") | map(select(length > 0))')
    MESSAGE="Retrieved set members"
    ;;
    
  publish)
    COUNT=$($REDIS_CLI PUBLISH "${input.channel ?? ''}" "${input.message ?? ''}" 2>/dev/null || echo "0")
    MESSAGE="Published to $COUNT subscribers"
    ;;
    
  keys)
    KEYS=$($REDIS_CLI KEYS "${payload.pattern ?? '*'}" 2>/dev/null | jq -Rs 'split("\n") | map(select(length > 0))')
    MESSAGE="Found matching keys"
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
  "key": "$KEY",
  "value": $(echo "$VALUE" | jq -Rs . 2>/dev/null || echo "null"),
  "values": $VALUES,
  "hash": $HASH,
  "exists": \${EXISTS:-null},
  "ttl": \${TTL:-null},
  "count": \${COUNT:-null},
  "keys": $KEYS,
  "message": "$MESSAGE"
}
EOF
    `.trim(),
    ]);
  },
};
