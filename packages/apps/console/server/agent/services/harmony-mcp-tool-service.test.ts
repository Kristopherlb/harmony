/**
 * packages/apps/console/server/agent/services/harmony-mcp-tool-service.test.ts
 * TDD: tool catalog snapshot exposes deterministic discovery metadata for UI.
 */
import { describe, it, expect } from "vitest";
import { HarmonyMcpToolService } from "./harmony-mcp-tool-service";

describe("HarmonyMcpToolService", () => {
  it("returns tool catalog entries with discovery metadata", () => {
    const service = new HarmonyMcpToolService({ includeBlueprints: true, version: "1" });
    const snapshot = service.snapshot();

    // Exposes freshness metadata for UI/tooling.
    expect(snapshot.manifest.generated_at).not.toBe("1970-01-01T00:00:00.000Z");
    expect(Number.isNaN(Date.parse(snapshot.manifest.generated_at))).toBe(false);

    const echo = snapshot.tools.find((t) => t.name === "golden.echo");
    expect(echo).toBeDefined();
    expect(echo?.type).toBe("CAPABILITY");
    expect(echo?.dataClassification).toBe("PUBLIC");

    // Discovery metadata (additive) enables catalog/palette IA.
    expect((echo as any)?.domain).toBe("demo");
    expect((echo as any)?.subdomain).toBe("echo");
    expect((echo as any)?.tags).toEqual(expect.arrayContaining(["demo"]));
    expect((echo as any)?.maintainer).toBe("platform");
    expect((echo as any)?.isIdempotent).toBe(true);
    expect((echo as any)?.costFactor).toBe("LOW");
    expect((echo as any)?.allowOutbound).toEqual([]);
    expect((echo as any)?.requiredScopes).toEqual([]);
  });

  it("refresh updates generated_at (monotonic)", () => {
    const service = new HarmonyMcpToolService({ includeBlueprints: true, version: "1" });
    const before = service.snapshot().manifest.generated_at;

    service.refresh();
    const after = service.snapshot().manifest.generated_at;

    expect(after).not.toBe(before);
    expect(Date.parse(after)).toBeGreaterThan(Date.parse(before));
  });
});

