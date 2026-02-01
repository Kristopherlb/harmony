/**
 * packages/tools/mcp-server/src/demo/stdio-jsonrpc-client.ts
 * Minimal newline-delimited JSON-RPC client over stdio.
 *
 * Intended for local demos and lightweight integration tests.
 */
import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';

type JsonRpcId = number;

type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: JsonRpcId | null; result: unknown }
  | { jsonrpc: '2.0'; id: JsonRpcId | null; error: { code: number; message: string; data?: unknown } };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function parseResponse(line: string): JsonRpcResponse | undefined {
  const trimmed = line.trim();
  if (!trimmed) return undefined;
  const msg = JSON.parse(trimmed) as unknown;
  if (!isObject(msg)) return undefined;
  if (msg.jsonrpc !== '2.0') return undefined;
  if (!('id' in msg)) return undefined;
  const id = (msg as any).id as unknown;
  if (id !== null && typeof id !== 'number') return undefined;
  if ('result' in msg) return msg as JsonRpcResponse;
  if ('error' in msg) return msg as JsonRpcResponse;
  return undefined;
}

function writeJsonLine(stdout: Writable, obj: unknown): void {
  // Protocol: newline-delimited JSON; never pretty-print.
  stdout.write(JSON.stringify(obj) + '\n');
}

export function createStdioJsonRpcClient(input: { stdin: Writable; stdout: Readable }) {
  let nextId = 1;
  const pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (err: Error) => void;
    }
  >();

  const rl = createInterface({ input: input.stdout, crlfDelay: Infinity });
  rl.on('line', (line) => {
    let parsed: JsonRpcResponse | undefined;
    try {
      parsed = parseResponse(line);
    } catch {
      // Ignore malformed lines; demo client is best-effort.
      return;
    }
    if (!parsed) return;
    if (parsed.id === null) return;

    const waiter = pending.get(parsed.id);
    if (!waiter) return;
    pending.delete(parsed.id);

    if ('error' in parsed) {
      const e = new Error(`JSON_RPC_ERROR ${parsed.error.code}: ${parsed.error.message}`);
      (e as any).data = parsed.error.data;
      waiter.reject(e);
      return;
    }
    waiter.resolve(parsed.result);
  });

  return {
    request(method: string, params?: unknown): Promise<unknown> {
      const id = nextId++;
      const msg = {
        jsonrpc: '2.0' as const,
        id,
        method,
        params: params ?? {},
      };
      const p = new Promise<unknown>((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
      writeJsonLine(input.stdin, msg);
      return p;
    },
    close(): void {
      rl.close();
      for (const [id, waiter] of pending.entries()) {
        pending.delete(id);
        waiter.reject(new Error(`JSON_RPC_CLIENT_CLOSED (id=${id})`));
      }
    },
  };
}

