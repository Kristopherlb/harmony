/**
 * packages/apps/console/client/src/features/workbench/library/use-templates.ts
 * Fetches workflow template catalog from /api/templates.
 */

import { useQuery } from "@tanstack/react-query";
import type { TemplateDraftLike } from "@/features/workbench/template-insertion";

export interface TemplateManifestResponse {
  version?: string;
  templates: TemplateDraftLike[];
}

export function useTemplates() {
  return useQuery<TemplateManifestResponse>({
    queryKey: ["/api/templates"],
  });
}
