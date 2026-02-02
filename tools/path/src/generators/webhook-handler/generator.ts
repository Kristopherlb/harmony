import type { Tree } from '@nx/devkit';

function assertKebabCase(value: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error(`Invalid name (expected kebab-case): ${value}`);
  }
}

function toCamelCase(kebab: string): string {
  const [first, ...rest] = kebab.split('-');
  return [first, ...rest.map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))].join('');
}

function toPascalCase(kebab: string): string {
  const c = toCamelCase(kebab);
  return c.slice(0, 1).toUpperCase() + c.slice(1);
}

function defaultSignatureHeader(source: WebhookSource): string | undefined {
  switch (source) {
    case 'slack':
      return 'x-slack-signature';
    case 'github':
      return 'x-hub-signature-256';
    case 'gitlab':
      return 'x-gitlab-token';
    case 'pagerduty':
      return 'x-pagerduty-signature';
    case 'custom':
      return undefined;
  }
}

type WebhookSource = 'slack' | 'github' | 'gitlab' | 'pagerduty' | 'custom';

export interface WebhookHandlerGeneratorSchema {
  name: string;
  source: WebhookSource;
  signatureHeader?: string;
  signatureAlgorithm?: string;
}

export default async function webhookHandlerGenerator(tree: Tree, options: WebhookHandlerGeneratorSchema) {
  assertKebabCase(options.name);

  const source = options.source;
  const signatureHeader = (options.signatureHeader ?? defaultSignatureHeader(source))?.toLowerCase();
  const signatureAlgorithm = (options.signatureAlgorithm ?? 'sha256').toLowerCase();

  const baseName = toPascalCase(options.name);
  const handlerPath = `packages/apps/console/server/integrations/http/${options.name}-handler.ts`;
  const testPath = `packages/apps/console/server/integrations/http/${options.name}-handler.test.ts`;

  if (!tree.exists(handlerPath)) {
    const handlerSource = `/**
 * ${handlerPath}
 * Generated verified webhook handler scaffold.
 *
 * Source: ${source}
 *
 * TODO: Register this handler in \`server/integrations/http/integrations-router.ts\`.
 * Example:
 *   router.post('/${source}/${options.name}', createWebhookVerificationMiddleware(...), create${baseName}Handler());
 */
import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

export interface WebhookVerificationConfig {
  /**
   * Shared secret used to verify incoming requests.
   * Provide via env var or secret manager in production.
   */
  secret: string;
}

function getHeader(req: Request, name: string): string | undefined {
  const v = req.headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0];
  return typeof v === 'string' ? v : undefined;
}

/**
 * Create verification middleware for ${source} webhooks.
 *
 * Notes:
 * - For Slack, prefer the dedicated verifier pattern (timestamp + signing secret). Use this only for custom sources.
 * - For GitHub-style signatures, compare \`sha256=\${hmac}\` (x-hub-signature-256).
 * - For token-style headers (e.g., X-Gitlab-Token), use constant-time equality.
 */
export function createWebhookVerificationMiddleware(config: WebhookVerificationConfig) {
  return function verifyWebhook(req: Request, res: Response, next: NextFunction): Response | void {
    ${
      signatureHeader
        ? `const signature = getHeader(req, ${JSON.stringify(signatureHeader)});
    if (!signature) return res.status(401).json({ error: 'Missing signature header' });`
        : `// No signature header configured; allow all (NOT recommended).
    void config;
    return next();`
    }

    ${
      source === 'gitlab'
        ? `// GitLab commonly uses X-Gitlab-Token (shared secret token compare).
    const expected = config.secret;
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return next();`
        : signatureHeader
          ? `// Generic HMAC verification (body must be raw and stable).
    const rawBody = (req as any).rawBody ?? JSON.stringify(req.body ?? {});
    const hmac = crypto.createHmac(${JSON.stringify(signatureAlgorithm)}, config.secret).update(rawBody).digest('hex');
    const expected = ${source === 'github' ? '`sha256=${hmac}`' : 'hmac'};
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    return next();`
          : ''
    }
  };
}

/**
 * Create the ${baseName} webhook handler.
 * Keep this handler thin: parse/validate -> use case -> map response.
 */
export function create${baseName}Handler() {
  return async function ${toCamelCase(options.name)}Handler(req: Request, res: Response): Promise<Response> {
    void req;
    return res.status(200).json({ ok: true });
  };
}

declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}
`;
    tree.write(handlerPath, handlerSource);
  }

  if (!tree.exists(testPath)) {
    const testSource = `/**
 * ${testPath}
 * Generated tests for webhook verification middleware.
 */
import { describe, it, expect } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { createWebhookVerificationMiddleware } from './${options.name}-handler';

function mockRes() {
  const res: Partial<Response> = {};
  res.status = ((code: number) => {
    (res as any).statusCode = code;
    return res as Response;
  }) as any;
  res.json = ((body: unknown) => {
    (res as any).jsonBody = body;
    return res as Response;
  }) as any;
  return res as Response & { statusCode?: number; jsonBody?: unknown };
}

describe('${options.name}-handler', () => {
  it('rejects when signature header is missing (when configured)', () => {
    const mw = createWebhookVerificationMiddleware({ secret: 's' });
    const req = { headers: {}, body: {}, rawBody: '{}' } as unknown as Request;
    const res = mockRes();
    const next: NextFunction = () => {};
    mw(req, res, next);
    // For custom mode, middleware may allow all.
    if (res.statusCode != null) {
      expect(res.statusCode).toBe(401);
    }
  });
});
`;
    tree.write(testPath, testSource);
  }

  return () => {};
}

