/**
 * packages/schema-registry/src/graphql/introspection.test.ts
 */
import { describe, it, expect } from 'vitest';
import { sdlToIntrospectionResult } from './introspection.js';

describe('sdlToIntrospectionResult', () => {
  it('returns __schema data for valid SDL', async () => {
    const sdl = /* GraphQL */ `
      schema {
        query: Query
      }
      type Query {
        ping: String
      }
    `;

    const res = await sdlToIntrospectionResult(sdl);
    expect(res.errors).toBeUndefined();
    expect(res.data).toBeTruthy();

    const data = res.data as Record<string, unknown>;
    const schema = data.__schema as { types?: unknown } | undefined;
    expect(schema).toBeTruthy();
    expect(Array.isArray(schema?.types)).toBe(true);
  });
});

