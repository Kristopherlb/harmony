/**
 * packages/agents/src/tool-registry/manifest-tool-registry.ts
 * In-process ToolRegistry adapter backed by the deterministic Tool Manifest (Option A).
 *
 * The agent only sees tools via ToolRegistry/ToolId (ASS-001), not bespoke clients.
 */
import type { ToolId, ToolRegistry, ToolFn } from '@golden/core';
import type { ToolManifest } from '@golden/mcp-server';
import { createToolSurface } from '@golden/mcp-server';

export function createManifestToolRegistry(input: {
  manifest: ToolManifest;
  authorizedTools: ToolId[];
  traceId?: () => string;
}): ToolRegistry {
  const allowed = new Set(input.authorizedTools);
  const known = new Set(input.manifest.tools.map((t) => t.id));
  const enabled = Array.from(allowed).filter((id) => known.has(id)).sort((a, b) => a.localeCompare(b));

  const surface = createToolSurface({
    manifest: input.manifest,
    traceId: input.traceId,
  });

  const fnById = new Map<ToolId, ToolFn>();

  for (const id of enabled) {
    fnById.set(id, async (args: unknown) => {
      const res = await surface.callTool({ name: id, arguments: args });
      const structured = res.structuredContent as Record<string, unknown> | undefined;
      const trace_id = structured && typeof structured.trace_id === 'string' ? structured.trace_id : undefined;
      return { result: structured ?? res, trace_id };
    });
  }

  return {
    list: () => enabled,
    get: (id) => fnById.get(id),
  };
}

