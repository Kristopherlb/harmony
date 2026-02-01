/**
 * packages/core/src/workbench/workbench-contracts.test.ts
 * TDD: ensure contracts parse and basic safety refinements apply.
 */
import { describe, it, expect } from 'vitest';
import {
  createWorkbenchSessionRequestSchema,
  workbenchGraphqlProxyRequestSchema,
  workbenchRestProxyRequestSchema,
} from './workbench-contracts.js';

describe('Workbench contracts', () => {
  it('parses session creation request', () => {
    const req = createWorkbenchSessionRequestSchema.parse({ provider: 'github', kind: 'graphql', mode: 'embedded' });
    expect(req.provider).toBe('github');
  });

  it('parses Jira session creation request', () => {
    const req = createWorkbenchSessionRequestSchema.parse({ provider: 'jira', kind: 'openapi', mode: 'embedded' });
    expect(req.provider).toBe('jira');
  });

  it('parses GraphQL proxy request', () => {
    const req = workbenchGraphqlProxyRequestSchema.parse({
      sessionId: 's'.repeat(16),
      query: 'query Ping { __typename }',
      variables: { x: 1 },
      operationName: 'Ping',
    });
    expect(req.operationName).toBe('Ping');
  });

  it('rejects REST proxy full URLs (SSRF prevention baseline)', () => {
    expect(() =>
      workbenchRestProxyRequestSchema.parse({
        sessionId: 's'.repeat(16),
        method: 'GET',
        path: 'https://example.com/evil',
      })
    ).toThrow(/scheme\/host/i);
  });
});

