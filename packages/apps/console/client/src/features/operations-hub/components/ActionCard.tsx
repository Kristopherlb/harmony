import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Play } from "lucide-react";
import type { Action } from "@shared/schema";

const riskClasses: Record<string, string> = {
  low: "bg-risk-low/20 text-risk-low border-risk-low/30",
  medium: "bg-risk-medium/20 text-risk-medium border-risk-medium/30",
  high: "bg-risk-high/20 text-risk-high border-risk-high/30",
  critical: "bg-risk-critical/20 text-risk-critical border-risk-critical/30",
};

export interface ActionCardProps {
  action: Action;
  icon: React.ComponentType<{ className?: string }>;
  onRun: () => void;
}

export function ActionCard({ action, icon: Icon, onRun }: ActionCardProps) {
  return (
    <Card key={action.id} className="hover-elevate" data-testid={`card-action-${action.id}`}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <Badge className={riskClasses[action.riskLevel]}>
            {action.riskLevel}
          </Badge>
        </div>
        <CardTitle className="text-lg">{action.name}</CardTitle>
        <CardDescription>{action.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {action.estimatedDuration || "Unknown"}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full gap-2"
          onClick={onRun}
          data-testid={`button-run-${action.id}`}
        >
          <Play className="h-4 w-4" />
          Run Action
        </Button>
      </CardFooter>
    </Card>
  );
}
