/**
 * packages/core/src/templates/template-schema.ts
 * Canonical schema for workflow templates and library items (Pre-work 3.1).
 * Aligns with spec/workbench-ir.schema.json (BlueprintDraft) and product-management/workbench-ux.spec.md.
 */
import { z } from '@golden/schema-registry';

/** Single node in a workflow draft (matches workbench IR). */
export const blueprintNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  type: z.string(),
  description: z.string().optional(),
  properties: z.record(z.unknown()).optional(),
});
export type BlueprintNode = z.infer<typeof blueprintNodeSchema>;

/** Edge between two nodes (matches workbench IR). */
export const blueprintEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  label: z.string().optional(),
});
export type BlueprintEdge = z.infer<typeof blueprintEdgeSchema>;

/** Full workflow draft (matches workbench IR / BlueprintDraft). */
export const blueprintDraftSchema = z.object({
  title: z.string().min(1),
  summary: z.string(),
  nodes: z.array(blueprintNodeSchema),
  edges: z.array(blueprintEdgeSchema),
});
export type BlueprintDraft = z.infer<typeof blueprintDraftSchema>;

/** Metadata for a template (library item). */
export const templateMetadataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  domain: z.string().optional(),
  subdomain: z.string().optional(),
  tags: z.array(z.string()).default([]),
  author: z.string().optional(),
  version: z.string().optional(),
});
export type TemplateMetadata = z.infer<typeof templateMetadataSchema>;

/** Template = metadata + draft (extends BlueprintDraft with metadata). */
export const templateDraftSchema = templateMetadataSchema.merge(blueprintDraftSchema);
export type TemplateDraft = z.infer<typeof templateDraftSchema>;

/** Catalog of available templates (manifest for library). */
export const templateManifestSchema = z.object({
  version: z.string().optional(),
  templates: z.array(templateDraftSchema),
});
export type TemplateManifest = z.infer<typeof templateManifestSchema>;
