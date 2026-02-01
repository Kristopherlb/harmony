// server/validation-edge.test.ts
// Phase 3: Assert validation at HTTP edge rejects invalid bodies.
// Routes use safeParse; engine/runner receive only validated data. No Zod inside them.

import { describe, it, expect } from "vitest";
import {
  ExecuteActionRequestSchema,
  QueryExecutionRequestSchema,
} from "@shared/schema";

describe("ExecuteActionRequest validation at edge", () => {
  it("rejects empty object", () => {
    const r = ExecuteActionRequestSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("rejects missing actionId", () => {
    const r = ExecuteActionRequestSchema.safeParse({
      params: {},
      reasoning: "test",
    });
    expect(r.success).toBe(false);
  });

  it("rejects invalid actionId type", () => {
    const r = ExecuteActionRequestSchema.safeParse({
      actionId: 123,
      params: {},
      reasoning: "test",
    });
    expect(r.success).toBe(false);
  });

  it("accepts valid request", () => {
    const r = ExecuteActionRequestSchema.safeParse({
      actionId: "provision-dev-env",
      params: { envName: "x", region: "us-east-1" },
      reasoning: "Need a new dev environment for testing.",
    });
    expect(r.success).toBe(true);
  });
});

describe("QueryExecutionRequest validation at edge", () => {
  it("rejects empty object", () => {
    const r = QueryExecutionRequestSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("rejects missing templateId", () => {
    const r = QueryExecutionRequestSchema.safeParse({ params: {} });
    expect(r.success).toBe(false);
  });

  it("rejects invalid templateId type", () => {
    const r = QueryExecutionRequestSchema.safeParse({
      templateId: 999,
      params: {},
    });
    expect(r.success).toBe(false);
  });

  it("accepts valid request", () => {
    const r = QueryExecutionRequestSchema.safeParse({
      templateId: "query-user-by-email",
      params: { email: "a@b.com" },
    });
    expect(r.success).toBe(true);
  });
});
