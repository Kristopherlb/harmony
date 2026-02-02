/**
 * @golden/schema-registry
 * Centralized Zod schemas for the Golden Path ecosystem.
 */
export { z } from 'zod';
export { sdlToIntrospectionResult, type GraphqlIntrospectionResult } from './src/graphql/introspection.js';
export * from './src/compliance/types.js';
