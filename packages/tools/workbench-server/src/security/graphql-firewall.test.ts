/**
 * packages/tools/workbench-server/src/security/graphql-firewall.test.ts
 */
import { describe, it, expect } from 'vitest';
import { analyzeGraphqlDocument } from './graphql-firewall.js';

describe('analyzeGraphqlDocument', () => {
  it('rejects introspection when disabled', () => {
    const res = analyzeGraphqlDocument({
      query: 'query X { __schema { types { name } } }',
      introspectionAllowed: false,
      limits: { maxDocumentChars: 1000, maxDepth: 20, maxAliases: 50, maxSelections: 500, maxFragments: 50 },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('INTROSPECTION_DISABLED');
  });

  it('rejects deep queries beyond limit', () => {
    const res = analyzeGraphqlDocument({
      query: 'query X { a { b { c { d { e } } } } }',
      introspectionAllowed: true,
      limits: { maxDocumentChars: 1000, maxDepth: 3, maxAliases: 50, maxSelections: 500, maxFragments: 50 },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('LIMIT_EXCEEDED');
  });

  it('accepts a simple query and returns stats', () => {
    const res = analyzeGraphqlDocument({
      query: 'query Ping { __typename }',
      introspectionAllowed: true,
      limits: { maxDocumentChars: 1000, maxDepth: 20, maxAliases: 50, maxSelections: 500, maxFragments: 50 },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.operationType).toBe('query');
      expect(res.stats.selections).toBeGreaterThan(0);
    }
  });

  it('counts fragment contents towards depth and selections', () => {
    const res = analyzeGraphqlDocument({
      query: `
        query X { a { ...Deep } }
        fragment Deep on T { b { c { d { e } } } }
      `,
      introspectionAllowed: true,
      limits: { maxDocumentChars: 1000, maxDepth: 3, maxAliases: 50, maxSelections: 500, maxFragments: 50 },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('LIMIT_EXCEEDED');
  });
});
