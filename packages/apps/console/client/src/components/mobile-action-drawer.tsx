import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Event, Action, UserRole } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SlideToConfirm } from "@/components/slide-to-confirm";
import { useToast } from "@/hooks/use-toast";
import {
  Play,
  Clock,
  AlertTriangle,
  Server,
  RefreshCw,
  Database,
  Rocket,
  TrendingUp,
  Trash2,
  Zap,
  HardDrive,
  Wrench,
  ChevronUp,
} from "lucide-react";

interface MobileActionDrawerProps {
  event: Event | null;
  actions: Action[];
  userRole: UserRole;
}

const ICON_MAP: Record<string, any> = {
  server: Server,
  "refresh-cw": RefreshCw,
  database: Database,
  rocket: Rocket,
  "trending-up": TrendingUp,
  "trash-2": Trash2,
  "hard-drive": HardDrive,
  wrench: Wrench,
};

const RISK_COLORS: Record<string, string> = {
  low: "bg-risk-low/20 text-risk-low border-risk-low/30",
  medium: "bg-risk-medium/20 text-risk-medium border-risk-medium/30",
  high: "bg-risk-high/20 text-risk-high border-risk-high/30",
  critical: "bg-risk-critical/20 text-risk-critical border-risk-critical/30",
};

const RISK_LEVEL_ORDER = ["low", "medium", "high", "critical"];

function calculateRelevanceScore(action: Action, event: Event): number {
  let score = 0;
  if (action.targetServices && event.serviceTags) {
    const matchingServices = action.targetServices.filter(
      (service) => event.serviceTags.includes(service)
    );
    score += matchingServices.length * 10;
  }
  if (action.contextTypes && action.contextTypes.includes(event.contextType)) {
    score += 20;
  }
  const isGlobalAction = !action.targetServices || action.targetServices.length === 0;
  if (isGlobalAction) {
    score -= 5;
  }
  return score;
}

function filterAndSortActions(actions: Action[], event: Event | null, userRole: UserRole): Action[] {
  const ROLE_RISK_LEVELS: Record<UserRole, string[]> = {
    viewer: [],
    dev: ["low", "medium"],
    sre: ["low", "medium", "high"],
    admin: ["low", "medium", "high", "critical"],
  };

  const allowedRiskLevels = ROLE_RISK_LEVELS[userRole];
  
  const filtered = actions.filter((action) => {
    if (!action.requiredRoles.includes(userRole)) return false;
    if (!allowedRiskLevels.includes(action.riskLevel)) return false;
    return true;
  });

  if (!event) {
    return filtered.sort((a, b) => {
      const riskDiff = RISK_LEVEL_ORDER.indexOf(a.riskLevel) - RISK_LEVEL_ORDER.indexOf(b.riskLevel);
      if (riskDiff !== 0) return riskDiff;
      return a.name.localeCompare(b.name);
    });
  }

  return filtered
    .map((action) => ({
      action,
      score: calculateRelevanceScore(action, event),
    }))
    .filter(({ action, score }) => score > 0 || (!action.targetServices || action.targetServices.length === 0))
    .sort((a, b) => b.score - a.score)
    .map(({ action }) => action);
}

export function MobileActionDrawer({
  event,
  actions,
  userRole,
}: MobileActionDrawerProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [actionParams, setActionParams] = useState<Record<string, any>>({});
  const [reasoning, setReasoning] = useState("");

  const executeMutation = useMutation({
    mutationFn: async (payload: { actionId: string; params: Record<string, any>; reasoning: string }) => {
      const res = await apiRequest("POST", "/api/actions/execute", payload);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" &&
          String(q.queryKey[0]).startsWith("/api/actions/executions"),
      });
      queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" &&
          String(q.queryKey[0]).startsWith("/api/actions/approvals/pending"),
      });
      
      if (data.requiresApproval) {
        toast({
          title: "Approval Required",
          description: `Action "${selectedAction?.name}" requires approval.`,
        });
      } else {
        toast({
          title: "Action Started",
          description: `Executing "${selectedAction?.name}"...`,
        });
      }
      
      setSelectedAction(null);
      setActionParams({});
      setReasoning("");
      setIsOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Execution Failed",
        description: error instanceof Error ? error.message : "Failed to execute action",
        variant: "destructive",
      });
    },
  });

  const sortedActions = filterAndSortActions(actions, event, userRole);
  const contextualActions = event 
    ? sortedActions.filter(a => calculateRelevanceScore(a, event) > 0)
    : [];
  const actionsCount = sortedActions.length;

  const handleExecute = () => {
    if (!selectedAction) return;
    executeMutation.mutate({
      actionId: selectedAction.id,
      params: actionParams,
      reasoning,
    });
  };

  const isCriticalAction = selectedAction?.riskLevel === "critical" || selectedAction?.riskLevel === "high";

  const renderActionItem = (action: Action, isContextual: boolean = false) => {
    const Icon = ICON_MAP[action.icon || "server"] || Server;
    const matchingTags = event?.serviceTags?.filter(tag => 
      action.targetServices?.includes(tag)
    ) || [];

    return (
      <div
        key={action.id}
        className={cn(
          "p-3 rounded-lg border cursor-pointer hover-elevate transition-all",
          isContextual && "border-primary/30 bg-primary/5",
          selectedAction?.id === action.id && "ring-2 ring-primary"
        )}
        onClick={() => {
          setSelectedAction(action);
          setActionParams({});
          setReasoning(event ? `Triggered for: ${event.message.slice(0, 50)}...` : "");
        }}
        data-testid={`mobile-action-${action.id}`}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">{action.name}</span>
              <Badge className={cn("text-[10px]", RISK_COLORS[action.riskLevel])}>
                {action.riskLevel}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {action.description}
            </p>
            {matchingTags.length > 0 && (
              <div className="flex items-center gap-1 mt-1.5">
                <Zap className="h-3 w-3 text-primary" />
                <span className="text-[10px] text-primary font-medium">
                  Matches: {matchingTags.join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div 
        className="fixed bottom-0 left-0 right-0 md:hidden bg-card border-t border-border p-3 z-40"
        data-testid="mobile-action-bar"
      >
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="default" 
              className="w-full gap-2"
              data-testid="button-open-actions"
            >
              <Wrench className="h-4 w-4" />
              Available Runbooks
              {actionsCount > 0 && (
                <Badge variant="secondary" className="ml-auto">
                  {contextualActions.length > 0 
                    ? `${contextualActions.length} recommended` 
                    : actionsCount}
                </Badge>
              )}
              <ChevronUp className="h-4 w-4" />
            </Button>
          </SheetTrigger>

          <SheetContent side="bottom" className="h-[85vh] rounded-t-xl">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                {selectedAction ? selectedAction.name : "Available Runbooks"}
              </SheetTitle>
            </SheetHeader>

            <ScrollArea className="h-[calc(100%-4rem)] mt-4">
              {!selectedAction ? (
                <div className="space-y-4">
                  {event && contextualActions.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <Zap className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold text-primary">
                          Recommended for this signal
                        </span>
                      </div>
                      <div className="space-y-2">
                        {contextualActions.map((action) => renderActionItem(action, true))}
                      </div>
                    </div>
                  )}

                  {sortedActions.filter(a => !event || calculateRelevanceScore(a, event) <= 0).length > 0 && (
                    <div>
                      {event && contextualActions.length > 0 && (
                        <span className="text-sm font-semibold text-muted-foreground mb-3 block">
                          Other Actions
                        </span>
                      )}
                      <div className="space-y-2">
                        {sortedActions
                          .filter(a => !event || calculateRelevanceScore(a, event) <= 0)
                          .map((action) => renderActionItem(action, false))}
                      </div>
                    </div>
                  )}

                  {sortedActions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No actions available for your role
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 pb-20">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedAction(null)}
                    className="mb-2"
                  >
                    Back to actions
                  </Button>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={RISK_COLORS[selectedAction.riskLevel]}>
                      {selectedAction.riskLevel} risk
                    </Badge>
                    {isCriticalAction && (
                      <Badge variant="outline" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Requires Approval
                      </Badge>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {selectedAction.estimatedDuration || "Unknown"}
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {selectedAction.description}
                  </p>

                  {selectedAction.requiredParams.map((param) => (
                    <div key={param.name} className="space-y-1.5">
                      <Label htmlFor={`mobile-param-${param.name}`}>
                        {param.label}
                        {param.required && <span className="text-destructive ml-0.5">*</span>}
                      </Label>
                      
                      {param.type === "select" && param.options ? (
                        <Select
                          value={actionParams[param.name] || ""}
                          onValueChange={(value) =>
                            setActionParams((p) => ({ ...p, [param.name]: value }))
                          }
                        >
                          <SelectTrigger data-testid={`mobile-input-${param.name}`}>
                            <SelectValue placeholder={param.placeholder || "Select..."} />
                          </SelectTrigger>
                          <SelectContent>
                            {param.options.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : param.type === "boolean" ? (
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`mobile-param-${param.name}`}
                            checked={actionParams[param.name] || false}
                            onCheckedChange={(checked) =>
                              setActionParams((p) => ({ ...p, [param.name]: checked }))
                            }
                            data-testid={`mobile-input-${param.name}`}
                          />
                          <Label htmlFor={`mobile-param-${param.name}`} className="text-sm text-muted-foreground">
                            {param.placeholder || "Enable"}
                          </Label>
                        </div>
                      ) : (
                        <Input
                          id={`mobile-param-${param.name}`}
                          type={param.type === "number" ? "number" : "text"}
                          placeholder={param.placeholder}
                          value={actionParams[param.name] || ""}
                          onChange={(e) =>
                            setActionParams((p) => ({ ...p, [param.name]: e.target.value }))
                          }
                          data-testid={`mobile-input-${param.name}`}
                        />
                      )}
                    </div>
                  ))}

                  <div className="space-y-1.5">
                    <Label htmlFor="mobile-reasoning">
                      Reasoning <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="mobile-reasoning"
                      placeholder="Why are you running this action?"
                      value={reasoning}
                      onChange={(e) => setReasoning(e.target.value)}
                      className="min-h-[80px]"
                      data-testid="mobile-input-reasoning"
                    />
                  </div>

                  <div className="pt-4">
                    {isCriticalAction ? (
                      <SlideToConfirm
                        onConfirm={handleExecute}
                        label={`Slide to Run ${selectedAction.name}`}
                        confirmLabel="Executing..."
                        variant="critical"
                        disabled={reasoning.length < 10}
                        loading={executeMutation.isPending}
                      />
                    ) : (
                      <Button
                        className="w-full gap-2"
                        onClick={handleExecute}
                        disabled={executeMutation.isPending || reasoning.length < 10}
                        data-testid="mobile-button-execute"
                      >
                        <Play className="h-4 w-4" />
                        Execute Action
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>

      <div className="h-16 md:hidden" />
    </>
  );
}
