import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/patterns/StatusPill";
import {
  Server,
  Database,
  Cpu,
  Globe,
  Cog,
  Layers,
  Brain,
  HardDrive,
  AlertTriangle,
  Shield,
} from "lucide-react";
import type { Service, Team, ServiceType, ServiceHealth } from "@shared/schema";

const typeIcons: Record<ServiceType, typeof Server> = {
  api: Server,
  worker: Cog,
  database: Database,
  cache: Cpu,
  gateway: Globe,
  frontend: Layers,
  ml: Brain,
  storage: HardDrive,
};

export interface ServiceCardProps {
  service: Service;
  team?: Team;
  onClick: () => void;
}

export function ServiceCard({ service, team, onClick }: ServiceCardProps) {
  const Icon = typeIcons[service.type] || Server;

  return (
    <Card
      className="p-4 hover-elevate cursor-pointer transition-all"
      onClick={onClick}
      data-testid={`card-service-${service.id}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{service.name}</h3>
            <p className="text-xs text-muted-foreground">{team?.name || service.teamId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={service.health} showDot className="text-xs" />
        </div>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{service.description}</p>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {service.errorRate !== undefined && (
          <div className="text-xs">
            <span className="text-muted-foreground">Error Rate:</span>
            <span
              className={`ml-1 font-mono ${
                service.errorRate > 1 ? "text-status-critical" : "text-foreground"
              }`}
            >
              {service.errorRate.toFixed(2)}%
            </span>
          </div>
        )}
        {service.latencyP99 !== undefined && (
          <div className="text-xs">
            <span className="text-muted-foreground">P99:</span>
            <span className="ml-1 font-mono">{service.latencyP99}ms</span>
          </div>
        )}
        {service.requestsPerSecond !== undefined && (
          <div className="text-xs">
            <span className="text-muted-foreground">RPS:</span>
            <span className="ml-1 font-mono">{service.requestsPerSecond.toLocaleString()}</span>
          </div>
        )}
        {service.version && (
          <div className="text-xs">
            <span className="text-muted-foreground">Version:</span>
            <span className="ml-1 font-mono">{service.version}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {service.tags.slice(0, 4).map((tag) => (
          <Badge key={tag} variant="outline" className="text-xs">
            {tag}
          </Badge>
        ))}
        {service.tags.length > 4 && (
          <Badge variant="outline" className="text-xs">+{service.tags.length - 4}</Badge>
        )}
      </div>

      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
        {service.openIncidents > 0 && (
          <div className="flex items-center gap-1 text-xs text-status-degraded">
            <AlertTriangle className="h-3 w-3" />
            <span>{service.openIncidents} incidents</span>
          </div>
        )}
        {service.openVulnerabilities > 0 && (
          <div className="flex items-center gap-1 text-xs text-status-critical">
            <Shield className="h-3 w-3" />
            <span>{service.openVulnerabilities} vulns</span>
          </div>
        )}
        {service.openIncidents === 0 && service.openVulnerabilities === 0 && (
          <div className="flex items-center gap-1 text-xs text-status-healthy">
            <Shield className="h-3 w-3" />
            <span>No issues</span>
          </div>
        )}
      </div>
    </Card>
  );
}
