/**
 * packages/capabilities/src/connectors/github-runtime.test.ts
 * TCS-001: deterministic runtime tests for GitHub HTTP runtime script.
 */
import { describe, it, expect } from 'vitest';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GITHUB_HTTP_RUNTIME_CJS } from './github-runtime';

async function runRuntime(opts: {
  input: unknown;
  secretsDir: string;
}): { stdout: string; stderr: string; exitCode: number } {
  const dir = mkdtempSync(join(tmpdir(), 'github-runtime-'));
  const file = join(dir, 'runtime.cjs');
  writeFileSync(file, GITHUB_HTTP_RUNTIME_CJS, 'utf8');

  const child = spawn(process.execPath, [file], {
    env: {
      ...process.env,
      INPUT_JSON: JSON.stringify(opts.input),
      SECRETS_DIR: opts.secretsDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout?.on('data', (c) => stdoutChunks.push(Buffer.from(c)));
  child.stderr?.on('data', (c) => stderrChunks.push(Buffer.from(c)));

  const exitCode = await new Promise<number>((resolve) => {
    const softTimeoutMs = 10_000;
    const hardTimeoutMs = 12_000;

    const soft = setTimeout(() => {
      child.kill('SIGKILL');
    }, softTimeoutMs);
    const hard = setTimeout(() => {
      resolve(1);
    }, hardTimeoutMs);

    child.on('exit', (code) => {
      clearTimeout(soft);
      clearTimeout(hard);
      resolve(typeof code === 'number' ? code : 1);
    });
  });

  return {
    stdout: Buffer.concat(stdoutChunks).toString('utf8'),
    stderr: Buffer.concat(stderrChunks).toString('utf8'),
    exitCode,
  };
}

async function startServer(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Failed to bind');
  return { server, baseUrl: `http://127.0.0.1:${addr.port}` };
}

describe('GITHUB_HTTP_RUNTIME_CJS', () => {
  it('performs REST GET with query params and Bearer auth', async () => {
    const requests: Array<{ url: string; method: string; auth: string | undefined }> = [];
    const { server, baseUrl } = await startServer((req, res) => {
      requests.push({
        url: String(req.url ?? ''),
        method: String(req.method ?? ''),
        auth: typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined,
      });
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
    });

    const secretsDir = mkdtempSync(join(tmpdir(), 'github-secrets-'));
    mkdirSync(secretsDir, { recursive: true });
    writeFileSync(join(secretsDir, 'github_token'), 'tok_123\n', 'utf8');

    try {
      const res = await runRuntime({
        input: {
          mode: 'rest',
          baseUrl,
          allowOutbound: [new URL(baseUrl).host],
          method: 'GET',
          path: '/repos/octocat/hello-world',
          query: { per_page: 1 },
        },
        secretsDir,
      });

      if (res.exitCode !== 0) {
        throw new Error(
          `runtime failed: exit=${res.exitCode}\nstderr:\n${res.stderr}\nstdout:\n${res.stdout}`
        );
      }
      expect(requests.length).toBe(1);
      expect(requests[0]!.url).toContain('/repos/octocat/hello-world');
      expect(requests[0]!.url).toContain('per_page=1');
      expect(requests[0]!.method).toBe('GET');
      expect(requests[0]!.auth).toBe('Bearer tok_123');
      expect(res.stdout).toContain('"status":200');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('performs GraphQL POST to /graphql with Bearer auth', async () => {
    const requests: Array<{ url: string; method: string; auth: string | undefined; body: string }> = [];
    const { server, baseUrl } = await startServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(Buffer.from(c as any));
      const body = Buffer.concat(chunks).toString('utf8');

      requests.push({
        url: String(req.url ?? ''),
        method: String(req.method ?? ''),
        auth: typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined,
        body,
      });
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ data: { viewer: { login: 'x' } } }));
    });

    const secretsDir = mkdtempSync(join(tmpdir(), 'github-secrets-'));
    mkdirSync(secretsDir, { recursive: true });
    writeFileSync(join(secretsDir, 'github_token'), 'tok_abc', 'utf8');

    try {
      const res = await runRuntime({
        input: {
          mode: 'graphql',
          baseUrl,
          allowOutbound: [new URL(baseUrl).host],
          query: 'query { viewer { login } }',
          variables: { x: 1 },
        },
        secretsDir,
      });

      if (res.exitCode !== 0) {
        throw new Error(
          `runtime failed: exit=${res.exitCode}\nstderr:\n${res.stderr}\nstdout:\n${res.stdout}`
        );
      }
      expect(requests.length).toBe(1);
      expect(requests[0]!.url).toBe('/graphql');
      expect(requests[0]!.method).toBe('POST');
      expect(requests[0]!.auth).toBe('Bearer tok_abc');
      expect(JSON.parse(requests[0]!.body)).toMatchObject({
        query: 'query { viewer { login } }',
        variables: { x: 1 },
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('fails closed when host is not allowlisted (no outbound attempt)', async () => {
    let hits = 0;
    const { server, baseUrl } = await startServer((_req, res) => {
      hits++;
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
    });

    const secretsDir = mkdtempSync(join(tmpdir(), 'github-secrets-'));
    mkdirSync(secretsDir, { recursive: true });
    writeFileSync(join(secretsDir, 'github_token'), 'tok_123\n', 'utf8');

    try {
      const res = await runRuntime({
        input: {
          mode: 'rest',
          baseUrl,
          allowOutbound: ['api.github.com'], // does NOT include our server host
          method: 'GET',
          path: '/repos/x/y',
        },
        secretsDir,
      });

      expect(hits).toBe(0);
      expect(res.exitCode).not.toBe(0);
      expect(res.stderr).toMatch(/OUTBOUND_HOST_NOT_ALLOWED/i);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

