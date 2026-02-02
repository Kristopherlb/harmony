/**
 * packages/apps/console/client/src/features/workbench/template-insertion.ts
 * Converts a library TemplateDraft to a workbench BlueprintDraft (template → pending draft).
 */

import type { BlueprintDraft } from "@/features/workbench/types";

/** Template shape from API (matches @golden/core TemplateDraft). */
export interface TemplateDraftLike {
  id: string;
  name: string;
  description: string;
  domain?: string;
  subdomain?: string;
  tags?: string[];
  title: string;
  summary: string;
  nodes: Array<{ id: string; label: string; type: string; description?: string; properties?: Record<string, unknown> }>;
  edges: Array<{ source: string; target: string; label?: string }>;
}

/**
 * Converts a template (library item) to a BlueprintDraft for the canvas.
 * Strips library-only metadata (id, name, domain, subdomain, tags, author, version).
 */
export function templateToBlueprintDraft(template: TemplateDraftLike): BlueprintDraft {
  return {
    title: template.title,
    summary: template.summary,
    nodes: template.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      ...(n.description !== undefined && { description: n.description }),
      ...(n.properties !== undefined && { properties: n.properties }),
    })),
    edges: template.edges.map((e) => ({
      source: e.source,
      target: e.target,
      ...(e.label !== undefined && { label: e.label }),
    })),
  };
}
