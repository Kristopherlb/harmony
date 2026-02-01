import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusIndicator } from "./status-indicator";
import { SecurityFindingDetail } from "./security-finding-detail";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import type { SecurityFinding, SecurityTool, SecuritySeverity } from "@shared/schema";

interface SecuritySummary {
  totalOpen: number;
  bySeverity: Record<SecuritySeverity, number>;
  byTool: Record<SecurityTool, number>;
}

interface FindingsResponse {
  findings: SecurityFinding[];
  total: number;
  page: number;
  pageSize: number;
}

const toolLabels: Record<SecurityTool, string> = {
  wiz: "Wiz",
  aws_inspector: "AWS Inspector",
  artifactory_xray: "Xray",
};

const toolColors: Record<SecurityTool, string> = {
  wiz: "text-primary",
  aws_inspector: "text-primary",
  artifactory_xray: "text-status-healthy",
};

const severityColors: Record<SecuritySeverity, string> = {
  critical: "text-status-critical",
  high: "text-risk-high",
  medium: "text-status-degraded",
  low: "text-primary",
};

const severityBadgeVariants: Record<SecuritySeverity, "destructive" | "default" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "default",
  low: "secondary",
};

interface SecuritySectionProps {
  className?: string;
}

export function SecuritySection({ className }: SecuritySectionProps) {
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<SecurityFinding | null>(null);
  const [findingDetailOpen, setFindingDetailOpen] = useState(false);

  const summaryQuery = useQuery<SecuritySummary>({
    queryKey: ["/api/security/summary"],
    refetchInterval: 60000,
  });

  const summary = summaryQuery.data;

  const handleSummaryClick = () => {
    setDeepDiveOpen(true);
  };

  const handleFindingClick = (finding: SecurityFinding) => {
    setSelectedFinding(finding);
    setFindingDetailOpen(true);
  };

  if (summaryQuery.isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <Card className="p-4">
          <Skeleton className="h-24 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className={cn("space-y-4", className)}>
        <SecuritySummaryCard summary={summary} onClick={handleSummaryClick} />
      </div>

      <SecurityDeepDive
        open={deepDiveOpen}
        onOpenChange={setDeepDiveOpen}
        summary={summary}
        onFindingClick={handleFindingClick}
      />

      <SecurityFindingDetail
        finding={selectedFinding}
        open={findingDetailOpen}
        onOpenChange={setFindingDetailOpen}
      />
    </>
  );
}

interface SecuritySummaryCardProps {
  summary?: SecuritySummary;
  onClick: () => void;
}

function SecuritySummaryCard({ summary, onClick }: SecuritySummaryCardProps) {
  const totalOpen = summary?.totalOpen ?? 0;
  const criticalCount = summary?.bySeverity?.critical ?? 0;
  const highCount = summary?.bySeverity?.high ?? 0;

  const getStatus = () => {
    if (criticalCount > 0) return "critical";
    if (highCount > 2) return "high";
    if (totalOpen > 5) return "medium";
    return "healthy";
  };

  const status = getStatus();

  return (
    <Card
      className={cn(
        "group p-4 font-mono border cursor-pointer transition-all hover-elevate",
        status === "critical" && "border-status-critical/50 glow-red",
        status === "high" && "border-risk-high/50"
      )}
      data-testid="security-summary-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          {status === "healthy" ? (
            <ShieldCheck className="h-5 w-5 text-status-healthy" />
          ) : status === "critical" ? (
            <ShieldAlert className="h-5 w-5 text-status-critical" />
          ) : (
            <Shield className="h-5 w-5 text-status-degraded" />
          )}
          <h3 className="text-sm font-semibold uppercase tracking-wider">Security Posture</h3>
        </div>
        <div className="flex items-center gap-2">
          <StatusIndicator
            severity={status === "healthy" ? "low" : status === "critical" ? "critical" : "medium"}
            size="sm"
            pulse={status === "critical"}
          />
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <SeverityCounter label="Critical" count={summary?.bySeverity?.critical ?? 0} color="text-status-critical" />
        <SeverityCounter label="High" count={summary?.bySeverity?.high ?? 0} color="text-risk-high" />
        <SeverityCounter label="Medium" count={summary?.bySeverity?.medium ?? 0} color="text-status-degraded" />
        <SeverityCounter label="Low" count={summary?.bySeverity?.low ?? 0} color="text-primary" />
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>By Tool:</span>
          {Object.entries(summary?.byTool ?? {}).map(([tool, count]) => (
            <span key={tool} className={toolColors[tool as SecurityTool]}>
              {toolLabels[tool as SecurityTool]}: {count}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

function SeverityCounter({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="text-center">
      <div className={cn("text-2xl font-bold", color)}>{count}</div>
      <div className="text-xs text-muted-foreground uppercase">{label}</div>
    </div>
  );
}

interface SecurityDeepDiveProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary?: SecuritySummary;
  onFindingClick?: (finding: SecurityFinding) => void;
}

function SecurityDeepDive({ open, onOpenChange, summary, onFindingClick }: SecurityDeepDiveProps) {
  const [selectedFinding, setSelectedFinding] = useState<SecurityFinding | null>(null);
  const [findingDetailOpen, setFindingDetailOpen] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<SecuritySeverity | null>(null);
  const [filterTool, setFilterTool] = useState<SecurityTool | null>(null);
  const [filteredListOpen, setFilteredListOpen] = useState(false);

  const findingsQuery = useQuery<FindingsResponse>({
    queryKey: ["/api/security/findings", { status: "open", pageSize: 50 }],
    queryFn: async () => {
      const res = await fetch("/api/security/findings?status=open&pageSize=50");
      if (!res.ok) throw new Error("Failed to fetch findings");
      return res.json();
    },
    enabled: open,
    refetchInterval: 60000,
  });

  const allFindings = findingsQuery.data?.findings ?? [];
  const totalOpen = summary?.totalOpen ?? 0;
  const criticalCount = summary?.bySeverity?.critical ?? 0;

  // Filter findings based on selected severity or tool
  const filteredFindings = filterSeverity
    ? allFindings.filter(f => f.severity === filterSeverity)
    : filterTool
      ? allFindings.filter(f => f.tool === filterTool)
      : allFindings;

  const handleFindingClick = (finding: SecurityFinding) => {
    if (onFindingClick) {
      // If parent provides handler, use it (parent manages detail sheet)
      onFindingClick(finding);
    } else {
      // Otherwise, manage detail sheet internally (self-contained behavior)
      setSelectedFinding(finding);
      setFindingDetailOpen(true);
    }
  };

  const handleSeverityClick = (severity: SecuritySeverity) => {
    setFilterSeverity(severity);
    setFilterTool(null);
    setFilteredListOpen(true);
  };

  const handleToolClick = (tool: SecurityTool) => {
    setFilterTool(tool);
    setFilterSeverity(null);
    setFilteredListOpen(true);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl font-mono overflow-y-auto" data-testid="security-deep-dive">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {criticalCount > 0 ? (
                <ShieldAlert className="h-5 w-5 text-status-critical" />
              ) : (
                <Shield className="h-5 w-5 text-primary" />
              )}
              Security Deep Dive
            </SheetTitle>
            <SheetDescription>
              {totalOpen} open vulnerabilities across all security tools
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <SummaryOverview 
              summary={summary} 
              onSeverityClick={handleSeverityClick}
              onToolClick={handleToolClick}
            />
            <VulnerabilityList 
              findings={allFindings} 
              isLoading={findingsQuery.isLoading}
              onFindingClick={handleFindingClick} 
            />
          </div>
        </SheetContent>
      </Sheet>

      {!onFindingClick && (
        <SecurityFindingDetail
          finding={selectedFinding}
          open={findingDetailOpen}
          onOpenChange={setFindingDetailOpen}
        />
      )}

      <FilteredFindingsSheet
        open={filteredListOpen}
        onOpenChange={(open) => {
          setFilteredListOpen(open);
          if (!open) {
            setFilterSeverity(null);
            setFilterTool(null);
          }
        }}
        findings={filteredFindings}
        filterType={filterSeverity ? "severity" : "tool"}
        filterValue={filterSeverity || filterTool || undefined}
        onFindingClick={handleFindingClick}
      />
    </>
  );
}

interface SummaryOverviewProps {
  summary?: SecuritySummary;
  onSeverityClick?: (severity: SecuritySeverity) => void;
  onToolClick?: (tool: SecurityTool) => void;
}

function SummaryOverview({ summary, onSeverityClick, onToolClick }: SummaryOverviewProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Severity Breakdown
      </h4>
      <div className="grid grid-cols-4 gap-3">
        <SeverityCard 
          label="Critical" 
          count={summary?.bySeverity?.critical ?? 0} 
          color="text-status-critical" 
          bgColor="bg-status-critical/10"
          onClick={() => onSeverityClick?.("critical")}
        />
        <SeverityCard 
          label="High" 
          count={summary?.bySeverity?.high ?? 0} 
          color="text-risk-high" 
          bgColor="bg-risk-high/10"
          onClick={() => onSeverityClick?.("high")}
        />
        <SeverityCard 
          label="Medium" 
          count={summary?.bySeverity?.medium ?? 0} 
          color="text-status-degraded" 
          bgColor="bg-status-degraded/10"
          onClick={() => onSeverityClick?.("medium")}
        />
        <SeverityCard 
          label="Low" 
          count={summary?.bySeverity?.low ?? 0} 
          color="text-primary" 
          bgColor="bg-primary/10"
          onClick={() => onSeverityClick?.("low")}
        />
      </div>

      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
        By Security Tool
      </h4>
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(summary?.byTool ?? {}).map(([tool, count]) => (
          <ToolCard 
            key={tool} 
            tool={tool as SecurityTool}
            count={count}
            onClick={() => onToolClick?.(tool as SecurityTool)}
          />
        ))}
      </div>
    </div>
  );
}

interface SeverityCardProps {
  label: string;
  count: number;
  color: string;
  bgColor: string;
  onClick?: () => void;
}

function SeverityCard({ label, count, color, bgColor, onClick }: SeverityCardProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (onClick && count > 0) {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && count > 0 && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <Card 
      className={cn(
        "p-3 text-center transition-all group",
        bgColor,
        onClick && count > 0 && "cursor-pointer hover-elevate active:scale-[0.98]"
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClick && count > 0 ? "button" : undefined}
      tabIndex={onClick && count > 0 ? 0 : undefined}
      data-testid={`severity-card-${label.toLowerCase()}`}
    >
      <div className={cn("text-xl font-bold", color)}>{count}</div>
      <div className="text-xs text-muted-foreground uppercase">{label}</div>
      {onClick && count > 0 && (
        <ChevronRight className="h-3 w-3 text-muted-foreground mx-auto mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </Card>
  );
}

interface ToolCardProps {
  tool: SecurityTool;
  count: number;
  onClick?: () => void;
}

function ToolCard({ tool, count, onClick }: ToolCardProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (onClick && count > 0) {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && count > 0 && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <Card 
      className={cn(
        "p-3 text-center transition-all group",
        onClick && count > 0 && "cursor-pointer hover-elevate active:scale-[0.98]"
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClick && count > 0 ? "button" : undefined}
      tabIndex={onClick && count > 0 ? 0 : undefined}
      data-testid={`tool-card-${tool}`}
    >
      <div className={cn("text-lg font-bold", toolColors[tool])}>
        {count}
      </div>
      <div className="text-xs text-muted-foreground">
        {toolLabels[tool]}
      </div>
      {onClick && count > 0 && (
        <ChevronRight className="h-3 w-3 text-muted-foreground mx-auto mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </Card>
  );
}

interface VulnerabilityListProps {
  findings: SecurityFinding[];
  isLoading: boolean;
  onFindingClick: (finding: SecurityFinding) => void;
}

function VulnerabilityList({ findings, isLoading, onFindingClick }: VulnerabilityListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <Card className="p-6 text-center" data-testid="vulnerability-list-empty">
        <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-status-healthy" />
        <p className="text-muted-foreground">No open vulnerabilities</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3" data-testid="vulnerability-list">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Open Vulnerabilities ({findings.length})
      </h4>
      <ScrollArea className="h-[calc(100vh-400px)]">
        <div className="space-y-2 pr-4">
          {findings.map((finding) => (
            <VulnerabilityCard 
              key={finding.id} 
              finding={finding} 
              onClick={() => onFindingClick(finding)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

interface VulnerabilityCardProps {
  finding: SecurityFinding;
  onClick: () => void;
}

function VulnerabilityCard({ finding, onClick }: VulnerabilityCardProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <div
      className={cn(
        "group rounded-md border border-border bg-card/50 p-3 transition-all cursor-pointer hover-elevate active:scale-[0.98]",
        finding.severity === "critical" && "border-status-critical/50"
      )}
      data-testid={`vulnerability-card-${finding.id}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className={cn("h-4 w-4 mt-0.5", severityColors[finding.severity])} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={severityBadgeVariants[finding.severity]} className="text-xs">
              {finding.severity.toUpperCase()}
            </Badge>
            <span className={cn("text-xs", toolColors[finding.tool])}>
              {toolLabels[finding.tool]}
            </span>
            {finding.cve && (
              <span className="text-xs text-muted-foreground">{finding.cve}</span>
            )}
            {finding.externalLink && (
              <a
                href={finding.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-xs text-primary hover:text-primary/80 hover:underline"
                onClick={(e) => e.stopPropagation()}
                data-testid={`link-finding-${finding.id}`}
              >
                <ExternalLink className="h-3 w-3" />
                <span>NVD</span>
              </a>
            )}
          </div>
          
          <p className="mt-1 text-sm truncate">{finding.title}</p>
          <p className="text-xs text-muted-foreground mt-1">{finding.asset}</p>
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

interface FilteredFindingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  findings: SecurityFinding[];
  filterType: "severity" | "tool";
  filterValue?: SecuritySeverity | SecurityTool;
  onFindingClick: (finding: SecurityFinding) => void;
}

function FilteredFindingsSheet({ 
  open, 
  onOpenChange, 
  findings, 
  filterType, 
  filterValue,
  onFindingClick 
}: FilteredFindingsSheetProps) {
  const getTitle = () => {
    if (filterType === "severity" && filterValue) {
      const severity = filterValue as SecuritySeverity;
      return `${severity.charAt(0).toUpperCase() + severity.slice(1)} Severity Findings`;
    } else if (filterType === "tool" && filterValue) {
      return `${toolLabels[filterValue as SecurityTool]} Findings`;
    }
    return "Filtered Findings";
  };

  const getIcon = () => {
    if (filterType === "severity" && filterValue) {
      const severity = filterValue as SecuritySeverity;
      return <AlertTriangle className={cn("h-5 w-5", severityColors[severity])} />;
    } else if (filterType === "tool" && filterValue) {
      return <Shield className="h-5 w-5 text-primary" />;
    }
    return <Shield className="h-5 w-5 text-primary" />;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl font-mono overflow-y-auto" data-testid="filtered-findings-sheet">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </SheetTitle>
          <SheetDescription>
            {findings.length} finding{findings.length !== 1 ? "s" : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {findings.length === 0 ? (
            <Card className="p-6 text-center">
              <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-status-healthy" />
              <p className="text-muted-foreground">No findings match this filter</p>
            </Card>
          ) : (
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-2 pr-4">
                {findings.map((finding) => (
                  <VulnerabilityCard 
                    key={finding.id} 
                    finding={finding} 
                    onClick={() => onFindingClick(finding)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
