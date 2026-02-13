import React, { useCallback, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
} from "@xyflow/react";
import type { Connection, Edge, Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { ComponentPalette } from "./component-palette";
import { Button } from "@/components/ui/button";
import { Download, Share2, Undo2, Redo2 } from "lucide-react";
import { BlueprintFlowNode, type BlueprintFlowNodeData } from "./blueprint-flow-node";
import { RunDraftDialog } from "./run-draft-dialog";

import { BlueprintDraft } from "@/features/workbench/types";
import type { DiffStatus } from "./draft-diff";
import { buildShareDraftUrl, encodeShareDraftPayload } from "./share-draft";
import { toast } from "@/hooks/use-toast";
import { buildFlowEdgesFromDraft, buildFlowNodesFromDraft } from "./flow-adapters";
import { deriveNodeExecutionStatusFromSteps } from "./live-canvas-state";
import { useWorkflowProgress } from "./use-workflow-progress";
import { useWorkflowStatus } from "./use-workflow-status";
import { SaveTemplateDialog } from "./save-template-dialog";

interface DraftingCanvasProps {
  draft: BlueprintDraft | null;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onSelectNodeId?: (nodeId: string | null) => void;
  /** Node id -> diff status for visualization (Phase 4.2.2) */
  nodeDiffStatus?: Record<string, DiffStatus>;
  /** Node id -> validation status from background preflight (Phase 4.1). */
  nodeValidationStatus?: Record<string, "ghost" | "warning">;
  /** Active workflow run for live canvas state (Phase 4.3.2) */
  activeWorkflowId?: string | null;
  /** Called when a run starts (e.g. from Run dialog) */
  onRunStarted?: (workflowId: string) => void;
  /** Called when run reaches terminal status */
  onRunEnded?: (workflowId: string) => void;
  /** Disables editing affordances; used for shared draft read-only view (Phase 4.4.1). */
  readOnly?: boolean;
}

/**
 * Main Drafting Canvas Component
 */
export function DraftingCanvas({
  draft,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSelectNodeId,
  nodeDiffStatus,
  nodeValidationStatus,
  activeWorkflowId,
  onRunStarted,
  onRunEnded,
  readOnly,
}: DraftingCanvasProps) {
  return (
    <div className="flex h-full w-full">
      {/* Helper Wrapper for React Flow Context */}
      <ReactFlowProvider>
        <DraftingCanvasContent
          draft={draft}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
          onSelectNodeId={onSelectNodeId}
          nodeDiffStatus={nodeDiffStatus}
          nodeValidationStatus={nodeValidationStatus}
          activeWorkflowId={activeWorkflowId}
          onRunStarted={onRunStarted}
          onRunEnded={onRunEnded}
          readOnly={readOnly}
        />
      </ReactFlowProvider>
    </div>
  );
}

function DraftingCanvasContent({
  draft,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSelectNodeId,
  nodeDiffStatus,
  nodeValidationStatus,
  activeWorkflowId,
  onRunStarted,
  onRunEnded,
  readOnly,
}: DraftingCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const hasFitViewRef = useRef(false);

  const progress = useWorkflowProgress(activeWorkflowId ?? null);
  const describe = useWorkflowStatus(activeWorkflowId ?? null);
  const nodeExecutionStatus = React.useMemo(() => {
    if (!draft || !activeWorkflowId) return undefined;
    const workflowStatus = progress ? { status: progress.status } : describe ? { status: describe.status } : null;
    return deriveNodeExecutionStatusFromSteps(
      workflowStatus,
      draft.nodes.map((n) => ({ id: n.id, type: n.type })),
      progress?.steps
    );
  }, [draft, activeWorkflowId, progress?.status, progress?.steps, describe?.status]);

  const nodeTypes = React.useMemo(() => ({ blueprint: BlueprintFlowNode }), []);
  const defaultEdgeOptions = React.useMemo(
    () => ({
      type: "smoothstep",
      style: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 2 },
      labelStyle: {
        fill: "hsl(var(--foreground))",
        fontSize: 12,
        fontFamily: "var(--font-mono)",
      },
      labelBgStyle: {
        fill: "hsl(var(--background))",
        fillOpacity: 0.9,
        rx: 6,
        ry: 6,
      },
      labelBgPadding: [8, 4] as [number, number],
    }),
    []
  );

  // Update nodes/edges when draft changes (preserve node positions across updates).
  React.useEffect(() => {
    if (!draft) return;
    hasFitViewRef.current = false;

    setNodes((prev) => {
      const prevPositions = new Map(prev.map((n) => [n.id, n.position]));
      return buildFlowNodesFromDraft({ draft, prevPositions, nodeDiffStatus, nodeValidationStatus, nodeExecutionStatus });
    });
    setEdges(buildFlowEdgesFromDraft({ edges: draft.edges }));
  }, [draft, setNodes, setEdges]);

  // Update diff status without re-creating nodes/edges (avoids unnecessary ReactFlow churn).
  React.useEffect(() => {
    if (!nodeDiffStatus) return;
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: {
          ...(n.data as BlueprintFlowNodeData),
          diffStatus: nodeDiffStatus[n.id],
        },
      }))
    );
  }, [nodeDiffStatus, setNodes]);

  React.useEffect(() => {
    if (!nodeValidationStatus) return;
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: {
          ...(n.data as BlueprintFlowNodeData),
          validationStatus: nodeValidationStatus[n.id],
        },
      }))
    );
  }, [nodeValidationStatus, setNodes]);

  // Update execution status without re-creating nodes/edges.
  React.useEffect(() => {
    if (!nodeExecutionStatus) return;
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: {
          ...(n.data as BlueprintFlowNodeData),
          executionStatus: nodeExecutionStatus[n.id],
        },
      }))
    );
  }, [nodeExecutionStatus, setNodes]);

  // Notify parent when workflow reaches terminal status (Phase 4.3.2).
  React.useEffect(() => {
    if (!activeWorkflowId) return;
    const s = progress?.status ?? describe?.status;
    if (!s) return;
    if (s === "COMPLETED" || s === "FAILED" || s === "CANCELED" || s === "TERMINATED") {
      onRunEnded?.(activeWorkflowId);
    }
  }, [activeWorkflowId, progress?.status, describe?.status, onRunEnded]);

  // Fit view once after the first layout of a draft.
  React.useEffect(() => {
    if (!draft) return;
    if (!reactFlowInstance) return;
    if (hasFitViewRef.current) return;

    hasFitViewRef.current = true;
    requestAnimationFrame(() => reactFlowInstance.fitView());
  }, [draft, reactFlowInstance]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback(
    (_event: any, node: Node) => {
      onSelectNodeId?.(node.id);
    },
    [onSelectNodeId]
  );

  const onPaneClick = useCallback(() => {
    onSelectNodeId?.(null);
  }, [onSelectNodeId]);

  const onSelectionChange = useCallback(
    (selection: { nodes?: Node[]; edges?: Edge[] }) => {
      // Keep the info pane in sync when selection is cleared via canvas interactions.
      if (!selection?.nodes?.length && !selection?.edges?.length) {
        onSelectNodeId?.(null);
      }
    },
    [onSelectNodeId]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");

      if (typeof type === "undefined" || !type) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: `${type}-${Date.now()}`,
        type: "blueprint",
        position,
        data: { label: type, toolId: type } satisfies BlueprintFlowNodeData,
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const insertToolNode = useCallback(
    (toolId: string) => {
      const wrapper = reactFlowWrapper.current;
      if (!wrapper || !reactFlowInstance) return;

      const bounds = wrapper.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      });

      const newNode: Node = {
        id: `${toolId}-${Date.now()}`,
        type: "blueprint",
        position,
        data: { label: toolId, toolId } satisfies BlueprintFlowNodeData,
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const onShareDraft = useCallback(async () => {
    if (!draft) return;
    try {
      const payload = encodeShareDraftPayload(draft);
      const url = buildShareDraftUrl({ origin: window.location.origin, payload });

      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        window.prompt("Copy share link:", url);
      }

      toast({
        title: "Share link copied",
        description: "Anyone with the link can view this draft (read-only).",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Failed to create share link",
        description: "Try again or download the draft JSON instead.",
      });
    }
  }, [draft]);

  const onDownloadDraft = useCallback(() => {
    if (!draft) return;
    try {
      const json = JSON.stringify(draft, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const filenameBase = (draft.title || "workflow-draft")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filenameBase || "workflow-draft"}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({ title: "Draft downloaded", description: "Saved as a JSON file." });
    } catch {
      toast({
        variant: "destructive",
        title: "Download failed",
        description: "Try using the share link instead.",
      });
    }
  }, [draft]);

  return (
    <div className="flex w-full h-full bg-slate-50 dark:bg-slate-950/50">
      {/* Palette Sidebar */}
      {readOnly ? null : (
        <div className="w-64 flex-shrink-0 bg-background border-r z-10">
          <ComponentPalette onInsertTool={insertToolNode} />
        </div>
      )}

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Simple Toolbar */}
        <div className="h-12 border-b bg-background flex items-center justify-between px-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-muted-foreground truncate">
              {draft?.title ? `Workflow Draft — ${draft.title}` : "Workflow Draft — (no draft yet)"}
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              nodes:{nodes.length} edges:{edges.length}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={!canUndo}
              onClick={onUndo}
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={!canRedo}
              onClick={onRedo}
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={!draft}
              onClick={onShareDraft}
              title="Share (copy link)"
              aria-label="Share draft"
            >
              <Share2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={!draft}
              onClick={onDownloadDraft}
              title="Download JSON"
              aria-label="Download draft JSON"
            >
              <Download className="w-4 h-4" />
            </Button>
            {readOnly ? null : (
              <SaveTemplateDialog draft={draft} />
            )}
            {readOnly ? null : (
              <RunDraftDialog
                draft={draft}
                onFixItSelectNode={(nodeId) => onSelectNodeId?.(nodeId)}
                onRunStarted={onRunStarted}
              />
            )}
          </div>
        </div>

        {/* React Flow Graph */}
        <div
          className="flex-1 w-full h-full"
          ref={reactFlowWrapper}
          data-testid="workbench-drafting-canvas"
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={readOnly ? undefined : onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onSelectionChange={onSelectionChange}
            onInit={setReactFlowInstance}
            onDrop={readOnly ? undefined : onDrop}
            onDragOver={readOnly ? undefined : onDragOver}
            fitView
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
          >
            <Controls />
            {nodes.length <= 75 ? (
              <MiniMap
                nodeColor={() => "hsl(var(--card))"}
                maskColor="hsl(var(--background) / 0.65)"
              />
            ) : null}
            <Background gap={20} size={1} color="hsl(var(--border))" />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
