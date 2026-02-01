/**
 * packages/tools/mcp-server/src/mcp/jsonrpc-handler.ts
 * Minimal MCP JSON-RPC request handler (stdio-friendly).
 *
 * Implements:
 * - initialize
 * - tools/list
 * - tools/call
 *
 * Notes:
 * - stdio transport is newline-delimited JSON (no embedded newlines).
 * - Keep server behavior deterministic and side-effect free in MVP.
 */
import type { ToolSurface } from './tool-surface.js';
import type { SignedGoldenCallEnvelope } from './call-envelope.js';

type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccessResponse {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: JsonRpcId;
  error: { code: number; message: string; data?: unknown };
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function getParam<T>(params: unknown, key: string): T | undefined {
  if (!isObject(params)) return undefined;
  return params[key] as T | undefined;
}

function getSignedEnvelope(meta: unknown): SignedGoldenCallEnvelope | undefined {
  if (!isObject(meta)) return undefined;
  const golden = meta.golden;
  if (!golden) return undefined;
  // Envelope is validated cryptographically at the tool-surface boundary.
  return golden as SignedGoldenCallEnvelope;
}

function ok(id: JsonRpcId, result: unknown): JsonRpcSuccessResponse {
  return { jsonrpc: '2.0', id, result };
}

function err(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcErrorResponse {
  return { jsonrpc: '2.0', id, error: { code, message, data } };
}

export function createMcpJsonRpcHandler(input: {
  toolSurface: ToolSurface;
  serverInfo?: { name: string; version: string };
  manifestInfo?: { version: string; generated_at: string };
}) {
  return async function handle(req: JsonRpcRequest): Promise<JsonRpcResponse | undefined> {
    const id: JsonRpcId = req.id ?? null;

    // Notifications have no id; we ignore (best-effort).
    const isNotification = req.id === undefined;

    if (req.method === 'notifications/initialized') {
      return undefined;
    }

    if (req.method === 'initialize') {
      if (isNotification) return undefined;
      const protocolVersion = getParam<string>(req.params, 'protocolVersion') ?? '2025-11-25';
      const serverInfo = input.serverInfo ?? { name: 'golden-mcp-server', version: '1.0.0' };
      return ok(id, {
        protocolVersion,
        capabilities: {
          tools: { listChanged: false },
        },
        serverInfo: {
          name: serverInfo.name,
          title: 'Golden MCP Server',
          version: serverInfo.version,
          description: 'Manifest-backed MCP server for Golden Path tools.',
        },
        manifest: input.manifestInfo ?? undefined,
      });
    }

    if (req.method === 'tools/list') {
      if (isNotification) return undefined;
      const tools = input.toolSurface.listTools().map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      return ok(id, { tools, manifest: input.manifestInfo ?? undefined });
    }

    if (req.method === 'tools/call') {
      if (isNotification) return undefined;
      const name = getParam<string>(req.params, 'name');
      const args = getParam<unknown>(req.params, 'arguments');
      const meta = getParam<unknown>(req.params, 'meta');
      if (!name) return err(id, -32602, 'Invalid params: missing name');
      const golden = getSignedEnvelope(meta);
      const result = await input.toolSurface.callTool({
        name,
        arguments: args,
        meta: golden ? { golden } : undefined,
      });
      return ok(id, result);
    }

    if (req.method === 'ping') {
      if (isNotification) return undefined;
      return ok(id, {});
    }

    if (isNotification) return undefined;
    return err(id, -32601, `Method not found: ${req.method}`);
  };
}

