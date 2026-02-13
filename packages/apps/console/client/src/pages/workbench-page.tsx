/**
 * packages/apps/console/client/src/pages/workbench-page.tsx
 * Chat-to-canvas workbench with optional template insertion from library (Phase 4.1).
 */
import React, { useMemo, useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { AgentChatPanel } from "@/features/workbench/agent-chat-panel";
import { DraftingCanvas } from "@/features/workbench/drafting-canvas";
import { BlueprintDraft } from "@/features/workbench/types";
import { templateToBlueprintDraft } from "@/features/workbench/template-insertion";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useMcpToolCatalog } from "@/features/workbench/use-mcp-tools";
import { NodeInfoSheet } from "@/features/workbench/node-info-sheet";
import { ApprovalHistorySheet } from "@/features/workbench/approval-history-sheet";
import { applyDraftProposal, updateDraftNodeProperties } from "@/features/workbench/draft-mutations";
import { buildWorkbenchNodeRefinementMessage } from "@/features/workbench/node-refinement";
import { buildExplainStepMessage } from "@/features/workbench/node-explanation";
import { computeDraftDiff } from "@/features/workbench/draft-diff";
import { useLocation } from "wouter";
import { EmptyState } from "@/components/patterns/EmptyState";
import { Button } from "@/components/ui/button";
import { MonitorDot, ClipboardList, HelpCircle } from "lucide-react";
import { loadLocalTemplates } from "@/features/workbench/library/local-templates";
import { decodeShareDraftPayload } from "@/features/workbench/share-draft";
import { WorkbenchOnboarding, WORKBENCH_ONBOARDING_SEEN_KEY } from "@/components/workbench-onboarding";
import { WorkbenchHelpSheet } from "@/components/workbench-help-sheet";
import { emitWorkbenchEvent, getOrCreateWorkbenchSessionId } from "@/lib/workbench-telemetry";

function edgeKey(edge: { source: string; target: string; label?: string }) {
  return `${edge.source}::${edge.target}::${edge.label ?? ""}`;
}

function diffDraft(
  current: BlueprintDraft | null,
  proposed: BlueprintDraft
) {
  if (!current) {
    return {
      addedNodes: proposed.nodes.length,
      removedNodes: 0,
      addedEdges: proposed.edges.length,
      removedEdges: 0,
    };
  }

  const currentNodeIds = new Set(current.nodes.map((n) => n.id));
  const proposedNodeIds = new Set(proposed.nodes.map((n) => n.id));

  const currentEdges = new Set(current.edges.map(edgeKey));
  const proposedEdges = new Set(proposed.edges.map(edgeKey));

  let addedNodes = 0;
  let removedNodes = 0;
  let addedEdges = 0;
  let removedEdges = 0;

  for (const id of proposedNodeIds) if (!currentNodeIds.has(id)) addedNodes++;
  for (const id of currentNodeIds) if (!proposedNodeIds.has(id)) removedNodes++;

  for (const k of proposedEdges) if (!currentEdges.has(k)) addedEdges++;
  for (const k of currentEdges) if (!proposedEdges.has(k)) removedEdges++;

  return { addedNodes, removedNodes, addedEdges, removedEdges };
}

/** Single state for draft history + index so they update atomically (prevents apply-then-disappear). */
type HistoryState = { drafts: BlueprintDraft[]; index: number };
type DraftPreflightFinding =
  | { kind: "unknown_tool"; nodeId: string; toolId: string }
  | { kind: "missing_required"; nodeId: string; toolId: string; field: string }
  | { kind: "restricted_requires_approval"; nodeId: string; toolId: string };
type DraftPreflightWarning = { kind: "critical_requires_peer_approval"; nodeId: string; toolId: string };
type DraftPreflightReport = { ok: boolean; findings: DraftPreflightFinding[]; warnings: DraftPreflightWarning[] };

export default function WorkbenchPage() {
  const [, setLocation] = useLocation();
  const [historyState, setHistoryState] = useState<HistoryState>({ drafts: [], index: -1 });
  const [draftHistoryMeta, setDraftHistoryMeta] = useState<
    Array<{ appliedAt: string; author: "agent" | "human"; title: string }>
  >([]);
  const currentDraft = historyState.index >= 0 ? historyState.drafts[historyState.index] : null;

  const [pendingDraft, setPendingDraft] = useState<BlueprintDraft | null>(null);
  const [approveRestricted, setApproveRestricted] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const { tools: mcpTools } = useMcpToolCatalog();
  const mcpToolIds = useMemo(() => new Set(mcpTools.map((t) => t.name)), [mcpTools]);
  const restrictedToolIds = useMemo(() => {
    const restricted = new Set(
      mcpTools.filter((t) => t.dataClassification === "RESTRICTED").map((t) => t.name)
    );
    return restricted;
  }, [mcpTools]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [infoPaneOpen, setInfoPaneOpen] = useState(false);
  const [infoPanePinned, setInfoPanePinned] = useState(false);
  const [lastSelectedNodeId, setLastSelectedNodeId] = useState<string | null>(null);
  const [externalAgentSendText, setExternalAgentSendText] = useState<string | null>(null);
  const [refinementRequestSeq, setRefinementRequestSeq] = useState(0);
  const [approvalHistoryOpen, setApprovalHistoryOpen] = useState(false);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [backgroundPreflight, setBackgroundPreflight] = useState<DraftPreflightReport | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const applyingProposalRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const pendingDraftStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(WORKBENCH_ONBOARDING_SEEN_KEY);
    if (!seen) setOnboardingOpen(true);
  }, []);

  // Phase 4.5: Workbench session telemetry (best-effort).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sessionId = getOrCreateWorkbenchSessionId();
    sessionIdRef.current = sessionId;
    sessionStartedAtRef.current = Date.now();
    emitWorkbenchEvent({ event: "workbench.session_started", sessionId }).catch(() => {});
    return () => {
      const startedAt = sessionStartedAtRef.current;
      const durationMs = typeof startedAt === "number" ? Math.max(0, Date.now() - startedAt) : undefined;
      emitWorkbenchEvent({ event: "workbench.session_ended", sessionId, durationMs }).catch(() => {});
    };
  }, []);

  // Phase 4.4.1+: Fork shared draft into Workbench when ?d= payload is present.
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const templateId = params.get("templateId");
    if (templateId) return; // template flow takes precedence

    const payload = params.get("d");
    if (!payload) return;
    const draft = decodeShareDraftPayload(payload);
    if (!draft) return;

    setHistoryState({ drafts: [draft], index: 0 });
    setDraftHistoryMeta([{ appliedAt: new Date().toISOString(), author: "human", title: draft.title }]);

    const sessionId = sessionIdRef.current ?? getOrCreateWorkbenchSessionId();
    emitWorkbenchEvent({
      event: "workbench.draft_created",
      sessionId,
      source: "share",
      draftId: "draft-0",
      nodeCount: draft.nodes.length,
    }).catch(() => {});

    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/workbench");
    }
  }, []);

  // Load template from library when ?templateId= is present (Phase 4.1.2).
  // Apply template directly to history so it's the current draft (no Apply dialog).
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const templateId = params.get("templateId");
    if (!templateId) return;

    let cancelled = false;

    const local = loadLocalTemplates().find((t) => t.id === templateId) ?? null;
    if (local) {
      const draft = templateToBlueprintDraft(local);
      setHistoryState({ drafts: [draft], index: 0 });
      setDraftHistoryMeta([{ appliedAt: new Date().toISOString(), author: "agent", title: draft.title }]);
      const sessionId = sessionIdRef.current ?? getOrCreateWorkbenchSessionId();
      emitWorkbenchEvent({
        event: "workbench.template_inserted",
        sessionId,
        templateId,
        draftId: "draft-0",
      }).catch(() => {});
      emitWorkbenchEvent({
        event: "workbench.draft_created",
        sessionId,
        source: "template",
        draftId: "draft-0",
        templateId,
        nodeCount: draft.nodes.length,
      }).catch(() => {});
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", "/workbench");
      }
      return;
    }

    fetch("/api/templates", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to fetch templates"))))
      .then((data: { templates?: Array<{ id: string; title: string; summary: string; nodes: unknown[]; edges: unknown[] }> }) => {
        if (cancelled) return;
        const template = data.templates?.find((t) => t.id === templateId);
        if (template) {
          const draft = templateToBlueprintDraft(template);
          setHistoryState({ drafts: [draft], index: 0 });
          setDraftHistoryMeta([{ appliedAt: new Date().toISOString(), author: "agent", title: draft.title }]);
          const sessionId = sessionIdRef.current ?? getOrCreateWorkbenchSessionId();
          emitWorkbenchEvent({
            event: "workbench.template_inserted",
            sessionId,
            templateId,
            draftId: "draft-0",
          }).catch(() => {});
          emitWorkbenchEvent({
            event: "workbench.draft_created",
            sessionId,
            source: "template",
            draftId: "draft-0",
            templateId,
            nodeCount: draft.nodes.length,
          }).catch(() => {});
        }
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", "/workbench");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const proposalDiff = useMemo(() => {
    if (!pendingDraft) return null;
    return diffDraft(currentDraft, pendingDraft);
  }, [currentDraft, pendingDraft]);

  const nodeDiffStatus = useMemo(() => {
    if (!pendingDraft) return undefined;
    const diff = computeDraftDiff(currentDraft, pendingDraft);
    return diff.nodeStatus;
  }, [currentDraft, pendingDraft]);

  const proposalRestrictedUses = useMemo(() => {
    if (!pendingDraft) return [];
    const used = new Set<string>();
    for (const n of pendingDraft.nodes) {
      if (restrictedToolIds.has(n.type)) used.add(n.type);
    }
    return Array.from(used).sort();
  }, [pendingDraft, restrictedToolIds]);

  const proposalUnknownToolTypes = useMemo(() => {
    if (!pendingDraft) return [];
    const primitiveTypes = new Set(["start", "sleep", "log", "condition"]);
    const unknown = new Set<string>();
    for (const n of pendingDraft.nodes) {
      if (primitiveTypes.has(n.type)) continue;
      if (mcpToolIds.size > 0 && !mcpToolIds.has(n.type)) unknown.add(n.type);
    }
    return Array.from(unknown).sort();
  }, [pendingDraft, mcpToolIds]);

  const acceptProposal = () => {
    if (!pendingDraft) return;
    setApplyError(null);
    applyingProposalRef.current = true;
    const sessionId = sessionIdRef.current ?? getOrCreateWorkbenchSessionId();
    const draftId = `draft-${historyState.index + 1}`;

    if (proposalUnknownToolTypes.length > 0) {
      setApplyError(`Unknown tool types in proposal: ${proposalUnknownToolTypes.join(", ")}`);
      applyingProposalRef.current = false;
      return;
    }

    if (proposalRestrictedUses.length > 0 && !approveRestricted) {
      setApplyError("Approval required for RESTRICTED tools.");
      applyingProposalRef.current = false;
      return;
    }

    if (proposalRestrictedUses.length > 0) {
      emitWorkbenchEvent({
        event: "workbench.approval_requested",
        sessionId,
        toolIds: proposalRestrictedUses,
        contextType: "general",
        draftId,
      }).catch(() => {});
      fetch("/api/workbench/approvals/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          approverId: "workbench-user",
          approvedToolIds: proposalRestrictedUses,
          context: { draftTitle: pendingDraft.title },
        }),
      }).catch(() => {});
    }

    // Commit applied draft atomically so currentDraft is never briefly null.
    const draftToCommit = pendingDraft;
    const startedAt = pendingDraftStartedAtRef.current;
    const durationMs = typeof startedAt === "number" ? Math.max(0, Date.now() - startedAt) : undefined;
    emitWorkbenchEvent({
      event: "workbench.draft_accepted",
      sessionId,
      draftId,
      source: "chat",
      nodeCount: draftToCommit.nodes.length,
      durationMs,
    }).catch(() => {});
    if (proposalRestrictedUses.length > 0) {
      emitWorkbenchEvent({
        event: "workbench.approval_completed",
        sessionId,
        approved: true,
        toolIds: proposalRestrictedUses,
        draftId,
      }).catch(() => {});
    }
    flushSync(() => {
      setHistoryState((prev) => ({
        drafts: [...prev.drafts.slice(0, prev.index + 1), draftToCommit],
        index: prev.index + 1,
      }));
      setDraftHistoryMeta((prev) => {
        const base = prev.slice(0, historyState.index + 1);
        return [
          ...base,
          {
            appliedAt: new Date().toISOString(),
            author: "agent",
            title: draftToCommit.title,
          },
        ];
      });
    });

    // Clear pending after the next paint so we never render with displayDraft null.
    requestAnimationFrame(() => {
      setPendingDraft(null);
      setApproveRestricted(false);
      // Clear ref after dialog close so onOpenChange(false) still sees we applied.
      requestAnimationFrame(() => {
        applyingProposalRef.current = false;
        pendingDraftStartedAtRef.current = null;
      });
    });
  };

  const rejectProposal = () => {
    const draftId = `draft-${historyState.index + 1}`;
    const sessionId = sessionIdRef.current ?? getOrCreateWorkbenchSessionId();
    emitWorkbenchEvent({
      event: "workbench.draft_rejected",
      sessionId,
      draftId,
      source: "chat",
    }).catch(() => {});
    if (proposalRestrictedUses.length > 0) {
      emitWorkbenchEvent({
        event: "workbench.approval_completed",
        sessionId,
        approved: false,
        toolIds: proposalRestrictedUses,
        draftId,
      }).catch(() => {});
    }
    setPendingDraft(null);
    setApproveRestricted(false);
    setApplyError(null);
    pendingDraftStartedAtRef.current = null;
  };

  const canUndo = historyState.index > 0;
  const canRedo = historyState.index >= 0 && historyState.index < historyState.drafts.length - 1;

  const undo = () => {
    if (!canUndo) return;
    setHistoryState((prev) => ({ ...prev, index: prev.index - 1 }));
  };

  const redo = () => {
    if (!canRedo) return;
    setHistoryState((prev) => ({ ...prev, index: prev.index + 1 }));
  };

  const onSelectNodeId = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    if (nodeId) {
      setLastSelectedNodeId(nodeId);
      setInfoPaneOpen(true);
      return;
    }

    if (!infoPanePinned) setInfoPaneOpen(false);
  };

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;

      if (infoPaneOpen) {
        setInfoPaneOpen(false);
        setInfoPanePinned(false);
        if (!infoPanePinned) setSelectedNodeId(null);
        return;
      }

      if (selectedNodeId) setSelectedNodeId(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [infoPaneOpen, infoPanePinned, selectedNodeId]);

  // Preview agent proposals on the canvas immediately; applying commits to history.
  const displayDraft = pendingDraft ?? currentDraft;
  const infoPaneNodeId = selectedNodeId ?? (infoPanePinned ? lastSelectedNodeId : null);

  // Progressive background preflight validation (Phase 4.1).
  useEffect(() => {
    if (!displayDraft) {
      setBackgroundPreflight(null);
      return;
    }
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/workbench/drafts/preflight", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({ draft: displayDraft, approvedRestricted: false }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as DraftPreflightReport;
        setBackgroundPreflight(json);
      } catch {
        // best-effort only
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
  }, [displayDraft]);

  const nodeValidationStatus = useMemo(() => {
    if (!backgroundPreflight) return undefined;
    const status: Record<string, "ghost" | "warning"> = {};
    for (const finding of backgroundPreflight.findings ?? []) {
      if (finding.kind === "missing_required") {
        status[finding.nodeId] = "ghost";
        continue;
      }
      status[finding.nodeId] = "warning";
    }
    for (const warning of backgroundPreflight.warnings ?? []) {
      if (!status[warning.nodeId]) status[warning.nodeId] = "warning";
    }
    return status;
  }, [backgroundPreflight]);

  const onUpdateNodeProperties = React.useCallback(
    (input: { nodeId: string; nextProperties: Record<string, unknown> }) => {
      const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
      const update = (draft: BlueprintDraft): BlueprintDraft =>
        updateDraftNodeProperties({ draft, nodeId: input.nodeId, nextProperties: input.nextProperties });

      if (pendingDraft) {
        setPendingDraft(update(pendingDraft));
        const sessionId = sessionIdRef.current ?? getOrCreateWorkbenchSessionId();
        const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
        emitWorkbenchEvent({
          event: "workbench.draft_edited",
          sessionId,
          draftId: "pending",
          editType: "canvas",
          durationMs: Math.max(0, t1 - t0),
        }).catch(() => {});
        return;
      }

      if (!currentDraft) return;
      const next = update(currentDraft);

      setHistoryState((prev) => ({
        drafts: [...prev.drafts.slice(0, prev.index + 1), next],
        index: prev.index + 1,
      }));
      setDraftHistoryMeta((prev) => {
        const base = prev.slice(0, historyState.index + 1);
        return [
          ...base,
          {
            appliedAt: new Date().toISOString(),
            author: "human",
            title: next.title,
          },
        ];
      });
      const sessionId = sessionIdRef.current ?? getOrCreateWorkbenchSessionId();
      const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
      emitWorkbenchEvent({
        event: "workbench.draft_edited",
        sessionId,
        draftId: `draft-${historyState.index + 1}`,
        editType: "canvas",
        durationMs: Math.max(0, t1 - t0),
      }).catch(() => {});
    },
    [pendingDraft, currentDraft, historyState.index]
  );

  const onRequestConfigureWithAgent = React.useCallback(
    (input: { selectedNodeId: string; missingRequired: string[] }) => {
      if (!displayDraft) return;
      const node = displayDraft.nodes.find((n) => n.id === input.selectedNodeId) ?? null;
      const tool = node ? mcpTools.find((t) => t.name === node.type) ?? null : null;
      if (!node) return;

      setRefinementRequestSeq((seq) => {
        const requestId = seq + 1;
        setExternalAgentSendText(
          buildWorkbenchNodeRefinementMessage({
            requestId,
            selectedNodeId: input.selectedNodeId,
            missingRequired: input.missingRequired,
            tool,
            draft: displayDraft,
          })
        );
        return requestId;
      });
    },
    [displayDraft, mcpTools]
  );

  const onRequestExplain = React.useCallback((input: { node: { id: string; label: string; type: string } }) => {
    setExternalAgentSendText(buildExplainStepMessage({ node: input.node }));
  }, []);

  return (
    <div className="h-full overflow-hidden">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
          <AgentChatPanel
            onDraftGenerated={(draft) => {
              pendingDraftStartedAtRef.current = Date.now();
              const applied = applyDraftProposal({
                current: displayDraft,
                proposal: draft,
              });
              const sessionId = sessionIdRef.current ?? getOrCreateWorkbenchSessionId();
              emitWorkbenchEvent({
                event: "workbench.draft_created",
                sessionId,
                source: "chat",
                draftId: "pending",
                nodeCount: applied.draft.nodes.length,
              }).catch(() => {});
              setPendingDraft(applied.draft);
            }}
            externalSendText={externalAgentSendText}
            onExternalSendComplete={() => setExternalAgentSendText(null)}
            currentDraft={displayDraft}
            activeWorkflowId={activeWorkflowId}
          />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={70}>
          <div className="flex items-center justify-end gap-2 px-2 py-1 border-b shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHelpOpen(true)}
              data-testid="workbench-help"
            >
              <HelpCircle className="h-4 w-4 mr-1" />
              Help
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setApprovalHistoryOpen(true)}
              data-testid="workbench-approval-history"
            >
              <ClipboardList className="h-4 w-4 mr-1" />
              Approval history
            </Button>
          </div>
          {displayDraft ? (
            <DraftingCanvas
              draft={displayDraft}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
              onSelectNodeId={onSelectNodeId}
              nodeDiffStatus={nodeDiffStatus}
              nodeValidationStatus={nodeValidationStatus}
              activeWorkflowId={activeWorkflowId}
              onRunStarted={setActiveWorkflowId}
              onRunEnded={() => setActiveWorkflowId(null)}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8" data-testid="workbench-empty-state">
              <EmptyState
                icon={MonitorDot}
                title="No workflow yet"
                description="Browse templates in the Library or describe a workflow goal in chat (e.g. incident response, daily standup). The assistant creates workflow drafts; use the Library to see available templates."
                actionLabel="Browse templates"
                onAction={() => setLocation("/workbench/library")}
              />
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      <ApprovalHistorySheet
        open={approvalHistoryOpen}
        onOpenChange={setApprovalHistoryOpen}
      />
      <WorkbenchHelpSheet
        open={helpOpen}
        onOpenChange={setHelpOpen}
        onBrowseTemplates={() => {
          setHelpOpen(false);
          setLocation("/workbench/library");
        }}
        onRestartOnboarding={() => {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(WORKBENCH_ONBOARDING_SEEN_KEY);
          }
          setHelpOpen(false);
          setOnboardingOpen(true);
        }}
      />
      <WorkbenchOnboarding
        open={onboardingOpen}
        onOpenChange={(open) => {
          setOnboardingOpen(open);
          if (!open && typeof window !== "undefined") {
            window.localStorage.setItem(WORKBENCH_ONBOARDING_SEEN_KEY, "true");
          }
        }}
        onFinish={() => {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(WORKBENCH_ONBOARDING_SEEN_KEY, "true");
          }
        }}
      />
      <NodeInfoSheet
        open={infoPaneOpen}
        onOpenChange={(open) => {
          setInfoPaneOpen(open);
          if (!open) {
            setInfoPanePinned(false);
            setSelectedNodeId(null);
          }
        }}
        draft={displayDraft}
        selectedNodeId={infoPaneNodeId}
        activeWorkflowId={activeWorkflowId}
        tools={mcpTools}
        pinned={infoPanePinned}
        onPinnedChange={setInfoPanePinned}
        onUpdateNodeProperties={onUpdateNodeProperties}
        onRequestConfigureWithAgent={onRequestConfigureWithAgent}
        onRequestExplain={onRequestExplain}
      />

      <AlertDialog
        open={!!pendingDraft}
        onOpenChange={(open) => {
          if (!open && !applyingProposalRef.current) rejectProposal();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply agent proposal?</AlertDialogTitle>
            <AlertDialogDescription>
              This will apply the agent’s proposed workflow changes as a single batch.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-md border p-3 text-sm space-y-1">
            <div className="font-semibold">{pendingDraft?.title}</div>
            {pendingDraft?.summary ? (
              <div className="text-muted-foreground">{pendingDraft.summary}</div>
            ) : null}

            {proposalDiff ? (
              <div className="pt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Nodes: +{proposalDiff.addedNodes} / -{proposalDiff.removedNodes}</div>
                <div>Edges: +{proposalDiff.addedEdges} / -{proposalDiff.removedEdges}</div>
              </div>
            ) : null}
          </div>

          {proposalRestrictedUses.length > 0 ? (
            <div className="rounded-md border p-3 text-sm space-y-2">
              <div className="font-semibold">Restricted tools detected</div>
              <div className="text-xs text-muted-foreground">
                This proposal references tools marked <span className="font-mono">RESTRICTED</span>.
                You must explicitly approve before applying.
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                {proposalRestrictedUses.join(", ")}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={approveRestricted}
                  onCheckedChange={(v) => setApproveRestricted(Boolean(v))}
                />
                I approve executing RESTRICTED tool steps.
              </label>
            </div>
          ) : null}

          {applyError ? (
            <div className="text-sm text-destructive">{applyError}</div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>Reject</AlertDialogCancel>
            <AlertDialogAction onClick={acceptProposal}>Apply</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
