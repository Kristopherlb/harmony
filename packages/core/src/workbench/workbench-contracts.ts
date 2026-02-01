/**
 * packages/core/src/workbench/workbench-contracts.ts
 * Workbench Session and Proxy contracts (schema-first).
 *
 * These contracts intentionally allow “generic transport” inputs, but MUST be
 * enforced by policy controls (RBAC, allowlists, query firewall, rate limits).
 */
import { z } from '@golden/schema-registry';

export const workbenchProviderSchema = z.enum(['github', 'gitlab', 'jira']);
export type WorkbenchProvider = z.infer<typeof workbenchProviderSchema>;

export const workbenchKindSchema = z.enum(['graphql', 'openapi']);
export type WorkbenchKind = z.infer<typeof workbenchKindSchema>;

export const workbenchModeSchema = z.enum(['embedded', 'launch']);
export type WorkbenchMode = z.infer<typeof workbenchModeSchema>;

export const workbenchRbacSnapshotSchema = z
  .object({
    roles: z.array(z.string()).default([]),
    providers: z.array(workbenchProviderSchema).default([]),
    allow: z.object({
      launch: z.boolean(),
      rest: z.object({
        read: z.boolean(),
        write: z.boolean(),
      }),
      graphql: z.object({
        query: z.boolean(),
        mutation: z.boolean(),
        introspection: z.boolean(),
      }),
    }),
  })
  .describe('Policy snapshot captured at session creation (re-validated at call time).');
export type WorkbenchRbacSnapshot = z.infer<typeof workbenchRbacSnapshotSchema>;

export const createWorkbenchSessionRequestSchema = z
  .object({
    provider: workbenchProviderSchema,
    kind: workbenchKindSchema,
    mode: workbenchModeSchema,
  })
  .describe('Create a short-lived workbench session.');
export type CreateWorkbenchSessionRequest = z.infer<typeof createWorkbenchSessionRequestSchema>;

export const createWorkbenchSessionResponseSchema = z
  .object({
    sessionId: z.string().min(16),
    expiresAt: z.string().datetime(),
    launchUrl: z.string().url().optional(),
  })
  .describe('Workbench session creation result.');
export type CreateWorkbenchSessionResponse = z.infer<typeof createWorkbenchSessionResponseSchema>;

export const graphqlOperationNameSchema = z.string().min(1).max(128);

export const workbenchGraphqlProxyRequestSchema = z
  .object({
    sessionId: z.string().min(16),
    query: z.string().min(1).max(200_000),
    variables: z.record(z.unknown()).optional(),
    operationName: graphqlOperationNameSchema.optional(),
  })
  .describe('Proxy a GraphQL operation via a session-scoped provider proxy.');
export type WorkbenchGraphqlProxyRequest = z.infer<typeof workbenchGraphqlProxyRequestSchema>;

export const workbenchGraphqlProxyResponseSchema = z
  .object({
    data: z.unknown().optional(),
    errors: z.array(z.unknown()).optional(),
    extensions: z.unknown().optional(),
    meta: z
      .object({
        rateLimit: z
          .object({
            limit: z.number().int().nonnegative().optional(),
            remaining: z.number().int().nonnegative().optional(),
            resetAt: z.string().datetime().optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .describe('GraphQL proxy result with optional provider metadata.');
export type WorkbenchGraphqlProxyResponse = z.infer<typeof workbenchGraphqlProxyResponseSchema>;

export const httpMethodSchema = z.enum(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']);
export type HttpMethod = z.infer<typeof httpMethodSchema>;

const relativePathSchema = z
  .string()
  .min(1)
  .max(2048)
  .refine((p) => p.startsWith('/'), { message: 'path must start with "/"' })
  .refine((p) => !p.includes('://'), { message: 'path must not contain scheme/host' })
  .refine((p) => !p.includes('\\'), { message: 'path must not contain backslashes' });

export const workbenchRestProxyRequestSchema = z
  .object({
    sessionId: z.string().min(16),
    method: httpMethodSchema,
    path: relativePathSchema,
    query: z.record(z.string()).optional(),
    body: z.unknown().optional(),
  })
  .describe('Proxy a REST request via a session-scoped provider proxy.');
export type WorkbenchRestProxyRequest = z.infer<typeof workbenchRestProxyRequestSchema>;

export const workbenchRestProxyResponseSchema = z
  .object({
    status: z.number().int().min(100).max(599),
    headers: z.record(z.string()),
    body: z.unknown(),
  })
  .describe('REST proxy result with filtered response headers.');
export type WorkbenchRestProxyResponse = z.infer<typeof workbenchRestProxyResponseSchema>;

