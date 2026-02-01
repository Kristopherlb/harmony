/**
 * packages/core/src/ass/discover-tools.ts
 * MCP tool discovery interface (AIP-001). Resolves capability/blueprint IDs to callable tools.
 */
import type { ToolId } from '../types.js';

/** Tool function returned by discovery; returns structured response including trace_id. */
export interface ToolFn {
  (args: unknown): Promise<{ result: unknown; trace_id?: string }>;
}

/** Registry that maps tool IDs to tool implementations (MCP or in-memory). */
export interface ToolRegistry {
  get(id: ToolId): ToolFn | undefined;
  list(): ToolId[];
}

/**
 * Discover tools from registry for the given IDs. Returns a map of id → tool function.
 * Tools must return structured response including trace_id for correlation (AIP).
 */
export function discoverTools(
  registry: ToolRegistry,
  ids: ToolId[]
): Map<ToolId, ToolFn> {
  const map = new Map<ToolId, ToolFn>();
  for (const id of ids) {
    const fn = registry.get(id);
    if (fn) map.set(id, fn);
  }
  return map;
}
