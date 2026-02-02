/**
 * packages/apps/console/client/src/pages/workbench-page.tsx
 * Chat-to-canvas workbench with optional template insertion from library (Phase 4.1).
 */
import React, { useMemo, useState, useEffect } from "react";
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
import { updateDraftNodeProperties } from "@/features/workbench/draft-mutations";
import { buildWorkbenchNodeRefinementMessage } from "@/features/workbench/node-refinement";
import { useLocation } from "wouter";
import { EmptyState } from "@/components/patterns/EmptyState";
import { MonitorDot } from "lucide-react";

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

export default function WorkbenchPage() {
  const [, setLocation] = useLocation();
  const [draftHistory, setDraftHistory] = useState<BlueprintDraft[]>([]);
  const [draftHistoryMeta, setDraftHistoryMeta] = useState<
    Array<{ appliedAt: string; author: "agent" | "human"; title: string }>
  >([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const currentDraft = historyIndex >= 0 ? draftHistory[historyIndex] : null;

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

  // Load template from library when ?templateId= is present (Phase 4.1.2)
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const templateId = params.get("templateId");
    if (!templateId) return;

    let cancelled = false;
    fetch("/api/templates", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to fetch templates"))))
      .then((data: { templates?: Array<{ id: string; title: string; summary: string; nodes: unknown[]; edges: unknown[] }> }) => {
        if (cancelled) return;
        const template = data.templates?.find((t) => t.id === templateId);
        if (template) setPendingDraft(templateToBlueprintDraft(template));
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

    if (proposalUnknownToolTypes.length > 0) {
      setApplyError(`Unknown tool types in proposal: ${proposalUnknownToolTypes.join(", ")}`);
      return;
    }

    if (proposalRestrictedUses.length > 0 && !approveRestricted) {
      setApplyError("Approval required for RESTRICTED tools.");
      return;
    }

    if (proposalRestrictedUses.length > 0) {
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

    setDraftHistory((prev) => {
      const base = prev.slice(0, historyIndex + 1);
      return [...base, pendingDraft];
    });
    setDraftHistoryMeta((prev) => {
      const base = prev.slice(0, historyIndex + 1);
      return [
        ...base,
        {
          appliedAt: new Date().toISOString(),
          author: "agent",
          title: pendingDraft.title,
        },
      ];
    });
    setHistoryIndex((idx) => idx + 1);
    setPendingDraft(null);
    setApproveRestricted(false);
  };

  const rejectProposal = () => {
    setPendingDraft(null);
    setApproveRestricted(false);
    setApplyError(null);
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex >= 0 && historyIndex < draftHistory.length - 1;

  const undo = () => {
    if (!canUndo) return;
    setHistoryIndex((idx) => idx - 1);
  };

  const redo = () => {
    if (!canRedo) return;
    setHistoryIndex((idx) => idx + 1);
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

  const onUpdateNodeProperties = React.useCallback(
    (input: { nodeId: string; nextProperties: Record<string, unknown> }) => {
      const update = (draft: BlueprintDraft): BlueprintDraft =>
        updateDraftNodeProperties({ draft, nodeId: input.nodeId, nextProperties: input.nextProperties });

      if (pendingDraft) {
        setPendingDraft(update(pendingDraft));
        return;
      }

      if (!currentDraft) return;
      const next = update(currentDraft);

      setDraftHistory((prev) => {
        const base = prev.slice(0, historyIndex + 1);
        return [...base, next];
      });
      setDraftHistoryMeta((prev) => {
        const base = prev.slice(0, historyIndex + 1);
        return [
          ...base,
          {
            appliedAt: new Date().toISOString(),
            author: "human",
            title: next.title,
          },
        ];
      });
      setHistoryIndex((idx) => idx + 1);
    },
    [pendingDraft, currentDraft, historyIndex]
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

  return (
    <div className="h-full overflow-hidden">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
          <AgentChatPanel
            onDraftGenerated={setPendingDraft}
            externalSendText={externalAgentSendText}
            onExternalSendComplete={() => setExternalAgentSendText(null)}
          />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={70}>
          {displayDraft ? (
            <DraftingCanvas
              draft={displayDraft}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
              onSelectNodeId={onSelectNodeId}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8" data-testid="workbench-empty-state">
              <EmptyState
                icon={MonitorDot}
                title="No workflow yet"
                description="Browse templates (e.g. Incident Response) or describe what you want in the chat."
                actionLabel="Browse templates"
                onAction={() => setLocation("/workbench/library")}
              />
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

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
        tools={mcpTools}
        pinned={infoPanePinned}
        onPinnedChange={setInfoPanePinned}
        onUpdateNodeProperties={onUpdateNodeProperties}
        onRequestConfigureWithAgent={onRequestConfigureWithAgent}
      />

      <AlertDialog open={!!pendingDraft} onOpenChange={(open) => !open && rejectProposal()}>
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
