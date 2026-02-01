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
import { Save, Undo2, Redo2 } from "lucide-react";
import { BlueprintFlowNode, type BlueprintFlowNodeData } from "./blueprint-flow-node";
import { RunBlueprintDialog } from "./run-blueprint-dialog";

import { BlueprintDraft } from "@/features/workbench/types";

interface DraftingCanvasProps {
  draft: BlueprintDraft | null;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onSelectNodeId?: (nodeId: string | null) => void;
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
}: DraftingCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Update nodes when draft changes
  React.useEffect(() => {
    if (draft) {
      // Map BlueprintNode to React Flow Node
      const flowNodes: Node[] = draft.nodes.map((node) => ({
        id: node.id,
        type: "blueprint",
        data: {
          label: node.label,
          toolId: node.type,
          description: node.description,
        } satisfies BlueprintFlowNodeData,
        // If the agent doesn't provide positions, we might need a layout algorithm (e.g. dagre)
        // For now, let's just stack them if no position is provided, or rely on distinct IDs
        position: { x: 100, y: 100 },
      }));

      // Map BlueprintEdge to React Flow Edge
      const flowEdges: Edge[] = draft.edges.map((edge) => ({
        id: `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: "smoothstep",
      }));

      // Basic auto-layout if positions are missing (simple vertical stack for now)
      flowNodes.forEach((node, index) => {
        node.position = { x: 250, y: index * 100 + 50 };
      });

      setNodes(flowNodes);
      setEdges(flowEdges);

      // Fit view after a slight delay to allow rendering
      setTimeout(() => reactFlowInstance?.fitView(), 100);
    }
  }, [draft, reactFlowInstance, setNodes, setEdges]);

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

  return (
    <div className="flex w-full h-full bg-slate-50 dark:bg-slate-950/50">
      {/* Palette Sidebar */}
      <div className="w-64 flex-shrink-0 bg-background border-r z-10">
        <ComponentPalette onInsertTool={insertToolNode} />
      </div>

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
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Save className="w-4 h-4" />
            </Button>
            <RunBlueprintDialog />
          </div>
        </div>

        {/* React Flow Graph */}
        <div className="flex-1 w-full h-full" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onSelectionChange={onSelectionChange}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            fitView
            nodeTypes={{ blueprint: BlueprintFlowNode }}
            defaultEdgeOptions={{
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
              labelBgPadding: [8, 4],
            }}
          >
            <Controls />
            <MiniMap
              nodeColor={() => "hsl(var(--card))"}
              maskColor="hsl(var(--background) / 0.65)"
            />
            <Background gap={20} size={1} color="hsl(var(--border))" />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
