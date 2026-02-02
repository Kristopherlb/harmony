/**
 * packages/apps/console/client/src/features/capabilities/__tests__/tool-taxonomy.test.ts
 * TDD: taxonomy derivation + collection membership for tool discovery IA.
 */
import { describe, it, expect } from "vitest";
import { deriveDomainParts, getCollectionsForToolId } from "../tool-taxonomy";

describe("deriveDomainParts", () => {
  it("derives demo domain for legacy golden.<name> tools", () => {
    expect(deriveDomainParts("golden.echo")).toEqual({ domain: "demo", subdomain: "echo" });
  });

  it("derives domain/subdomain for golden.<domain>.<subdomain...> tools", () => {
    expect(deriveDomainParts("golden.security.checkov")).toEqual({
      domain: "security",
      subdomain: "checkov",
    });
    expect(deriveDomainParts("golden.github.rest.request")).toEqual({
      domain: "github",
      subdomain: "rest.request",
    });
  });

  it("derives domain/subdomain for non-golden tool families", () => {
    expect(deriveDomainParts("workflows.echo")).toEqual({ domain: "workflows", subdomain: "echo" });
    expect(deriveDomainParts("blueprints.ci.release-pipeline")).toEqual({
      domain: "blueprints",
      subdomain: "ci.release-pipeline",
    });
  });
});

describe("getCollectionsForToolId", () => {
  it("classifies security tools into security collections", () => {
    const collections = getCollectionsForToolId({ toolId: "golden.security.checkov", tags: ["security", "iac"] });
    expect(collections).toEqual(expect.arrayContaining(["security_scanning"]));
  });

  it("classifies traffic/flags tools into progressive delivery collections", () => {
    const collections = getCollectionsForToolId({ toolId: "golden.traffic.mesh-router", tags: ["traffic", "service-mesh"] });
    expect(collections).toEqual(expect.arrayContaining(["progressive_delivery"]));
  });
});

