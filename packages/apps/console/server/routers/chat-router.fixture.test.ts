import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createChatRouter } from "./chat-router";

describe("POST /api/chat (fixture mode)", () => {
  const prevEnv = process.env.HARMONY_CHAT_FIXTURE;

  beforeEach(() => {
    process.env.HARMONY_CHAT_FIXTURE = "workbench-basic";
  });

  afterEach(() => {
    if (prevEnv === undefined) delete process.env.HARMONY_CHAT_FIXTURE;
    else process.env.HARMONY_CHAT_FIXTURE = prevEnv;
  });

  it("streams a deterministic draft when HARMONY_CHAT_FIXTURE is set", async () => {
    const listTools = vi.fn(() => {
      throw new Error("listTools should not be called in fixture mode");
    });

    const app = express();
    app.use(express.json());
    app.use(
      "/api",
      createChatRouter({
        mcpToolService: { listTools } as any,
      })
    );

    const res = await request(app)
      .post("/api/chat")
      .send({
        messages: [{ role: "user", content: "create a workflow" }],
      })
      .expect(200);

    expect(String(res.headers["content-type"] ?? "")).toContain("text/event-stream");
    expect(res.text).toContain("Fixture workflow");

    // Parse SSE "data:" lines as JSON chunks and validate the streamed delta payload.
    const dataLines = res.text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice("data: ".length));

    const chunks = dataLines
      .filter((line) => line !== "[DONE]")
      .map((line) => JSON.parse(line) as { type?: string; delta?: string });

    const textDelta = chunks.find((c) => c.type === "text-delta")?.delta ?? null;
    expect(typeof textDelta).toBe("string");
    const draft = JSON.parse(textDelta ?? "{}") as { title?: string; nodes?: unknown[]; fixtureId?: string };
    expect(draft.title).toBe("Fixture workflow");
    expect(Array.isArray(draft.nodes)).toBe(true);
    expect(draft.fixtureId).toBe("workbench-basic");
    expect(listTools).not.toHaveBeenCalled();
  });
});

