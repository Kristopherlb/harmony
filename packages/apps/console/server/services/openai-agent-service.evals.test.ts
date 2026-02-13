/**
 * packages/apps/console/server/services/openai-agent-service.evals.test.ts
 * Fixture-driven eval harness for prompt/tool behavior regression testing.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

type EvalFixture = {
  id: string;
  description?: string;
  messages: Array<{ id: string; role: "user" | "assistant" | "system"; content: string }>;
  draft: { title: string; summary: string; nodes: unknown[]; edges: unknown[] };
  expect: { tool: string; nodes: number; edges: number };
};

const captured = vi.hoisted(() => {
  return {
    streamTextCalls: [] as any[],
    lastWriter: null as any,
    currentFixture: null as EvalFixture | null,
    convertInputMessages: [] as any[],
  };
});

vi.mock("@ai-sdk/openai", () => {
  return {
    openai: (model: string) => ({ model }),
  };
});

vi.mock("@golden/core", () => {
  class BudgetExceededError extends Error {}

  const pricing = {
    provider: "openai",
    models: {},
  };

  const mock = {
    getDefaultLlmPricing: () => pricing,
    createInMemoryLlmCostManager: () => ({
      getBudget: () => null,
      setBudget: () => {},
      recordUsage: () => ({ usd: 0 }),
      getTotals: () => ({ usd: 0 }),
    }),
    calculateLlmCostUsd: () => ({ usd: 0 }),
    BudgetExceededError,
    withGoldenSpan: async (_name: string, _ctx: any, _componentType: any, fn: (span: any) => Promise<any>) => {
      const span = {
        setAttribute: vi.fn(),
        setStatus: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
      };
      return await fn(span);
    },
  };

  // Support both `import core from` and `import * as core from` styles.
  return { ...mock, default: mock };
});

vi.mock("ai", () => {
  const tool = (def: any) => def;

  const convertToModelMessages = async (messages: unknown) => {
    captured.convertInputMessages = Array.isArray(messages) ? messages : [];
    return Array.isArray(messages) ? (messages as any[]) : [{ role: "user", content: "hi" }];
  };

  const createUIMessageStream = ({ execute }: any) => {
    const writer = {
      write: vi.fn(),
      merge: vi.fn(),
    };
    captured.lastWriter = writer;
    void execute({ writer });
    return { __kind: "ui-message-stream", writer };
  };

  const streamText = (opts: any) => {
    captured.streamTextCalls.push(opts);
    const fx = captured.currentFixture;

    // Planning step: required tool call -> proposeWorkflow
    if (opts?.toolChoice === "required" && opts?.tools?.proposeWorkflow && fx) {
      // Simulate the tool being invoked with fixture output.
      void opts.tools.proposeWorkflow.execute(fx.draft);
      if (typeof opts?.onFinish === "function") {
        opts.onFinish({ usage: { promptTokens: 10, completionTokens: 20 } });
      }
      return {
        toUIMessageStream: () => ({ __kind: "ui-stream-planning" }),
        response: Promise.resolve({
          messages: [{ role: "assistant", content: JSON.stringify(fx.draft) }],
        }),
      };
    }

    // Summary step: just produce a stable message.
    if (typeof opts?.onFinish === "function") {
      opts.onFinish({ usage: { promptTokens: 5, completionTokens: 5 } });
    }
    return {
      toUIMessageStream: () => ({ __kind: "ui-stream-summary" }),
      response: Promise.resolve({
        messages: [{ role: "assistant", content: "summary" }],
      }),
    };
  };

  return { tool, convertToModelMessages, createUIMessageStream, streamText };
});

vi.mock("../agent/execution-monitor", () => ({
  getExecutionStatus: vi.fn(async (_workflowId: string) => "Status: RUNNING"),
  cancelExecution: vi.fn(async (_workflowId: string) => ({ ok: true })),
  isStatusQuery: (text: string) => /status/i.test(text),
  isCancelQuery: (text: string) => /cancel/i.test(text),
}));

function loadFixture(id: string): EvalFixture {
  const fixturesDir = new URL("../agent/evals/fixtures/", import.meta.url);
  const fixtureUrl = new URL(`${id}.json`, fixturesDir);
  const p = fileURLToPath(fixtureUrl);
  return JSON.parse(readFileSync(p, "utf-8")) as EvalFixture;
}

async function flushAgentStream(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("OpenAIAgentService eval harness", () => {
  it("runs workbench-basic fixture and enforces expected tool output shape", async () => {
    captured.streamTextCalls.length = 0;
    captured.lastWriter = null;
    captured.currentFixture = loadFixture("workbench-basic");

    vi.resetModules();
    const { OpenAIAgentService } = await import("./openai-agent-service");

    const stream: any = await OpenAIAgentService.generateBlueprint({
      messages: captured.currentFixture.messages,
      tools: [],
      budgetKey: "user:eval",
    });

    expect(stream).toBeTruthy();

    // Ensure planning step forces a tool call and merges UI stream.
    const planningCall = captured.streamTextCalls.find((c) => c?.toolChoice === "required");
    expect(planningCall).toBeTruthy();
    expect(Object.keys(planningCall.tools ?? {})).toEqual(expect.arrayContaining(["proposeWorkflow", "explainStep"]));

    // Sanity-check fixture expected draft.
    expect(captured.currentFixture.draft.nodes).toHaveLength(captured.currentFixture.expect.nodes);
    expect(captured.currentFixture.draft.edges).toHaveLength(captured.currentFixture.expect.edges);

    // UI stream merging is part of the deterministic contract.
    expect(captured.lastWriter?.merge).toHaveBeenCalled();
    expect(captured.lastWriter?.write).toHaveBeenCalledWith(expect.objectContaining({ type: "start" }));
  });

  it("routes discovery intent to non-generation path and preserves status injection", async () => {
    captured.streamTextCalls.length = 0;
    captured.lastWriter = null;
    captured.convertInputMessages = [];
    captured.currentFixture = null;

    vi.resetModules();
    const { OpenAIAgentService } = await import("./openai-agent-service");

    await OpenAIAgentService.generateBlueprint({
      messages: [{ id: "u1", role: "user", content: "What tools are available? What's the status?" }],
      tools: [{ name: "golden.echo", description: "Echo", inputSchema: { type: "object" } } as any],
      budgetKey: "user:eval-discovery",
      activeWorkflowId: "wf-123",
    });
    await flushAgentStream();

    expect(captured.streamTextCalls.length).toBe(0);
    expect(captured.streamTextCalls.some((c) => c?.toolChoice === "required")).toBe(false);
    const writeCalls = captured.lastWriter?.write?.mock?.calls ?? [];
    const textWrites = writeCalls
      .map((call: any[]) => call[0])
      .filter((entry: any) => entry?.type === "text")
      .map((entry: any) => String(entry?.text ?? ""));
    expect(textWrites.join("\n")).toContain("Catalog-grounded capabilities");
    expect(textWrites.join("\n")).toContain("Discovery mode only");
  });

  it("routes complex generation intent to steerage checkpoint before tool planning", async () => {
    captured.streamTextCalls.length = 0;
    captured.lastWriter = null;
    captured.convertInputMessages = [];
    captured.currentFixture = null;

    vi.resetModules();
    const { OpenAIAgentService } = await import("./openai-agent-service");

    await OpenAIAgentService.generateBlueprint({
      messages: [
        {
          id: "u1",
          role: "user",
          content:
            "Plan an incident triage workflow with rollback and approval gates, then notify stakeholders and include diagnostics if health checks fail and then continue with release fallback.",
        },
      ],
      tools: [{ name: "golden.slack.post_message", description: "Post message", inputSchema: { type: "object" } } as any],
      budgetKey: "user:eval-steerage",
    });
    await flushAgentStream();

    expect(captured.streamTextCalls.length).toBeGreaterThan(0);
    expect(captured.streamTextCalls.some((c) => c?.toolChoice === "required")).toBe(false);
    expect(String(captured.streamTextCalls[0]?.system ?? "")).toContain("human-in-the-loop steerage checkpoint");
  });
});

