import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Team, ServiceType } from "@shared/schema";

export interface ServiceCatalogFiltersProps {
  teamFilter: string;
  typeFilter: string;
  healthFilter: string;
  onTeamFilterChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  onHealthFilterChange: (value: string) => void;
  onClearFilters: () => void;
  teams: Team[];
}

export function ServiceCatalogFilters({
  teamFilter,
  typeFilter,
  healthFilter,
  onTeamFilterChange,
  onTypeFilterChange,
  onHealthFilterChange,
  onClearFilters,
  teams,
}: ServiceCatalogFiltersProps) {
  const hasActiveFilters =
    teamFilter !== "all" || typeFilter !== "all" || healthFilter !== "all";

  return (
    <div className="flex flex-wrap gap-3">
      <Select value={teamFilter} onValueChange={onTeamFilterChange}>
        <SelectTrigger className="w-[180px]" data-testid="filter-team">
          <SelectValue placeholder="Filter by team" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Teams</SelectItem>
          {teams.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              {team.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={typeFilter} onValueChange={onTypeFilterChange}>
        <SelectTrigger className="w-[180px]" data-testid="filter-type">
          <SelectValue placeholder="Filter by type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="api">API</SelectItem>
          <SelectItem value="worker">Worker</SelectItem>
          <SelectItem value="database">Database</SelectItem>
          <SelectItem value="cache">Cache</SelectItem>
          <SelectItem value="gateway">Gateway</SelectItem>
          <SelectItem value="frontend">Frontend</SelectItem>
          <SelectItem value="ml">ML</SelectItem>
          <SelectItem value="storage">Storage</SelectItem>
        </SelectContent>
      </Select>

      <Select value={healthFilter} onValueChange={onHealthFilterChange}>
        <SelectTrigger className="w-[180px]" data-testid="filter-health">
          <SelectValue placeholder="Filter by health" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Health</SelectItem>
          <SelectItem value="healthy">Healthy</SelectItem>
          <SelectItem value="degraded">Degraded</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          data-testid="button-clear-filters"
        >
          Clear Filters
        </Button>
      )}
    </div>
  );
}
