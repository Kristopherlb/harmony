import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import type { SecurityFinding, SecurityTool, SecuritySeverity } from "@shared/schema";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusIndicator } from "./status-indicator";
import { AssetDetailSheet } from "./asset-detail-sheet";
import {
  ExternalLink,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Server,
  Bug,
  Link2,
  FileText,
  BarChart3,
} from "lucide-react";

interface SecurityFindingDetailProps {
  finding: SecurityFinding | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const toolLabels: Record<SecurityTool, string> = {
  wiz: "Wiz",
  aws_inspector: "AWS Inspector",
  artifactory_xray: "JFrog Xray",
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

export function SecurityFindingDetail({ finding, open, onOpenChange }: SecurityFindingDetailProps) {
  const [assetDetailOpen, setAssetDetailOpen] = useState(false);
  
  if (!finding) return null;

  const cveUrl = finding.cve ? `https://nvd.nist.gov/vuln/detail/${finding.cve}` : null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg font-mono overflow-y-auto" data-testid="security-finding-detail">
          <SheetHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <Shield className={`h-5 w-5 ${severityColors[finding.severity]}`} />
              <div>
                <SheetTitle className="text-lg font-semibold">
                  Security Finding
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-1">
                  Detected by {toolLabels[finding.tool]}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="mt-6 h-[calc(100vh-160px)]">
            <div className="space-y-6 pr-4">
              <FindingHeader finding={finding} />
              <Separator />
              <FindingDetails finding={finding} onAssetClick={() => setAssetDetailOpen(true)} />
              <Separator />
              <VulnerabilityInfo finding={finding} cveUrl={cveUrl} />
              {(finding.externalLink || cveUrl) && (
                <>
                  <Separator />
                  <ExternalResources finding={finding} cveUrl={cveUrl} />
                </>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <AssetDetailSheet
        assetName={finding.asset}
        open={assetDetailOpen}
        onOpenChange={setAssetDetailOpen}
        securityFindingTitle={finding.title}
        securityFindingSeverity={finding.severity}
      />
    </>
  );
}

function FindingHeader({ finding }: { finding: SecurityFinding }) {
  return (
    <div className="space-y-4">
      <Card className={`p-4 border ${
        finding.severity === "critical" ? "border-status-critical/50 bg-status-critical/5" :
        finding.severity === "high" ? "border-risk-high/50 bg-risk-high/5" :
        "border-border"
      }`}>
        <div className="flex items-start justify-between mb-3">
          <Badge variant={severityBadgeVariants[finding.severity]} className="uppercase text-xs">
            {finding.severity}
          </Badge>
          <Badge variant="outline" className={toolColors[finding.tool]}>
            {toolLabels[finding.tool]}
          </Badge>
        </div>
        <h3 className="font-semibold text-lg mb-2">{finding.title}</h3>
        {finding.cve && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bug className="h-4 w-4" />
            <code className="bg-muted px-2 py-0.5 rounded">{finding.cve}</code>
          </div>
        )}
      </Card>
    </div>
  );
}

function FindingDetails({ finding, onAssetClick }: { finding: SecurityFinding; onAssetClick: () => void }) {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Finding Details
      </h4>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <AlertTriangle className="h-3 w-3" />
            <span>Severity</span>
          </div>
          <div className={`flex items-center gap-2 ${severityColors[finding.severity]}`}>
            <StatusIndicator 
              severity={finding.severity === "critical" || finding.severity === "high" ? finding.severity : "medium"} 
              size="sm" 
            />
            <span className="font-semibold capitalize">{finding.severity}</span>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>Status</span>
          </div>
          <div className={`font-semibold capitalize ${
            finding.status === "resolved" ? "text-status-healthy" : 
            finding.status === "ignored" ? "text-muted-foreground" : 
            "text-status-degraded"
          }`}>
            {finding.status}
          </div>
        </Card>

        <Card 
          className="p-3 cursor-pointer hover:bg-muted/50 transition-colors group" 
          onClick={onAssetClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onAssetClick();
            }
          }}
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Server className="h-3 w-3" />
            <span>Affected Asset</span>
            <Link2 className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="font-semibold text-sm truncate" title={finding.asset}>
            {finding.asset}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Click to view details</div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Clock className="h-3 w-3" />
            <span>Detected</span>
          </div>
          <div className="font-semibold text-sm">
            {formatDistanceToNow(new Date(finding.detectedAt), { addSuffix: true })}
          </div>
        </Card>
      </div>

      {finding.description && (
        <Card className="p-4">
          <h5 className="text-xs text-muted-foreground mb-2">Description</h5>
          <p className="text-sm leading-relaxed">{finding.description}</p>
        </Card>
      )}
    </div>
  );
}

function VulnerabilityInfo({ finding, cveUrl }: { finding: SecurityFinding; cveUrl: string | null }) {
  if (!finding.cve) return null;

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Bug className="h-3 w-3" />
        Vulnerability Information
      </h4>

      <Card className="p-4 bg-muted/30">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">CVE ID</span>
            <code className="text-sm font-semibold bg-muted px-2 py-0.5 rounded">{finding.cve}</code>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Detection Source</span>
            <span className={`text-sm font-semibold ${toolColors[finding.tool]}`}>
              {toolLabels[finding.tool]}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">First Detected</span>
            <span className="text-sm">
              {format(new Date(finding.detectedAt), "MMM d, yyyy")}
            </span>
          </div>
        </div>
      </Card>

      <Card className="p-3 border-status-degraded/30 bg-status-degraded/5">
        <div className="flex items-start gap-2 text-xs">
          <AlertTriangle className="h-4 w-4 text-status-degraded mt-0.5" />
          <div>
            <p className="font-semibold text-status-degraded mb-1">Remediation Required</p>
            <p className="text-muted-foreground">
              Review the CVE details and apply the recommended patches or mitigations.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ExternalResources({ finding, cveUrl }: { finding: SecurityFinding; cveUrl: string | null }) {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Link2 className="h-3 w-3" />
        External Resources
      </h4>

      <div className="space-y-2">
        {cveUrl && (
          <Button className="w-full justify-start" variant="outline" asChild>
            <a href={cveUrl} target="_blank" rel="noopener noreferrer" data-testid="link-cve-database">
              <Bug className="h-4 w-4 mr-2" />
              View in NVD Database
              <ExternalLink className="h-3 w-3 ml-auto" />
            </a>
          </Button>
        )}

        {finding.externalLink && (
          <Button className="w-full justify-start" variant="outline" asChild>
            <a href={finding.externalLink} target="_blank" rel="noopener noreferrer" data-testid="link-tool-dashboard">
              <BarChart3 className="h-4 w-4 mr-2" />
              View in {toolLabels[finding.tool]}
              <ExternalLink className="h-3 w-3 ml-auto" />
            </a>
          </Button>
        )}

        <Button className="w-full justify-start" variant="outline" asChild>
          <a 
            href={`https://www.google.com/search?q=${encodeURIComponent(finding.cve || finding.title)}`} 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <FileText className="h-4 w-4 mr-2" />
            Search for Remediation Guides
            <ExternalLink className="h-3 w-3 ml-auto" />
          </a>
        </Button>
      </div>
    </div>
  );
}
