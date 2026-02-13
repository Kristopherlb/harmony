import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute, useLocation } from "wouter";
import { NOCHeader } from "@/components/noc-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ServiceCatalogView } from "@/features/service-catalog/view/ServiceCatalogView";
import type { Service, ServiceCatalogResponse, Team } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Network, AlertTriangle, BookOpen, Clock, ArrowLeft } from "lucide-react";

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

  const serviceId = params?.id ?? null;

  const detailQuery = useQuery<{
    service: Service;
    team?: Team;
    dependencies: Service[];
    dependents: Service[];
  }>({
    queryKey: serviceId ? [`/api/services/${encodeURIComponent(serviceId)}`] : ["__service_disabled__"],
    enabled: !!serviceId,
  });

  const service = detailQuery.data?.service ?? null;
  const team = detailQuery.data?.team ?? null;
  const dependencies = detailQuery.data?.dependencies ?? [];
  const dependents = detailQuery.data?.dependents ?? [];
  const primaryTag = service?.tags?.[0] ?? service?.id ?? "";

  return (
    <div data-testid="service-detail-page" className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">{service?.name ?? "Service"}</h1>
          </div>
          <div className="text-sm text-muted-foreground">
            {service?.description ?? "Service detail view."}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/services">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
      </div>

      {detailQuery.isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : detailQuery.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">Failed to load service.</CardContent>
        </Card>
      ) : !service ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Service not found.</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Overview</CardTitle>
                <CardDescription>Ownership, posture, and key links.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    id:{service.id}
                  </Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    type:{service.type}
                  </Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    tier:{service.tier}
                  </Badge>
                  <Badge
                    variant={service.health === "critical" ? "destructive" : service.health === "degraded" ? "default" : "secondary"}
                    className="font-mono text-[10px]"
                  >
                    health:{service.health}
                  </Badge>
                  {team ? (
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      team:{team.slug}
                    </Badge>
                  ) : null}
                </div>

                {(service.tags?.length ?? 0) > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {(service.tags ?? []).slice(0, 12).map((t) => (
                      <Badge key={t} variant="secondary" className="font-mono text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                <Separator />

                <div className="flex flex-wrap gap-2">
                  <Link href={`/incidents?q=${encodeURIComponent(primaryTag)}`}>
                    <Button variant="outline" className="gap-2" data-testid="service-link-incidents">
                      <AlertTriangle className="h-4 w-4" />
                      Incidents
                    </Button>
                  </Link>
                  <Link href={`/runbooks?q=${encodeURIComponent(primaryTag)}`}>
                    <Button variant="outline" className="gap-2" data-testid="service-link-runbooks">
                      <BookOpen className="h-4 w-4" />
                      Runbooks
                    </Button>
                  </Link>
                  <Link href={`/timeline?q=${encodeURIComponent(primaryTag)}`}>
                    <Button variant="outline" className="gap-2" data-testid="service-link-executions">
                      <Clock className="h-4 w-4" />
                      Executions
                    </Button>
                  </Link>
                </div>

                {(service.repositoryUrl || service.documentationUrl || service.dashboardUrl) ? (
                  <div className="pt-1 space-y-2 text-sm">
                    {service.repositoryUrl ? (
                      <a href={service.repositoryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 underline">
                        <ExternalLink className="h-4 w-4" />
                        Repository
                      </a>
                    ) : null}
                    {service.documentationUrl ? (
                      <a href={service.documentationUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 underline">
                        <ExternalLink className="h-4 w-4" />
                        Documentation
                      </a>
                    ) : null}
                    {service.dashboardUrl ? (
                      <a href={service.dashboardUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 underline">
                        <ExternalLink className="h-4 w-4" />
                        Dashboard
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Graph</CardTitle>
                <CardDescription>Dependencies and dependents.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Dependencies</div>
                  {dependencies.length === 0 ? (
                    <div className="text-sm text-muted-foreground">None</div>
                  ) : (
                    <ul className="text-sm space-y-1">
                      {dependencies.slice(0, 8).map((d) => (
                        <li key={d.id}>
                          <Link href={`/services/${encodeURIComponent(d.id)}`} className="underline font-mono">
                            {d.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Dependents</div>
                  {dependents.length === 0 ? (
                    <div className="text-sm text-muted-foreground">None</div>
                  ) : (
                    <ul className="text-sm space-y-1">
                      {dependents.slice(0, 8).map((d) => (
                        <li key={d.id}>
                          <Link href={`/services/${encodeURIComponent(d.id)}`} className="underline font-mono">
                            {d.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
