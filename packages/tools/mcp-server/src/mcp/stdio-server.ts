/**
 * packages/tools/mcp-server/src/mcp/stdio-server.ts
 * MCP stdio server (newline-delimited JSON-RPC).
 *
 * Spec notes:
 * - Messages MUST be delimited by newlines and MUST NOT contain embedded newlines.
 * - Server MUST NOT write non-MCP data to stdout. Use stderr for logs.
 */
import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { Connection, Client } from '@temporalio/client';
import { createBlueprintRegistry } from '@golden/blueprints';
import { GOLDEN_CONTEXT_MEMO_KEY, SECURITY_CONTEXT_MEMO_KEY } from '@golden/core/workflow';
import type { ToolManifest } from '../manifest/capabilities.js';
import { createToolSurface } from './tool-surface.js';
import { createMcpJsonRpcHandler, type JsonRpcRequest } from './jsonrpc-handler.js';
import { createTemporalDefaultRunners } from './temporal-default-runners.js';
import type { CapabilityRunner, BlueprintRunner } from './tool-surface.js';
import type { GoldenCallerContext } from './call-envelope.js';

export interface StdioServerOptions {
  manifest: ToolManifest;
  traceId?: () => string;
  stdin?: Readable;
  stdout?: Writable;
  capabilityRunner?: CapabilityRunner;
  blueprintRunner?: BlueprintRunner;
  /**
   * If true (default), create Temporal-backed default runners from env vars
   * when explicit runners are not provided.
   */
  useEnvDefaults?: boolean;
}

function writeJsonLine(stdout: Writable, obj: unknown): void {
  // Do not pretty-print: avoid embedded newlines.
  stdout.write(JSON.stringify(obj) + '\n');
}

function readEnv(name: string, fallback: string): string {
  const v = process.env[name];
  if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  return fallback;
}

function readCapabilityBehavior(): 'await' | 'start' {
  const v = (process.env.MCP_CAPABILITY_BEHAVIOR ?? 'await').trim().toLowerCase();
  return v === 'start' ? 'start' : 'await';
}

function readCsvEnv(name: string): string[] {
  const raw = process.env[name];
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function readBoolEnv(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (typeof v !== 'string' || v.trim().length === 0) return fallback;
  return v.trim().toLowerCase() === 'true';
}

export async function runMcpStdioServer(options: StdioServerOptions): Promise<void> {
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;

  let capabilityRunner = options.capabilityRunner;
  let blueprintRunner = options.blueprintRunner;

  const useEnvDefaults = options.useEnvDefaults ?? true;
  if (useEnvDefaults && (!capabilityRunner || !blueprintRunner)) {
    const taskQueue = readEnv('TEMPORAL_TASK_QUEUE', 'golden-tools');
    const address = readEnv('TEMPORAL_ADDRESS', 'localhost:7233');
    const namespace = readEnv('TEMPORAL_NAMESPACE', 'default');
    const temporalUiUrl = readEnv('TEMPORAL_UI_URL', 'http://localhost:8233');

    let _client: Client | undefined;
    const getClient = async (): Promise<Client> => {
      if (_client) return _client;
      const connection = await Connection.connect({ address });
      _client = new Client({ connection, namespace });
      return _client;
    };

    const blueprintRegistry = createBlueprintRegistry();
    const minimalBlueprints = new Map<string, { blueprintId: string; workflowType: string }>();
    for (const [id, entry] of blueprintRegistry.entries()) {
      minimalBlueprints.set(id, { blueprintId: entry.blueprintId, workflowType: entry.workflowType });
    }

    const initiatorId = readEnv('MCP_INITIATOR_ID', 'mcp:anonymous');
    const roles = readCsvEnv('MCP_ROLES');
    const tokenRef = readEnv('MCP_TOKEN_REF', '');
    const appId = readEnv('MCP_APP_ID', 'golden-mcp-server');
    const environment = readEnv('MCP_ENVIRONMENT', 'local');
    const costCenter = process.env.MCP_COST_CENTER?.trim() || undefined;
    const dataClassification = process.env.MCP_DATA_CLASSIFICATION?.trim() || undefined;

    const { capabilityRunner: cap, blueprintRunner: bp } = createTemporalDefaultRunners({
      temporal: {
        taskQueue,
        client: {
          workflow: {
            start: async (workflowType, startOptions) => {
              const client = await getClient();
              const handle = await (client as any).workflow.start(workflowType, startOptions);
              // Standardize handle shape for downstream logic.
              return {
                workflowId: handle.workflowId,
                firstExecutionRunId: handle.firstExecutionRunId,
                result: handle.result?.bind(handle),
              };
            },
          },
        },
      },
      blueprints: minimalBlueprints,
      workflowIdFactory: (toolId) => `${toolId}-${randomUUID()}`,
      capabilityBehavior: readCapabilityBehavior(),
      statusUrlFactory: (workflowId, runId) =>
        `${temporalUiUrl.replace(/\/+$/, '')}/namespaces/${encodeURIComponent(namespace)}/workflows/${encodeURIComponent(
          workflowId
        )}/${encodeURIComponent(runId)}`,
      memoFactory: ({ traceId, context }) => {
        const ctx = context as GoldenCallerContext | undefined;
        const effInitiatorId = ctx?.initiatorId ?? initiatorId;
        const effRoles = ctx?.roles ?? roles;
        const effTokenRef = ctx?.tokenRef ?? tokenRef;
        const effAppId = ctx?.appId ?? appId;
        const effEnv = ctx?.environment ?? environment;
        const effCost = ctx?.costCenter ?? costCenter;
        const effClass = ctx?.dataClassification ?? (dataClassification as any);
        return {
          [SECURITY_CONTEXT_MEMO_KEY]: { initiatorId: effInitiatorId, roles: effRoles, tokenRef: effTokenRef, traceId },
          [GOLDEN_CONTEXT_MEMO_KEY]: {
            app_id: effAppId,
            environment: effEnv,
            initiator_id: effInitiatorId,
            trace_id: traceId,
            cost_center: effCost,
            data_classification: effClass,
          },
        };
      },
    });

    capabilityRunner ??= cap;
    blueprintRunner ??= bp;
  }

  const toolSurface = createToolSurface({
    manifest: options.manifest,
    traceId: options.traceId,
    capabilityRunner,
    blueprintRunner,
    envelope: (() => {
      const secret = process.env.MCP_ENVELOPE_HMAC_SECRET?.trim();
      const require = readBoolEnv('MCP_REQUIRE_ENVELOPE', false);
      if (require && !secret) {
        throw new Error('MCP_REQUIRE_ENVELOPE=true but MCP_ENVELOPE_HMAC_SECRET is not set');
      }
      if (!secret) return undefined;
      return { hmacSecret: secret, require };
    })(),
  });
  const handle = createMcpJsonRpcHandler({ toolSurface });

  const rl = createInterface({ input: stdin, crlfDelay: Infinity });

  for await (const line of rl) {
    const trimmed = String(line).trim();
    if (!trimmed) continue;
    let msg: JsonRpcRequest;
    try {
      msg = JSON.parse(trimmed) as JsonRpcRequest;
    } catch (e) {
      // Protocol error: invalid JSON.
      writeJsonLine(stdout, {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      });
      console.error('Invalid JSON-RPC input line (Parse error).', e);
      continue;
    }

    try {
      const res = await handle(msg);
      if (res) writeJsonLine(stdout, res);
    } catch (e) {
      // Internal error.
      const id = (msg as any).id ?? null;
      writeJsonLine(stdout, {
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: 'Internal error' },
      });
      console.error('Unhandled MCP server error.', e);
    }
  }
}

