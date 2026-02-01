import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/patterns/PageHeader";
import { EmptyState } from "@/components/patterns/EmptyState";
import { ServiceCard } from "../components/ServiceCard";
import { ServiceGraph } from "../components/ServiceGraph";
import { ServiceCatalogFilters } from "../components/ServiceCatalogFilters";
import { LayoutGrid, Network, Server, Zap } from "lucide-react";
import type { Service, Team } from "@shared/schema";

export interface ServiceCatalogViewProps {
  services: Service[];
  filteredServices: Service[];
  teams: Team[];
  teamMap: Map<string, Team>;
  stats: {
    total: number;
    healthy: number;
    degraded: number;
    critical: number;
    tier1: number;
  };
  viewMode: "grid" | "graph";
  teamFilter: string;
  typeFilter: string;
  healthFilter: string;
  onViewModeChange: (mode: "grid" | "graph") => void;
  onTeamFilterChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  onHealthFilterChange: (value: string) => void;
  onClearFilters: () => void;
  onServiceClick: (id: string) => void;
}

export function ServiceCatalogView({
  services,
  filteredServices,
  teams,
  teamMap,
  stats,
  viewMode,
  teamFilter,
  typeFilter,
  healthFilter,
  onViewModeChange,
  onTeamFilterChange,
  onTypeFilterChange,
  onHealthFilterChange,
  onClearFilters,
  onServiceClick,
}: ServiceCatalogViewProps) {
  return (
    <main className="container mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Service Catalog"
        description="System of record for all services"
        actions={
          <div className="flex items-center gap-1 p-1 rounded-md bg-muted">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange("grid")}
              className="gap-1.5"
              data-testid="button-view-grid"
            >
              <LayoutGrid className="h-4 w-4" />
              Cards
            </Button>
            <Button
              variant={viewMode === "graph" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange("graph")}
              className="gap-1.5"
              data-testid="button-view-graph"
            >
              <Network className="h-4 w-4" />
              Graph
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Server className="h-4 w-4" />
            <span>Total Services</span>
          </div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-status-healthy" />
            <span>Healthy</span>
          </div>
          <div className="text-2xl font-bold text-status-healthy">{stats.healthy}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-status-degraded" />
            <span>Degraded</span>
          </div>
          <div className="text-2xl font-bold text-status-degraded">{stats.degraded}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-status-critical animate-pulse" />
            <span>Critical</span>
          </div>
          <div className="text-2xl font-bold text-status-critical">{stats.critical}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Zap className="h-4 w-4" />
            <span>Tier 1</span>
          </div>
          <div className="text-2xl font-bold">{stats.tier1}</div>
        </Card>
      </div>

      <ServiceCatalogFilters
        teamFilter={teamFilter}
        typeFilter={typeFilter}
        healthFilter={healthFilter}
        onTeamFilterChange={onTeamFilterChange}
        onTypeFilterChange={onTypeFilterChange}
        onHealthFilterChange={onHealthFilterChange}
        onClearFilters={onClearFilters}
        teams={teams}
      />

      {viewMode === "graph" && (
        <ServiceGraph services={filteredServices} onNodeClick={onServiceClick} />
      )}

      {viewMode === "grid" && (
        <>
          {filteredServices.length === 0 ? (
            <EmptyState
              icon={Server}
              title="No services found"
              description="No services match the current filters."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredServices.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  team={teamMap.get(service.teamId)}
                  onClick={() => onServiceClick(service.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
