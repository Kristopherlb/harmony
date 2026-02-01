/**
 * packages/schema-registry/src/graphql/introspection.ts
 * Convert GraphQL SDL (schema definition language) into an introspection JSON result.
 *
 * Security note: this is offline conversion only (no network calls).
 */
import { buildSchema, graphql, getIntrospectionQuery } from 'graphql';

export type GraphqlIntrospectionResult = {
  data?: unknown;
  errors?: unknown;
};

export async function sdlToIntrospectionResult(sdl: string): Promise<GraphqlIntrospectionResult> {
  const schema = buildSchema(sdl);
  const result = await graphql({
    schema,
    source: getIntrospectionQuery(),
  });
  return { data: result.data ?? undefined, errors: result.errors ?? undefined };
}

