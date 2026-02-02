/**
 * packages/apps/console/client/src/features/workbench/library/template-filters.tsx
 * Faceted search: domain filter and keyword search for the template library.
 */

import React, { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import type { TemplateDraftLike } from "@/features/workbench/template-insertion";

export interface TemplateFiltersProps {
  templates: TemplateDraftLike[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedDomain: string | null;
  onDomainChange: (domain: string | null) => void;
}

export function TemplateFilters({
  templates,
  searchQuery,
  onSearchChange,
  selectedDomain,
  onDomainChange,
}: TemplateFiltersProps) {
  const domains = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) {
      if (t.domain) set.add(t.domain);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [templates]);

  return (
    <div className="space-y-4" data-testid="template-filters">
      <div className="space-y-2">
        <Label htmlFor="template-search">Search</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="template-search"
            type="search"
            placeholder="Search by name, description, or tags…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            data-testid="template-search-input"
          />
        </div>
      </div>
      {domains.length > 0 ? (
        <div className="space-y-2">
          <Label>Domain</Label>
          <div className="flex flex-wrap gap-1">
            <Badge
              variant={selectedDomain === null ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => onDomainChange(null)}
              data-testid="filter-domain-all"
            >
              All
            </Badge>
            {domains.map((d) => (
              <Badge
                key={d}
                variant={selectedDomain === d ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => onDomainChange(selectedDomain === d ? null : d)}
                data-testid={`filter-domain-${d}`}
              >
                {d}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
