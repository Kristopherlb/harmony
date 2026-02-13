import React, { useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { Send, Bot, User, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BlueprintDraft } from "@/features/workbench/types";
import {
  getDraftFromAssistantMessage,
  getExplainStepFromMessage,
  getMessageText,
  getSuggestedTemplateIdFromMessage,
} from "@/features/workbench/chat-utils";
import { emitWorkbenchEvent } from "@/lib/workbench-telemetry";
import { useLocation } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAccountPreferences } from "@/features/account/use-account-preferences";

interface AgentChatPanelProps {
  onDraftGenerated: (draft: BlueprintDraft) => void;
  externalSendText?: string | null;
  onExternalSendComplete?: () => void;
  /** Current draft for agent context (iteration, explanation). Sent with chat requests. */
  currentDraft?: BlueprintDraft | null;
  /** Active workflow run ID for status/cancel queries (Phase 4.3.3) */
  activeWorkflowId?: string | null;
}

type ChatUiState = "idle" | "sending" | "streaming" | "error";

function deriveChatUiState(input: { status: string; error: unknown }): ChatUiState {
  if (input.error) return "error";
  if (input.status === "submitted") return "sending";
  if (input.status === "streaming") return "streaming";
  return "idle";
}

function chatStateLabel(state: ChatUiState): string {
  if (state === "sending") return "Sending";
  if (state === "streaming") return "Streaming";
  if (state === "error") return "Error";
  return "Idle";
}

type ChatMode = "drafting" | "iterating" | "template" | "monitoring";
type RecommendationDiagnostics = {
  intent: string;
  weights: Record<string, number>;
  lastSelection: {
    primary: { recipeId: string; score: number } | null;
    alternatives: Array<{ recipeId: string; score: number; tradeoff: string }>;
    rationale: string[];
    selectedAt: string;
    recommendedTools?: string[];
  } | null;
};

function deriveChatMode(input: {
  activeWorkflowId?: string | null;
  templateDialogOpen: boolean;
  currentDraft?: BlueprintDraft | null;
}): ChatMode {
  if (input.activeWorkflowId) return "monitoring";
  if (input.templateDialogOpen) return "template";
  if (input.currentDraft) return "iterating";
  return "drafting";
}

function chatModeLabel(mode: ChatMode): string {
  if (mode === "monitoring") return "Monitoring";
  if (mode === "template") return "Template";
  if (mode === "iterating") return "Iterating";
  return "Drafting";
}

export function AgentChatPanel({
  onDraftGenerated,
  externalSendText,
  onExternalSendComplete,
  currentDraft,
  activeWorkflowId,
}: AgentChatPanelProps) {
  const [inputValue, setInputValue] = React.useState("");
  const lastProcessedAssistantMessageId = React.useRef<string | null>(null);
  const lastProcessedExternalText = React.useRef<string | null>(null);
  const lastProcessedTemplateSuggestionMessageId = React.useRef<string | null>(null);
  const lastUserSendStartedAtRef = React.useRef<number | null>(null);
  const lastUserMessageLengthRef = React.useRef<number | null>(null);
  const [, setLocation] = useLocation();
  const prefs = useAccountPreferences();
  const budgetKeyOverride = prefs.defaultBudgetKey;
  const [budgetDialogOpen, setBudgetDialogOpen] = React.useState(false);
  const [draftBudgetKey, setDraftBudgetKey] = React.useState<string>(budgetKeyOverride ?? "");
  const [draftHardLimitUsd, setDraftHardLimitUsd] = React.useState<string>("");
  const [draftBudgetWindow, setDraftBudgetWindow] = React.useState<"run" | "day">("run");
  const [budgetSaveStatus, setBudgetSaveStatus] = React.useState<"idle" | "saving" | "error">("idle");
  const [budgetSaveError, setBudgetSaveError] = React.useState<string | null>(null);

  const [costSnapshot, setCostSnapshot] = React.useState<{
    budgetKey: string;
    totals: { usd: number; inputTokens: number; outputTokens: number };
    policy: { hardLimitUsd: number; window: string } | null;
  } | null>(null);

  // Best-effort polling for spend totals (UI-only; does not affect determinism).
  React.useEffect(() => {
    setDraftBudgetKey(budgetKeyOverride ?? "");
  }, [budgetKeyOverride]);

  React.useEffect(() => {
    if (process.env.NODE_ENV === "test") return;
    if (typeof fetch !== "function") return;

    let cancelled = false;
    const url =
      budgetKeyOverride && budgetKeyOverride.trim().length > 0
        ? `/api/workbench/cost?budgetKey=${encodeURIComponent(budgetKeyOverride)}`
        : "/api/workbench/cost";

    async function load() {
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) return;
        const json = (await res.json()) as any;
        if (!cancelled && json && typeof json.budgetKey === "string" && json.totals) {
          setCostSnapshot({
            budgetKey: json.budgetKey,
            totals: {
              usd: Number(json.totals.usd ?? 0),
              inputTokens: Number(json.totals.inputTokens ?? 0),
              outputTokens: Number(json.totals.outputTokens ?? 0),
            },
            policy: json.policy ?? null,
          });
        }
      } catch {
        // ignore
      }
    }

    void load();
    const t = window.setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [budgetKeyOverride]);

  const [templateSuggestion, setTemplateSuggestion] = React.useState<{
    templateId: string;
    messageId: string;
  } | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = React.useState(false);
  const [recommendationDiagnostics, setRecommendationDiagnostics] = React.useState<RecommendationDiagnostics | null>(null);
  const [feedbackState, setFeedbackState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");

    // CORRECT API USAGE STATMENT:
    // Verified via node_modules/@ai-sdk/react/dist/index.d.ts (v3.0.66):
    // useChat returns UseChatHelpers which ONLY contains:
    // { id, setMessages, error, sendMessage, regenerate, stop, resumeStream, status, messages, clearError }
    // It DOES NOT contain: input, handleInputChange, handleSubmit, append, isLoading.
  const { messages, sendMessage, status, error, setMessages, clearError } = useChat({
    api: "/api/chat",
    body: {
      currentDraft: currentDraft ?? undefined,
      activeWorkflowId: activeWorkflowId ?? undefined,
      budgetKeyOverride: budgetKeyOverride ?? undefined,
    },
    onFinish: ({ message }) => {
      const startedAt = lastUserSendStartedAtRef.current;
      const durationMs = typeof startedAt === "number" ? Math.max(0, Date.now() - startedAt) : undefined;
      const draft = getDraftFromAssistantMessage(message as any);
      if (draft) onDraftGenerated(draft);

      // Phase 4.5 telemetry: treat a successfully parsed draft as a tool invocation success.
      if (draft) {
        emitWorkbenchEvent({
          event: "workbench.chat_tool_invoked",
          toolId: "proposeWorkflow",
          success: true,
          durationMs,
          messageLength: lastUserMessageLengthRef.current ?? undefined,
        }).catch(() => {});
      }
    },
    onError: (error) => {
      console.error("Chat error:", error);
      emitWorkbenchEvent({
        event: "workbench.chat_tool_invoked",
        toolId: "proposeWorkflow",
        success: false,
      }).catch(() => {});
    },
  });

    // Derive isLoading from status
  const isLoading = status === "streaming" || status === "submitted";
  const uiState = deriveChatUiState({ status, error });
  const mode = deriveChatMode({ activeWorkflowId, templateDialogOpen, currentDraft });

  const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
  useEffect(() => {
    const el = scrollRef.current as any;
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (typeof fetch !== "function") return;
    const latestAssistant = [...messages].reverse().find((m: any) => m?.role === "assistant");
    if (!latestAssistant) return;

    let cancelled = false;
    async function loadRecommendationDiagnostics() {
      try {
        const res = await fetch("/api/workbench/recommendation-diagnostics?intent=workflow_generation", {
          credentials: "include",
        });
        if (!res.ok) return;
        const json = (await res.json()) as RecommendationDiagnostics;
        if (!cancelled) {
          setRecommendationDiagnostics(json);
          setFeedbackState("idle");
        }
      } catch {
        // Best-effort diagnostics surface.
      }
    }
    void loadRecommendationDiagnostics();
    return () => {
      cancelled = true;
    };
  }, [messages]);

  async function submitRecipeFeedback(feedback: "up" | "down"): Promise<void> {
    const recipeId = recommendationDiagnostics?.lastSelection?.primary?.recipeId;
    if (!recipeId) return;
    setFeedbackState("saving");
    try {
      const res = await fetch("/api/workbench/recipe-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          intent: recommendationDiagnostics?.intent ?? "workflow_generation",
          recipeId,
          feedback,
        }),
      });
      if (!res.ok) {
        setFeedbackState("error");
        return;
      }
      setFeedbackState("saved");
      emitWorkbenchEvent({
        event: "workbench.recipe_feedback",
        status: feedback,
        recipeId,
        intent: recommendationDiagnostics?.intent ?? "workflow_generation",
      }).catch(() => {});
    } catch {
      setFeedbackState("error");
    }
  }

  useEffect(() => {
    if (!externalSendText) return;
    if (isLoading) return;
    if (lastProcessedExternalText.current === externalSendText) return;

    lastProcessedExternalText.current = externalSendText;
    sendMessage({ text: externalSendText })
      .catch(() => {
        // surface errors via existing onError handler
      })
      .finally(() => {
        onExternalSendComplete?.();
      });
  }, [externalSendText, isLoading, onExternalSendComplete, sendMessage]);

    // Reliable draft extraction: watch the latest assistant message and parse JSON.
  useEffect(() => {
    const latest = [...messages].reverse().find((m: any) => m?.role === "assistant");
    if (!latest?.id) return;
    if (lastProcessedAssistantMessageId.current === latest.id) return;

    const draft = getDraftFromAssistantMessage(latest);
    if (!draft) return;

    lastProcessedAssistantMessageId.current = latest.id;
    onDraftGenerated(draft);
  }, [messages, onDraftGenerated]);

  // Phase 4.6 / IMP-046: Template suggestion confirmation flow.
  useEffect(() => {
    const latest = [...messages].reverse().find((m: any) => m?.role === "assistant");
    if (!latest?.id) return;
    if (lastProcessedTemplateSuggestionMessageId.current === latest.id) return;

    const templateId = getSuggestedTemplateIdFromMessage(latest);
    if (!templateId) return;

    lastProcessedTemplateSuggestionMessageId.current = latest.id;
    setTemplateSuggestion({ templateId, messageId: latest.id });
    setTemplateDialogOpen(true);
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    lastUserSendStartedAtRef.current = Date.now();
    lastUserMessageLengthRef.current = inputValue.length;
    emitWorkbenchEvent({
      event: "workbench.chat_message_sent",
      messageLength: inputValue.length,
      hasAttachment: false,
    }).catch(() => {});

    await sendMessage({ text: inputValue });

    setInputValue("");
  };

  return (
    <Card
      className="h-full flex flex-col border-0 rounded-none bg-slate-50/50 dark:bg-slate-950/50"
      data-testid="workbench-chat-panel"
    >
      <CardHeader className="px-4 py-3 border-b bg-background">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            AI Agent
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant={uiState === "error" ? "destructive" : uiState === "idle" ? "secondary" : "default"}
              className="text-xs font-normal"
              data-testid="workbench-chat-state"
              title={`useChat.status=${status}`}
            >
              {chatStateLabel(uiState)}
            </Badge>
            <Badge variant="secondary" className="text-xs font-normal" data-testid="workbench-chat-mode">
              {chatModeLabel(mode)}
            </Badge>
            <Badge variant="secondary" className="text-xs font-normal">
              gpt-4o
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono">
              budget:{(budgetKeyOverride ?? costSnapshot?.budgetKey ?? "session").slice(0, 28)}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono" data-testid="workbench-chat-cost">
              usd:{(costSnapshot?.totals?.usd ?? 0).toFixed(4)}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setBudgetDialogOpen(true)}
              data-testid="workbench-chat-budget-settings"
              disabled={isLoading}
              title="Configure budget key and policy"
            >
              Budget
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={isLoading}
              onClick={() => {
                try {
                  clearError?.();
                } catch {
                  // ignore
                }
                try {
                  setMessages?.([]);
                } catch {
                  // ignore
                }
                setInputValue("");
                setTemplateDialogOpen(false);
                setTemplateSuggestion(null);
              }}
              data-testid="workbench-chat-new"
              title="Start a new conversation"
            >
              New
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden relative flex flex-col">
        <ScrollArea className="flex-1 p-4" data-testid="workbench-chat-messages">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8 text-sm">
                <Wand2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>How can I help you build a workflow today?</p>
              </div>
            )}

            {messages.map((m: any) =>
              (() => {
                const isUser = m.role === "user";
                const draft = !isUser ? getDraftFromAssistantMessage(m) : null;
                const explainStep = !isUser ? getExplainStepFromMessage(m) : null;
                const content = getMessageText(m).trim();
                const cleanedContent = content.replace(/<templateId>[\s\S]*?<\/templateId>/gi, "").trim();

                // Avoid a dead/blank assistant bubble. If the assistant produced a draft via tools,
                // show a human-friendly summary even if there's no text.
                if (!isUser && content.length === 0 && draft) {
                  return (
                    <div key={m.id} className="flex items-start gap-3">
                      <Avatar className="w-8 h-8 border">
                        <AvatarFallback className="bg-muted">
                          <Bot className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="rounded-lg p-3 text-sm max-w-[85%] bg-background border shadow-sm">
                        <div className="font-semibold">Generated draft</div>
                        <div className="mt-1 text-muted-foreground">
                          {draft.title} ({draft.nodes.length} steps)
                        </div>
                        {draft.summary && (
                          <div className="mt-2 text-muted-foreground">{draft.summary}</div>
                        )}
                      </div>
                    </div>
                  );
                }

                // Show explainStep output when present (Phase 4.2.3)
                const displayContent =
                  cleanedContent || (explainStep ? explainStep.explanation : "") || "";

                return (
                  <div
                    key={m.id}
                    className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}
                  >
                    <Avatar className="w-8 h-8 border">
                      <AvatarFallback
                        className={
                          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
                        }
                      >
                        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={`rounded-lg p-3 text-sm max-w-[85%] ${
                        isUser ? "bg-primary text-primary-foreground" : "bg-background border shadow-sm"
                      }`}
                    >
                      {displayContent}
                    </div>
                  </div>
                );
              })()
            )}
            {isLoading && (
              <div className="flex items-start gap-3">
                <Avatar className="w-8 h-8 border">
                  <AvatarFallback className="bg-muted">
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-lg p-3 text-sm max-w-[85%] bg-background border shadow-sm text-muted-foreground">
                  Generating draft…
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="p-4 bg-background border-t">
          {recommendationDiagnostics?.lastSelection?.primary ? (
            <div
              className="mb-3 rounded-md border bg-muted/40 px-3 py-2 text-xs"
              data-testid="workbench-recipe-feedback"
            >
              <div className="font-medium">
                Recommended path: {recommendationDiagnostics.lastSelection.primary.recipeId}
              </div>
              <div className="mt-1 text-muted-foreground">
                Helpful recommendation?
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  data-testid="workbench-recipe-feedback-up"
                  disabled={feedbackState === "saving"}
                  onClick={() => void submitRecipeFeedback("up")}
                >
                  Thumbs up
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  data-testid="workbench-recipe-feedback-down"
                  disabled={feedbackState === "saving"}
                  onClick={() => void submitRecipeFeedback("down")}
                >
                  Thumbs down
                </Button>
                {feedbackState === "saved" ? <span className="text-muted-foreground">Thanks.</span> : null}
                {feedbackState === "error" ? (
                  <span className="text-destructive">Could not save feedback.</span>
                ) : null}
              </div>
            </div>
          ) : null}
          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Describe a workflow..."
              disabled={isLoading}
              className="flex-1"
              data-testid="workbench-chat-input"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !inputValue.trim()}
              data-testid="workbench-chat-send"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </CardContent>

      <AlertDialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <AlertDialogContent data-testid="template-suggestion-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Load suggested template?</AlertDialogTitle>
            <AlertDialogDescription>
              The agent suggested loading a workflow template. This will replace your current draft in the canvas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-xs font-mono text-muted-foreground">
            templateId: {templateSuggestion?.templateId ?? "unknown"}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setTemplateDialogOpen(false);
              }}
            >
              Not now
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const id = templateSuggestion?.templateId;
                if (!id) return;
                setTemplateDialogOpen(false);
                setLocation(`/workbench?templateId=${encodeURIComponent(id)}`);
              }}
            >
              Load template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent data-testid="workbench-budget-dialog">
          <DialogHeader>
            <DialogTitle>Budget settings</DialogTitle>
            <DialogDescription>
              Set the budget key used for chat spend tracking and optionally enforce a hard USD limit.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="workbench-budget-key-input">Budget key</Label>
              <Input
                id="workbench-budget-key-input"
                value={draftBudgetKey}
                onChange={(e) => setDraftBudgetKey(e.target.value)}
                placeholder="user:U001 or session:…"
                data-testid="workbench-budget-key"
              />
              <div className="text-xs text-muted-foreground font-mono">
                Current: {(budgetKeyOverride ?? costSnapshot?.budgetKey ?? "session").slice(0, 64)}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workbench-budget-hard-limit-input">Hard limit (USD)</Label>
              <Input
                id="workbench-budget-hard-limit-input"
                value={draftHardLimitUsd}
                onChange={(e) => setDraftHardLimitUsd(e.target.value)}
                placeholder="0.50"
                inputMode="decimal"
                data-testid="workbench-budget-hard-limit"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={draftBudgetWindow === "run" ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setDraftBudgetWindow("run")}
                  data-testid="workbench-budget-window-run"
                >
                  Per run
                </Button>
                <Button
                  type="button"
                  variant={draftBudgetWindow === "day" ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setDraftBudgetWindow("day")}
                  data-testid="workbench-budget-window-day"
                >
                  Per day
                </Button>
              </div>
              {costSnapshot?.policy ? (
                <div className="text-xs text-muted-foreground font-mono">
                  Policy: ${Number(costSnapshot.policy.hardLimitUsd ?? 0).toFixed(4)} / {costSnapshot.policy.window}
                </div>
              ) : null}
            </div>

            {budgetSaveStatus === "error" && budgetSaveError ? (
              <div className="text-sm text-destructive">{budgetSaveError}</div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBudgetDialogOpen(false)}
              disabled={budgetSaveStatus === "saving"}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={async () => {
                const key = draftBudgetKey.trim();
                const hardLimit = Number(draftHardLimitUsd);
                if (!key) {
                  setBudgetSaveStatus("error");
                  setBudgetSaveError("Budget key is required.");
                  return;
                }
                if (!Number.isFinite(hardLimit) || hardLimit < 0) {
                  setBudgetSaveStatus("error");
                  setBudgetSaveError("Hard limit must be a non-negative number.");
                  return;
                }
                setBudgetSaveStatus("saving");
                setBudgetSaveError(null);
                try {
                  prefs.setDefaultBudgetKey(key);
                  await fetch("/api/workbench/cost/policy", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ budgetKey: key, policy: { hardLimitUsd: hardLimit, window: draftBudgetWindow } }),
                  });
                  setBudgetSaveStatus("idle");
                  setBudgetDialogOpen(false);
                } catch (e: any) {
                  setBudgetSaveStatus("error");
                  setBudgetSaveError(String(e?.message ?? e));
                }
              }}
              disabled={budgetSaveStatus === "saving"}
              data-testid="workbench-budget-apply"
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
