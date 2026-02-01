import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { NOCHeader } from "@/components/noc-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ServiceCatalogView } from "@/features/service-catalog/view/ServiceCatalogView";
import type { ServiceCatalogResponse } from "@shared/schema";

export default function ServiceCatalog() {
  const [, setLocation] = useLocation();
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "graph">("grid");

  const catalogQuery = useQuery<ServiceCatalogResponse>({
    queryKey: ["/api/services"],
  });

  const services = catalogQuery.data?.services ?? [];
  const teams = catalogQuery.data?.teams ?? [];

  const filteredServices = services.filter((service) => {
    if (teamFilter !== "all" && service.teamId !== teamFilter) return false;
    if (typeFilter !== "all" && service.type !== typeFilter) return false;
    if (healthFilter !== "all" && service.health !== healthFilter) return false;
    return true;
  });

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const stats = useMemo(
    () => ({
      total: services.length,
      healthy: services.filter((s) => s.health === "healthy").length,
      degraded: services.filter((s) => s.health === "degraded").length,
      critical: services.filter((s) => s.health === "critical").length,
      tier1: services.filter((s) => s.tier === "tier1").length,
    }),
    [services]
  );

  if (catalogQuery.isLoading) {
    return (
      <div data-testid="service-catalog-loading">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="service-catalog-page">
      <ServiceCatalogView
        services={services}
        filteredServices={filteredServices}
        teams={teams}
        teamMap={teamMap}
        stats={stats}
        viewMode={viewMode}
        teamFilter={teamFilter}
        typeFilter={typeFilter}
        healthFilter={healthFilter}
        onViewModeChange={setViewMode}
        onTeamFilterChange={setTeamFilter}
        onTypeFilterChange={setTypeFilter}
        onHealthFilterChange={setHealthFilter}
        onClearFilters={() => {
          setTeamFilter("all");
          setTypeFilter("all");
          setHealthFilter("all");
        }}
        onServiceClick={(id) => setLocation(`/services/${id}`)}
      />
    </div>
  );
}

// ServiceDetailPage remains in this file for now but should be extracted similarly
export function ServiceDetailPage() {
  const [, params] = useRoute("/services/:id");
  const [, setLocation] = useLocation();

  // This would also be refactored to use a view component
  // Keeping minimal implementation for now
  return null;
}
