/**
 * packages/packages/capabilities/src/auth/openbao.capability.ts
 * OpenBao Capability - Secret management via Vault/OpenBao API.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum(['read', 'write', 'list', 'delete']).describe('OpenBao operation');

const inputSchema = z.object({
    operation: operationSchema,
    path: z.string().describe('Secret path (e.g., secret/data/myapp/config)'),
    engine: z.string().optional().describe('Vault secret engine (default: kv)'),
    mountPoint: z.string().optional().describe('Mount point (default: secret)'),
    data: z.record(z.unknown()).optional().describe('Data to write (for write/create)'),
})
    .describe('OpenBao/Vault input');

const outputSchema = z
    .object({
        success: z.boolean().describe('Whether the operation succeeded'),
        message: z.string().describe('Result message or error description'),
        data: z.record(z.unknown()).optional().describe('Read data'),
        metadata: z.record(z.unknown()).optional().describe('Secret metadata'),
    })
    .describe('OpenBao/Vault output');

const configSchema = z.object({
    address: z.string().optional().describe('Vault/OpenBao address'),
    namespace: z.string().optional().describe('Vault namespace'),
}).describe('OpenBao configuration');

const secretsSchema = z.object({
    token: z.string().optional().describe('Vault token'),
}).describe('OpenBao secrets');

export type OpenBaoInput = z.infer<typeof inputSchema>;
export type OpenBaoOutput = z.infer<typeof outputSchema>;
export type OpenBaoConfig = z.infer<typeof configSchema>;
export type OpenBaoSecrets = z.infer<typeof secretsSchema>;

export const openbaoCapability: Capability<
    OpenBaoInput,
    OpenBaoOutput,
    OpenBaoConfig,
    OpenBaoSecrets
> = {
    metadata: {
        id: 'golden.auth.openbao',
        version: '1.0.0',
        name: 'openbao',
        description:
            'Manage secrets using OpenBao (Vault). Read, write, list, and delete secrets from KV engines.',
        tags: ['auth', 'secrets', 'vault', 'openbao', 'hashicorp'],
        maintainer: 'platform',
    },
    schemas: {
        input: inputSchema,
        output: outputSchema,
        config: configSchema,
        secrets: secretsSchema,
    },
    security: {
        requiredScopes: ['secrets:read', 'secrets:write'], // dependent on op
        dataClassification: 'CONFIDENTIAL',
        networkAccess: {
            allowOutbound: ['*'], // Vault address is variable
        },
    },
    operations: {
        isIdempotent: false,
        retryPolicy: { maxAttempts: 3, initialIntervalSeconds: 1, backoffCoefficient: 2 },
        errorMap: (err) => {
            if (err instanceof Error && err.message.includes('connection refused')) return 'RETRYABLE';
            return 'FATAL';
        },
        costFactor: 'LOW',
    },
    aiHints: {
        exampleInput: {
            operation: 'read',
            path: 'myapp/config',
        },
        exampleOutput: {
            success: true,
            data: { apiKey: '***' },
            message: 'Secret read successfully',
        },
        usageNotes: 'Uses hashicorp/vault container. Requires VAULT_ADDR and VAULT_TOKEN.',
    },
    factory: (dag, context, input) => {
        const d = dag as any;

        const address = context.config.address ?? process.env.VAULT_ADDR ?? 'http://localhost:8200';
        const namespace = context.config.namespace;

        let ctr = d.container().from('hashicorp/vault:latest');

        // Env vars
        ctr = ctr.withEnvVariable('VAULT_ADDR', address);
        if (namespace) {
            ctr = ctr.withEnvVariable('VAULT_NAMESPACE', namespace);
        }

        // Mount token
        if (context.secretRefs.token) {
            ctr = ctr.withMountedSecret('/run/secrets/vault_token', context.secretRefs.token as any);
            // We'll read this file in the script
        } else if (process.env.VAULT_TOKEN) {
            ctr = ctr.withEnvVariable('VAULT_TOKEN', process.env.VAULT_TOKEN);
        }

        return ctr.withExec([
            'sh',
            '-c',
            `
      #!/bin/sh
      set -e

      # Load token if mounted
      if [ -f /run/secrets/vault_token ]; then
        export VAULT_TOKEN=$(cat /run/secrets/vault_token)
      fi

      OP="${input.operation}"
      ENGINE="${input.engine ?? 'kv'}"
      MOUNT="${input.mountPoint ?? 'secret'}"
      PATH_ARG="${input.path}"
      FULL_PATH="\${MOUNT}/\${PATH_ARG}"

      SUCCESS=true
      MESSAGE=""
      DATA="{}"
      METADATA="{}"

      case "$OP" in
        read)
          if OUTPUT=$(vault kv get -format=json "$FULL_PATH" 2>&1); then
             DATA=$(echo "$OUTPUT" | jq '.data.data // .data')
             METADATA=$(echo "$OUTPUT" | jq '.data.metadata // .metadata // {}')
             MESSAGE="Secret read successfully"
          else
             SUCCESS=false
             MESSAGE="Failed to read secret: $OUTPUT"
          fi
          ;;
        write)
          # input.data is passed via env var/file to avoid CLI arg limits
          echo '${JSON.stringify(input.data ?? {})}' > /tmp/data.json
          if OUTPUT=$(vault kv put -format=json "$FULL_PATH" @/tmp/data.json 2>&1); then
             DATA=$(echo "$OUTPUT" | jq '.data.data // .data // {}')
             METADATA=$(echo "$OUTPUT" | jq '.data.metadata // .metadata // {}')
             MESSAGE="Secret written successfully"
          else
             SUCCESS=false
             MESSAGE="Failed to write secret: $OUTPUT"
          fi
          ;;
        list)
          if OUTPUT=$(vault kv list -format=json "$FULL_PATH" 2>&1); then
             KEYS=$(echo "$OUTPUT" | jq -c .)
             DATA="{\\"keys\\": $KEYS}"
             MESSAGE="Secrets listed successfully"
          else
             SUCCESS=false
             MESSAGE="Failed to list secrets: $OUTPUT"
          fi
          ;;
        delete)
          if OUTPUT=$(vault kv delete -format=json "$FULL_PATH" 2>&1); then
             MESSAGE="Secret deleted successfully"
          else
             SUCCESS=false
             MESSAGE="Failed to delete secret: $OUTPUT"
          fi
          ;;
        *)
          SUCCESS=false
          MESSAGE="Unknown operation: $OP"
          ;;
      esac

      # Construct JSON output
      cat <<EOF
      {
        "success": $SUCCESS,
        "data": \${DATA:-{}},
        "metadata": \${METADATA:-{}},
        "message": "$(echo "$MESSAGE" | sed 's/"/\\\\"/g')"
      }
EOF
            `
        ]);
    },
};
