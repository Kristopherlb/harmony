import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { DraftingCanvas } from "@/features/workbench/drafting-canvas";
import { NodeInfoSheet } from "@/features/workbench/node-info-sheet";
import type { BlueprintDraft } from "@/features/workbench/types";
import type { McpTool } from "@/features/workbench/use-mcp-tools";

vi.mock("@xyflow/react", async () => {
  const ReactMod = await import("react");
  return {
    ReactFlowProvider: ({ children }: any) => <>{children}</>,
    ReactFlow: (props: any) => {
      return (
        <div>
          <button
            type="button"
            onClick={() => props.onNodeClick?.({}, { id: "n1" })}
          >
            click-node-n1
          </button>
          {props.children}
        </div>
      );
    },
    addEdge: (params: any, edges: any[]) => [...edges, params],
    useNodesState: (initial: any[]) => [initial, () => {}, () => {}],
    useEdgesState: (initial: any[]) => [initial, () => {}, () => {}],
    Controls: () => null,
    Background: () => null,
    MiniMap: () => null,
    Handle: () => null,
    Position: { Top: "top", Bottom: "bottom" },
  };
});

function Harness(props: { draft: BlueprintDraft; tools: McpTool[] }) {
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  return (
    <div>
      <DraftingCanvas
        draft={props.draft}
        onSelectNodeId={(nodeId) => {
          setSelectedNodeId(nodeId);
          if (nodeId) setOpen(true);
        }}
      />
      <NodeInfoSheet
        open={open}
        onOpenChange={setOpen}
        draft={props.draft}
        selectedNodeId={selectedNodeId}
        tools={props.tools}
      />
    </div>
  );
}

describe("workbench node selection", () => {
  it("opens the node info pane when a node is clicked", async () => {
    const draft: BlueprintDraft = {
      title: "Demo",
      summary: "demo",
      nodes: [
        { id: "n1", label: "Jira Search", type: "jira.search_issues", properties: {} },
      ],
      edges: [],
    };

    const tools: McpTool[] = [
      {
        name: "jira.search_issues",
        description: "Search Jira issues using JQL",
        type: "CAPABILITY",
        dataClassification: "INTERNAL",
        inputSchema: {
          type: "object",
          required: ["jql"],
          properties: { jql: { type: "string" } },
        },
      },
    ];

    render(<Harness draft={draft} tools={tools} />);

    fireEvent.click(screen.getByRole("button", { name: /click-node-n1/i }));

    expect(await screen.findByTestId("workbench-node-info-sheet")).toBeInTheDocument();
    expect(screen.getByText("Jira Search")).toBeInTheDocument();
    expect(screen.getByTestId("required-missing")).toHaveTextContent("jql");
  });
});

