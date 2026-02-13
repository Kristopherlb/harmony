/**
 * packages/apps/console/client/src/pages/library-page.tsx
 * Library page: browse, filter, search, and insert workflow templates (Phase 4.1.1).
 */

import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useTemplates } from "@/features/workbench/library/use-templates";
import { TemplateCard } from "@/features/workbench/library/template-card";
import { TemplateFilters } from "@/features/workbench/library/template-filters";
import { TemplateDetail } from "@/features/workbench/library/template-detail";
import type { TemplateDraftLike } from "@/features/workbench/template-insertion";
import { getLocalTemplatesUpdatedEventName, loadLocalTemplates } from "@/features/workbench/library/local-templates";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/patterns/EmptyState";
import { Library } from "lucide-react";

export default function LibraryPage() {
  const [, setLocation] = useLocation();
  const { data, isLoading, error } = useTemplates();
  const [localTemplatesTick, setLocalTemplatesTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [detailTemplate, setDetailTemplate] = useState<TemplateDraftLike | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    const onUpdated = () => setLocalTemplatesTick((x) => x + 1);
    const eventName = getLocalTemplatesUpdatedEventName();
    window.addEventListener(eventName, onUpdated);
    window.addEventListener("storage", onUpdated);
    return () => {
      window.removeEventListener(eventName, onUpdated);
      window.removeEventListener("storage", onUpdated);
    };
  }, []);

  const localTemplates = useMemo(() => loadLocalTemplates(), [localTemplatesTick]);
  const templates = useMemo(() => {
    const remote = data?.templates ?? [];
    const byId = new Map<string, TemplateDraftLike>();
    for (const t of remote) byId.set(t.id, t);
    for (const t of localTemplates) byId.set(t.id, t);
    return Array.from(byId.values());
  }, [data?.templates, localTemplates]);

  const filteredTemplates = useMemo(() => {
    let list = templates;
    if (selectedDomain) {
      list = list.filter((t) => t.domain === selectedDomain);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const terms = [q];
      list = list.filter((t) => {
        const searchable = [
          t.name,
          t.description,
          ...(t.tags ?? []),
          t.domain ?? "",
          t.subdomain ?? "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return terms.every((term) => searchable.includes(term));
      });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [templates, selectedDomain, searchQuery]);

  const handleUseTemplate = (template: TemplateDraftLike) => {
    setLocation(`/workbench?templateId=${encodeURIComponent(template.id)}`);
  };

  if (error) {
    return (
      <div className="p-6" data-testid="library-page">
        <p className="text-destructive">Failed to load templates.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="library-page">
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Library className="h-5 w-5" />
          Workflow templates
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse and insert templates into the workbench. Use a template as a starting draft you can edit before applying.
        </p>
      </div>

      <div className="flex flex-1 min-h-0">
        <aside className="w-56 shrink-0 border-r p-4">
          <TemplateFilters
            templates={templates}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedDomain={selectedDomain}
            onDomainChange={setSelectedDomain}
          />
        </aside>

        <main className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 rounded-lg" />
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <EmptyState
              icon={Library}
              title="No templates match"
              description={
                searchQuery || selectedDomain
                  ? "Try clearing search or domain filter."
                  : "No templates in the catalog yet."
              }
              action={
                searchQuery || selectedDomain ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedDomain(null);
                    }}
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onPreview={(t) => {
                    setDetailTemplate(t);
                    setDetailOpen(true);
                  }}
                  onUseTemplate={handleUseTemplate}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <TemplateDetail
        template={detailTemplate}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUseTemplate={handleUseTemplate}
      />
    </div>
  );
}
