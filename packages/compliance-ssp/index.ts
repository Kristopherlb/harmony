/**
 * packages/compliance-ssp/index.ts
 * Entry point for the Compliance SSP package.
 */
export * from './src/generator.js';
export * from './src/manager.js';
export { mergeNarratives, type SSPNarrativeMerge, type MergeResult } from '@golden/compliance';
