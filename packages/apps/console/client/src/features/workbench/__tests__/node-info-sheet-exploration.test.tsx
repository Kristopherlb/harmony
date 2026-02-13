import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { NodeInfoSheet } from "@/features/workbench/node-info-sheet";
import type { BlueprintDraft } from "@/features/workbench/types";
import type { McpTool } from "@/features/workbench/use-mcp-tools";

function renderSheet(input: { nodeType: string; tool: McpTool }) {
  const draft: BlueprintDraft = {
    title: "Demo",
    summary: "demo",
    nodes: [{ id: "n1", label: "Step", type: input.nodeType, properties: {} }],
    edges: [],
  };

  render(
    <NodeInfoSheet
      open={true}
      onOpenChange={() => {}}
      draft={draft}
      selectedNodeId="n1"
      tools={[input.tool]}
    />
  );
}

describe("NodeInfoSheet exploration affordances", () => {
  it("shows Open Swagger only when exploration.kind=openapi", () => {
    renderSheet({
      nodeType: "jira.search_issues",
      tool: {
        name: "jira.search_issues",
        description: "Search Jira",
        type: "CAPABILITY",
        dataClassification: "INTERNAL",
        inputSchema: { type: "object", properties: {} },
        exploration: { kind: "openapi", connectionType: "jira" },
      },
    });

    expect(screen.getByTestId("button-launch-swagger")).toBeInTheDocument();
    expect(screen.queryByTestId("button-launch-graphiql")).toBeNull();
  });

  it("shows Open GraphQL only when exploration.kind=graphql", () => {
    renderSheet({
      nodeType: "github.search_issues",
      tool: {
        name: "github.search_issues",
        description: "Search GitHub",
        type: "CAPABILITY",
        dataClassification: "INTERNAL",
        inputSchema: { type: "object", properties: {} },
        exploration: { kind: "graphql", connectionType: "github" },
      },
    });

    expect(screen.getByTestId("button-launch-graphiql")).toBeInTheDocument();
    expect(screen.queryByTestId("button-launch-swagger")).toBeNull();
  });

  it("shows no explorer buttons when exploration.kind=none", () => {
    renderSheet({
      nodeType: "demo.sleep",
      tool: {
        name: "demo.sleep",
        description: "Sleep",
        type: "CAPABILITY",
        dataClassification: "INTERNAL",
        inputSchema: { type: "object", properties: {} },
        exploration: { kind: "none", connectionType: "none" },
      },
    });

    expect(screen.queryByTestId("button-launch-graphiql")).toBeNull();
    expect(screen.queryByTestId("button-launch-swagger")).toBeNull();
    expect(screen.getByText(/no explorer available/i)).toBeInTheDocument();
  });
});

