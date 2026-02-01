/**
 * packages/tools/mcp-server/src/mcp/tool-surface.ts
 * Minimal tool surface: tools/list + tools/call over a Tool Manifest.
 *
 * Notes:
 * - Validates tool inputs against manifest JSON Schema (2020-12).
 * - Always includes trace_id in structuredContent for correlation (AIP intent).
 * - For MVP, execution is stubbed except a deterministic demo for `golden.echo`.
 */
import Ajv2020 from 'ajv/dist/2020';
import type { ValidateFunction } from 'ajv';
import type { AnySchema } from 'ajv';
import type { ToolManifest } from '../manifest/capabilities.js';
import type { GoldenCallerContext, SignedGoldenCallEnvelope } from './call-envelope.js';
import { verifyGoldenCallEnvelope } from './call-envelope.js';

export interface McpTool {
  name: string;
  description: string;
  inputSchema: unknown;
}

export interface McpToolCallParams {
  name: string;
  arguments?: unknown;
  meta?: {
    golden?: SignedGoldenCallEnvelope;
  };
}

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: unknown;
  isError: boolean;
}

export interface ToolSurface {
  listTools(): McpTool[];
  callTool(params: McpToolCallParams): Promise<McpToolResult>;
}

export type CapabilityRunner = (input: {
  id: string;
  args: unknown;
  traceId: string;
  context?: GoldenCallerContext;
}) => Promise<{ result: unknown; meta?: unknown }>;

export type BlueprintRunner = (input: {
  id: string;
  args: unknown;
  traceId: string;
  context?: GoldenCallerContext;
}) => Promise<{ result: unknown; meta?: unknown }>;

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: 'UNSERIALIZABLE_RESULT' });
  }
}

type RunnerErrorLike = {
  message?: unknown;
  code?: unknown;
  meta?: unknown;
};

function classifyRunnerError(err: unknown): { code: string; details?: unknown } {
  const anyErr: RunnerErrorLike | undefined =
    err && typeof err === 'object' ? (err as RunnerErrorLike) : undefined;
  const msg = typeof anyErr?.message === 'string' ? anyErr.message : '';
  const code = typeof anyErr?.code === 'string' ? anyErr.code : '';

  // Temporal connectivity / transport failures (fail-fast; no silent fallback).
  if (
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    msg.toLowerCase().includes('connection refused') ||
    msg.toLowerCase().includes('connect error') ||
    msg.toLowerCase().includes('failed to connect') ||
    msg.toLowerCase().includes('transport error')
  ) {
    return {
      code: 'TEMPORAL_UNAVAILABLE',
      details: { message: msg || undefined, code: code || undefined },
    };
  }

  if (code === 'WORKER_NOT_RUNNING' || msg.includes('WORKER_NOT_RUNNING')) {
    return {
      code: 'WORKER_NOT_RUNNING',
      details: anyErr?.meta ? { meta: anyErr.meta } : { message: msg || undefined },
    };
  }

  return { code: 'RUNNER_ERROR', details: { message: msg || undefined, code: code || undefined } };
}

export function createToolSurface(input: {
  manifest: ToolManifest;
  traceId?: () => string;
  capabilityRunner?: CapabilityRunner;
  blueprintRunner?: BlueprintRunner;
  envelope?: { hmacSecret: string; require?: boolean };
}): ToolSurface {
  const traceId = input.traceId ?? (() => `trace-${Date.now()}`);
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateFormats: false,
  });

  const entryById = new Map<string, ToolManifest['tools'][number]>();
  for (const t of input.manifest.tools) entryById.set(t.id, t);

  const schemaByName = new Map<string, unknown>();
  const validateByName = new Map<string, ValidateFunction>();

  for (const t of input.manifest.tools) {
    schemaByName.set(t.id, t.json_schema);
  }

  function getValidator(name: string): ValidateFunction | undefined {
    const existing = validateByName.get(name);
    if (existing) return existing;
    const schema = schemaByName.get(name);
    if (!schema) return undefined;
    const v = ajv.compile(schema as AnySchema);
    validateByName.set(name, v);
    return v;
  }

  function listTools(): McpTool[] {
    return input.manifest.tools.map((t) => ({
      name: t.id,
      description: t.description,
      inputSchema: t.json_schema,
    }));
  }

  async function callTool(params: McpToolCallParams): Promise<McpToolResult> {
    let trace_id = traceId();
    let callerContext: GoldenCallerContext | undefined;
    if (input.envelope) {
      const requireEnvelope = input.envelope.require ?? false;
      if (!params.meta?.golden) {
        if (requireEnvelope) {
          const out = { error: 'UNAUTHORIZED', trace_id };
          return {
            isError: true,
            content: [{ type: 'text', text: safeJsonStringify(out) }],
            structuredContent: out,
          };
        }
      } else {
        const verified = verifyGoldenCallEnvelope(params.meta.golden, input.envelope.hmacSecret);
        if (!verified.ok) {
          const out = { error: 'UNAUTHORIZED', trace_id, details: verified.error };
          return {
            isError: true,
            content: [{ type: 'text', text: safeJsonStringify(out) }],
            structuredContent: out,
          };
        }
        callerContext = verified.context;
        if (typeof callerContext.traceId === 'string' && callerContext.traceId.trim().length > 0) {
          trace_id = callerContext.traceId.trim();
        }
      }
    }
    const validator = getValidator(params.name);
    if (!validator) {
      const out = { error: `Unknown tool: ${params.name}`, trace_id };
      return {
        isError: true,
        content: [{ type: 'text', text: safeJsonStringify(out) }],
        structuredContent: out,
      };
    }

    const args = params.arguments ?? {};
    const ok = validator(args);
    if (!ok) {
      const out = {
        error: 'INPUT_VALIDATION_FAILED',
        trace_id,
        details: validator.errors ?? [],
      };
      return {
        isError: true,
        content: [{ type: 'text', text: safeJsonStringify(out) }],
        structuredContent: out,
      };
    }

    const entry = entryById.get(params.name);
    if (!entry) {
      const out = { error: `Unknown tool: ${params.name}`, trace_id };
      return {
        isError: true,
        content: [{ type: 'text', text: safeJsonStringify(out) }],
        structuredContent: out,
      };
    }

    // ASS-style RESTRICTED preflight: require explicit approval before execution.
    if (entry.data_classification === 'RESTRICTED') {
      const out = {
        error: 'APPROVAL_REQUIRED',
        tool: params.name,
        trace_id,
        data_classification: entry.data_classification,
      };
      return {
        isError: true,
        content: [{ type: 'text', text: safeJsonStringify(out) }],
        structuredContent: out,
      };
    }

    // Default demo capability execution if no runner provided.
    if (entry.type === 'CAPABILITY') {
      const runner = input.capabilityRunner;
      if (!runner) {
        if (params.name === 'golden.echo') {
          const x = (args as { x: number }).x;
          const result = { y: x };
          const out = { result, trace_id };
          return {
            isError: false,
            content: [{ type: 'text', text: safeJsonStringify(out) }],
            structuredContent: out,
          };
        }
        const out = { error: 'NOT_CONFIGURED', tool: params.name, trace_id };
        return {
          isError: true,
          content: [{ type: 'text', text: safeJsonStringify(out) }],
          structuredContent: out,
        };
      }

      try {
        const runOut = await runner({ id: params.name, args, traceId: trace_id, context: callerContext });
        const out = runOut.meta
          ? { result: runOut.result, trace_id, meta: runOut.meta }
          : { result: runOut.result, trace_id };
        return {
          isError: false,
          content: [{ type: 'text', text: safeJsonStringify(out) }],
          structuredContent: out,
        };
      } catch (e) {
        const classified = classifyRunnerError(e);
        const out = {
          error: classified.code,
          tool: params.name,
          trace_id,
          details: classified.details,
          hint:
            classified.code === 'TEMPORAL_UNAVAILABLE'
              ? 'Start Temporal + worker: pnpm nx run harmony:dev-up && pnpm nx run harmony:dev-worker. Check TEMPORAL_ADDRESS, TEMPORAL_NAMESPACE, TEMPORAL_TASK_QUEUE.'
              : classified.code === 'WORKER_NOT_RUNNING'
                ? 'Start worker: pnpm nx run harmony:dev-worker'
                : undefined,
        };
        return {
          isError: true,
          content: [{ type: 'text', text: safeJsonStringify(out) }],
          structuredContent: out,
        };
      }
    }

    if (entry.type === 'BLUEPRINT') {
      const runner = input.blueprintRunner;
      if (!runner) {
        const out = { error: 'NOT_CONFIGURED', tool: params.name, trace_id };
        return {
          isError: true,
          content: [{ type: 'text', text: safeJsonStringify(out) }],
          structuredContent: out,
        };
      }
      try {
        const runOut = await runner({ id: params.name, args, traceId: trace_id, context: callerContext });
        const out = runOut.meta
          ? { result: runOut.result, trace_id, meta: runOut.meta }
          : { result: runOut.result, trace_id };
        return {
          isError: false,
          content: [{ type: 'text', text: safeJsonStringify(out) }],
          structuredContent: out,
        };
      } catch (e) {
        const classified = classifyRunnerError(e);
        const out = {
          error: classified.code,
          tool: params.name,
          trace_id,
          details: classified.details,
          hint:
            classified.code === 'TEMPORAL_UNAVAILABLE'
              ? 'Start Temporal + worker: pnpm nx run harmony:dev-up && pnpm nx run harmony:dev-worker. Check TEMPORAL_ADDRESS, TEMPORAL_NAMESPACE, TEMPORAL_TASK_QUEUE.'
              : classified.code === 'WORKER_NOT_RUNNING'
                ? 'Start worker: pnpm nx run harmony:dev-worker'
                : undefined,
        };
        return {
          isError: true,
          content: [{ type: 'text', text: safeJsonStringify(out) }],
          structuredContent: out,
        };
      }
    }

    const out = { error: 'NOT_IMPLEMENTED', tool: params.name, trace_id };
    return {
      isError: true,
      content: [{ type: 'text', text: safeJsonStringify(out) }],
      structuredContent: out,
    };
  }

  return { listTools, callTool };
}

