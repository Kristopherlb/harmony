import { describe, expect, it } from "vitest";

import { missingRequiredKeys, schemaRequiredKeys } from "@/features/workbench/required-fields";

describe("workbench required-fields", () => {
  it("extracts required keys from object schema", () => {
    expect(
      schemaRequiredKeys({
        type: "object",
        required: ["jql", "limit"],
        properties: { jql: { type: "string" }, limit: { type: "number" } },
      })
    ).toEqual(["jql", "limit"].sort());
  });

  it("computes missing required keys (treats empty strings as missing)", () => {
    expect(
      missingRequiredKeys({
        required: ["a", "b", "c"],
        properties: { a: "ok", b: "", c: 0 },
      })
    ).toEqual(["b"]);
  });

  it("treats boolean/number values as filled", () => {
    expect(
      missingRequiredKeys({
        required: ["enabled", "count"],
        properties: { enabled: false, count: 0 },
      })
    ).toEqual([]);
  });
});

