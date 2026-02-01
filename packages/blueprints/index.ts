/**
 * @golden/blueprints
 * Workflows extending BaseBlueprint; shared executeCapability activity.
 */
export { EchoWorkflow, SECURITY_CONTEXT_MEMO_KEY, type EchoInput, type EchoOutput } from './src/workflows/echo.workflow';
export { echoBlueprintDescriptor } from './src/descriptors/echo.descriptor.js';
export type { BlueprintDescriptor } from './src/descriptors/types.js';
export {
  createBlueprintRegistry,
  getBlueprint,
  type BlueprintRegistry,
  type BlueprintRegistryEntry,
} from './src/registry.js';
// Note: activity implementations are worker/runtime concerns; do not export e2e/demo activities from the package API.
