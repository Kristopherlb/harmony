import { useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
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
} from "lucide-react";
import type { Service, ServiceType, ServiceHealth } from "@shared/schema";

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

interface GraphNode {
  id: string;
  name: string;
  type: ServiceType;
  health: ServiceHealth;
  x: number;
  y: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

export interface ServiceGraphProps {
  services: Service[];
  onNodeClick: (id: string) => void;
}

export function ServiceGraph({ services, onNodeClick }: ServiceGraphProps) {
  const { nodes, edges, width, height } = useMemo(() => {
    const serviceMap = new Map(services.map((s) => [s.id, s]));
    const graphEdges: GraphEdge[] = [];

    services.forEach((service) => {
      service.dependencies.forEach((depId) => {
        if (serviceMap.has(depId)) {
          graphEdges.push({ source: service.id, target: depId });
        }
      });
    });

    const tiers: Service[][] = [[], [], []];
    services.forEach((s) => {
      const tierIdx = s.tier === "tier1" ? 0 : s.tier === "tier2" ? 1 : 2;
      tiers[tierIdx].push(s);
    });

    const graphWidth = Math.max(900, Math.max(...tiers.map((t) => t.length)) * 180);
    const graphHeight = 450;
    const tierHeights = [80, 200, 320];

    const graphNodes: GraphNode[] = [];
    tiers.forEach((tierServices, tierIdx) => {
      const y = tierHeights[tierIdx];
      const spacing = graphWidth / (tierServices.length + 1);
      tierServices.forEach((s, i) => {
        graphNodes.push({
          id: s.id,
          name: s.name,
          type: s.type,
          health: s.health,
          x: spacing * (i + 1),
          y,
        });
      });
    });

    return { nodes: graphNodes, edges: graphEdges, width: graphWidth, height: graphHeight };
  }, [services]);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const getNodeColor = useCallback((health: ServiceHealth): string => {
    // Use CSS variable values for colors
    const colorMap: Record<ServiceHealth, string> = {
      healthy: "hsl(var(--status-healthy))",
      degraded: "hsl(var(--status-degraded))",
      critical: "hsl(var(--status-critical))",
      unknown: "hsl(var(--status-unknown))",
    };
    return colorMap[health] || colorMap.unknown;
  }, []);

  return (
    <Card className="p-4 overflow-x-auto" data-testid="service-graph">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Service Dependency Graph</h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-status-healthy" />
            <span>Healthy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-status-degraded" />
            <span>Degraded</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-status-critical" />
            <span>Critical</span>
          </div>
        </div>
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground mb-2">
        <span>Tier 1 (Critical)</span>
        <span>Tier 2 (Standard)</span>
        <span>Tier 3 (Low Priority)</span>
      </div>
      <svg width={width} height={height} className="min-w-full">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="6"
            markerHeight="4"
            refX="6"
            refY="2"
            orient="auto"
          >
            <polygon
              points="0 0, 6 2, 0 4"
              fill="currentColor"
              className="text-muted-foreground/50"
            />
          </marker>
        </defs>

        {edges.map((edge, i) => {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);
          if (!source || !target) return null;

          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const offsetX = (dx / dist) * 30;
          const offsetY = (dy / dist) * 30;

          return (
            <line
              key={i}
              x1={source.x + offsetX}
              y1={source.y + offsetY}
              x2={target.x - offsetX}
              y2={target.y - offsetY}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeOpacity="0.3"
              markerEnd="url(#arrowhead)"
              className="text-muted-foreground"
            />
          );
        })}

        {nodes.map((node) => {
          const Icon = typeIcons[node.type] || Server;
          const nodeColor = getNodeColor(node.health);
          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              className="cursor-pointer"
              onClick={() => onNodeClick(node.id)}
              data-testid={`graph-node-${node.id}`}
            >
              <circle
                r="28"
                fill="currentColor"
                className="text-background"
                stroke={nodeColor}
                strokeWidth="3"
              />
              <circle r="20" fill={nodeColor} fillOpacity="0.15" />
              <foreignObject x="-10" y="-10" width="20" height="20">
                <div className="flex items-center justify-center h-full">
                  <Icon className="h-4 w-4" style={{ color: nodeColor }} />
                </div>
              </foreignObject>
              <text
                y="45"
                textAnchor="middle"
                className="text-xs fill-current text-foreground font-medium"
              >
                {node.name.length > 18 ? node.name.slice(0, 16) + "..." : node.name}
              </text>
            </g>
          );
        })}
      </svg>
    </Card>
  );
}
