import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/patterns/MetricCard";
import { DORAMetricsDetail } from "./dora-metrics-detail";
import type { DORAMetrics as DORAMetricsType } from "@shared/schema";
import { Rocket, Clock, Wrench, AlertCircle } from "lucide-react";

interface DORAMetricsProps {
  metrics: DORAMetricsType | null;
  isLoading?: boolean;
  className?: string;
}


function getDeploymentFrequencyStatus(freq: number): "good" | "medium" | "poor" {
  if (freq >= 1) return "good";
  if (freq >= 0.25) return "medium";
  return "poor";
}

function getLeadTimeStatus(hours: number): "good" | "medium" | "poor" {
  if (hours <= 24) return "good";
  if (hours <= 168) return "medium";
  return "poor";
}

function getMTTRStatus(hours: number): "good" | "medium" | "poor" {
  if (hours <= 1) return "good";
  if (hours <= 24) return "medium";
  return "poor";
}

function getChangeFailureStatus(rate: number): "good" | "medium" | "poor" {
  if (rate <= 0.05) return "good";
  if (rate <= 0.15) return "medium";
  return "poor";
}

type MetricTab = "deployment" | "leadtime" | "mttr" | "cfr";

export function DORAMetrics({ metrics, isLoading, className }: DORAMetricsProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<MetricTab>("deployment");

  const openDetail = (tab: MetricTab) => {
    setActiveTab(tab);
    setDetailOpen(true);
  };

  if (!metrics && !isLoading) {
    return (
      <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4", className)}>
        <Card className="p-4 font-mono col-span-full text-center text-muted-foreground">
          No metrics data available
        </Card>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn("grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4", className)}
        data-testid="dora-metrics-panel"
      >
        <MetricCard
          title="Deploy Freq"
          value={metrics?.deploymentFrequency.toFixed(2) ?? "-"}
          unit="per day"
          icon={<Rocket className="h-4 w-4" />}
          status={metrics ? getDeploymentFrequencyStatus(metrics.deploymentFrequency) : "medium"}
          trend="up"
          trendValue="+12% this week"
          isLoading={isLoading}
          onClick={() => openDetail("deployment")}
        />
        <MetricCard
          title="Lead Time"
          value={metrics?.leadTime.toFixed(1) ?? "-"}
          unit="hours"
          icon={<Clock className="h-4 w-4" />}
          status={metrics ? getLeadTimeStatus(metrics.leadTime) : "medium"}
          trend="down"
          trendValue="-8% this week"
          isLoading={isLoading}
          onClick={() => openDetail("leadtime")}
        />
        <MetricCard
          title="MTTR"
          value={metrics?.meanTimeToRecovery.toFixed(1) ?? "-"}
          unit="hours"
          icon={<Wrench className="h-4 w-4" />}
          status={metrics ? getMTTRStatus(metrics.meanTimeToRecovery) : "medium"}
          trend="down"
          trendValue="-15% this week"
          isLoading={isLoading}
          onClick={() => openDetail("mttr")}
        />
        <MetricCard
          title="Change Fail %"
          value={metrics ? (metrics.changeFailureRate * 100).toFixed(1) : "-"}
          unit="%"
          icon={<AlertCircle className="h-4 w-4" />}
          status={metrics ? getChangeFailureStatus(metrics.changeFailureRate) : "medium"}
          trend="stable"
          trendValue="No change"
          isLoading={isLoading}
          onClick={() => openDetail("cfr")}
        />
      </div>

      <DORAMetricsDetail
        open={detailOpen}
        onOpenChange={setDetailOpen}
        metrics={metrics}
        initialTab={activeTab}
      />
    </>
  );
}
