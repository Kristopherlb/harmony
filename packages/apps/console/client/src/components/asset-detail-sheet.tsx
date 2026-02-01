import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Server,
  Users,
  ExternalLink,
  AlertTriangle,
  Link2,
  Globe,
  Code,
  FileText,
} from "lucide-react";
import { SiJira, SiSlack } from "react-icons/si";
import type { Service, Team } from "@shared/schema";
import { useLocation } from "wouter";

interface AssetDetailSheetProps {
  assetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  securityFindingTitle?: string;
  securityFindingSeverity?: string;
}

interface AssetSearchResponse {
  services: Service[];
  teams: Team[];
  asset: string;
}

export function AssetDetailSheet({
  assetName,
  open,
  onOpenChange,
  securityFindingTitle,
  securityFindingSeverity,
}: AssetDetailSheetProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const assetQuery = useQuery<AssetSearchResponse>({
    queryKey: ["/api/services/search", { asset: assetName }],
    queryFn: async () => {
      const res = await fetch(`/api/services/search?asset=${encodeURIComponent(assetName)}`);
      if (!res.ok) throw new Error("Failed to fetch asset details");
      return res.json();
    },
    enabled: open && !!assetName,
  });

  const services = assetQuery.data?.services ?? [];
  const teams = assetQuery.data?.teams ?? [];
  const primaryService = services[0]; // First match is most likely
  const team = primaryService
    ? teams.find(t => t.id === primaryService.teamId)
    : null;

  // Infer environment from asset name or service tags
  const inferEnvironment = (): string => {
    const assetLower = assetName.toLowerCase();
    if (assetLower.includes("prod") || assetLower.includes("production")) return "Production";
    if (assetLower.includes("staging") || assetLower.includes("stage")) return "Staging";
    if (assetLower.includes("dev") || assetLower.includes("development")) return "Development";
    if (primaryService?.tags) {
      const envTag = primaryService.tags.find(tag => 
        ["prod", "production", "staging", "dev", "development"].includes(tag.toLowerCase())
      );
      if (envTag) return envTag.charAt(0).toUpperCase() + envTag.slice(1);
    }
    return "Unknown";
  };

  const environment = inferEnvironment();

  const jiraTicketMutation = useMutation({
    mutationFn: async () => {
      const summary = securityFindingTitle 
        ? `Security Finding: ${securityFindingTitle}`
        : `Security Issue on ${assetName}`;
      const description = `Security finding detected on asset: ${assetName}\n\n` +
        (primaryService ? `Service: ${primaryService.name}\n` : "") +
        (team ? `Team: ${team.name}\n` : "") +
        (securityFindingSeverity ? `Severity: ${securityFindingSeverity}\n` : "") +
        `\nPlease review and remediate.`;
      
      const res = await apiRequest("POST", "/api/integrations/slack/events", {
        command: "/ops",
        text: `blocker ${summary}\n\n${description}`,
        user_id: "system",
        user_name: "Security System",
        channel_id: "C123456",
        channel_name: "ops-channel",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Jira Ticket Created",
        description: "A ticket has been created for the team to review.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create Jira ticket",
        variant: "destructive",
      });
    },
  });

  const handleCreateJiraTicket = () => {
    jiraTicketMutation.mutate();
  };

  const handleViewService = (serviceId: string) => {
    setLocation(`/services/${serviceId}`);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg font-mono overflow-y-auto" data-testid="asset-detail-sheet">
        <SheetHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-primary" />
            <div>
              <SheetTitle className="text-lg font-semibold">
                Asset Details
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-1">
                {assetName}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="mt-6 h-[calc(100vh-160px)]">
          <div className="space-y-6 pr-4">
            {assetQuery.isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <>
                <AssetOverview
                  assetName={assetName}
                  environment={environment}
                  service={primaryService}
                  team={team}
                />
                
                {primaryService && (
                  <>
                    <Separator />
                    <ServiceDetails
                      service={primaryService}
                      onViewService={() => handleViewService(primaryService.id)}
                    />
                  </>
                )}

                {team && (
                  <>
                    <Separator />
                    <TeamDetails team={team} />
                  </>
                )}

                <Separator />
                <ActionsSection
                  service={primaryService}
                  team={team}
                  assetName={assetName}
                  onCreateJiraTicket={handleCreateJiraTicket}
                  isCreatingTicket={jiraTicketMutation.isPending}
                />
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function AssetOverview({
  assetName,
  environment,
  service,
  team,
}: {
  assetName: string;
  environment: string;
  service?: Service;
  team?: Team;
}) {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Overview
      </h4>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Globe className="h-3 w-3" />
            <span>Environment</span>
          </div>
          <div className="font-semibold text-sm">{environment}</div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Server className="h-3 w-3" />
            <span>Service</span>
          </div>
          <div className="font-semibold text-sm truncate" title={service?.name || "Not found"}>
            {service?.name || "Unknown"}
          </div>
        </Card>

        {team && (
          <Card className="p-3 col-span-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Users className="h-3 w-3" />
              <span>Owning Team</span>
            </div>
            <div className="font-semibold text-sm">{team.name}</div>
          </Card>
        )}
      </div>
    </div>
  );
}

function ServiceDetails({
  service,
  onViewService,
}: {
  service: Service;
  onViewService: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Service Information
        </h4>
        <Button
          variant="outline"
          size="sm"
          onClick={onViewService}
          className="text-xs"
        >
          <Link2 className="h-3 w-3 mr-1" />
          View in Catalog
        </Button>
      </div>

      <Card className="p-4">
        <div className="space-y-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Name</div>
            <div className="font-semibold">{service.name}</div>
          </div>

          {service.description && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Description</div>
              <div className="text-sm">{service.description}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Type</div>
              <Badge variant="outline" className="text-xs">
                {service.type}
              </Badge>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Tier</div>
              <Badge variant="outline" className="text-xs">
                {service.tier}
              </Badge>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Health</div>
              <Badge
                variant={
                  service.health === "healthy"
                    ? "default"
                    : service.health === "degraded"
                    ? "secondary"
                    : "destructive"
                }
                className="text-xs"
              >
                {service.health}
              </Badge>
            </div>
            {service.version && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Version</div>
                <div className="text-sm font-mono">{service.version}</div>
              </div>
            )}
          </div>

          {service.tags && service.tags.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-2">Tags</div>
              <div className="flex flex-wrap gap-1">
                {service.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            {service.repositoryUrl && (
              <Button variant="outline" size="sm" asChild className="text-xs">
                <a href={service.repositoryUrl} target="_blank" rel="noopener noreferrer">
                  <Code className="h-3 w-3 mr-1" />
                  Repository
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            )}
            {service.documentationUrl && (
              <Button variant="outline" size="sm" asChild className="text-xs">
                <a href={service.documentationUrl} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-3 w-3 mr-1" />
                  Docs
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            )}
            {service.dashboardUrl && (
              <Button variant="outline" size="sm" asChild className="text-xs">
                <a href={service.dashboardUrl} target="_blank" rel="noopener noreferrer">
                  <Link2 className="h-3 w-3 mr-1" />
                  Dashboard
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function TeamDetails({ team }: { team: Team }) {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Team Information
      </h4>

      <Card className="p-4">
        <div className="space-y-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Team Name</div>
            <div className="font-semibold">{team.name}</div>
          </div>

          {team.lead && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Team Lead</div>
              <div className="text-sm">{team.lead}</div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            {team.slackChannel && (
              <Button variant="outline" size="sm" asChild className="text-xs">
                <a href={`https://slack.com/channels/${team.slackChannel.replace("#", "")}`} target="_blank" rel="noopener noreferrer">
                  <SiSlack className="h-3 w-3 mr-1" />
                  {team.slackChannel}
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            )}
            {team.oncallRotation && (
              <Badge variant="secondary" className="text-xs">
                On-call: {team.oncallRotation}
              </Badge>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function ActionsSection({
  service,
  team,
  assetName,
  onCreateJiraTicket,
  isCreatingTicket,
}: {
  service?: Service;
  team?: Team;
  assetName: string;
  onCreateJiraTicket: () => void;
  isCreatingTicket: boolean;
}) {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <AlertTriangle className="h-3 w-3" />
        Actions
      </h4>

      <Card className="p-4 border-status-degraded/30 bg-status-degraded/5">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold mb-2">Create Jira Ticket</p>
            <p className="text-xs text-muted-foreground mb-3">
              Generate a Jira ticket for {team?.name || "the team"} to review and remediate this security finding.
            </p>
            <Button
              onClick={onCreateJiraTicket}
              disabled={isCreatingTicket}
              className="w-full"
              size="sm"
            >
              <SiJira className="h-4 w-4 mr-2" />
              {isCreatingTicket ? "Creating..." : "Create Jira Ticket"}
            </Button>
          </div>

          {team?.slackChannel && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Contact Team</p>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full"
              >
                <a href={`https://slack.com/channels/${team.slackChannel.replace("#", "")}`} target="_blank" rel="noopener noreferrer">
                  <SiSlack className="h-4 w-4 mr-2" />
                  Open {team.slackChannel}
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </a>
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
