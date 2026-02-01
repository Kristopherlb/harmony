import { describe, it, expect } from "vitest";
import {
  WizAdapter,
  AWSInspectorAdapter,
  ArtifactoryXrayAdapter,
  securityAdapters,
  getSecurityAdapter,
  isValidSecurityTool,
  type WizPayload,
  type AWSInspectorPayload,
  type ArtifactoryXrayPayload,
} from "./security-adapters";

describe("WizAdapter", () => {
  const adapter = new WizAdapter();

  it("should have correct tool identifier", () => {
    expect(adapter.tool).toBe("wiz");
  });

  it("should transform valid Wiz payload to finding", () => {
    const payload: WizPayload = {
      id: "wiz-123",
      severity: "CRITICAL",
      vulnerabilityName: "CVE-2024-1234: Remote Code Execution",
      cve: "CVE-2024-1234",
      resource: {
        name: "api-gateway:latest",
        type: "container",
      },
      status: "OPEN",
      description: "Critical vulnerability in base image",
      detectedAt: "2024-01-15T10:00:00Z",
      url: "https://app.wiz.io/issues/wiz-123",
    };

    const finding = adapter.transformToFinding(payload);

    expect(finding).not.toBeNull();
    expect(finding!.severity).toBe("critical");
    expect(finding!.tool).toBe("wiz");
    expect(finding!.cve).toBe("CVE-2024-1234");
    expect(finding!.asset).toBe("api-gateway:latest");
    expect(finding!.status).toBe("open");
    expect(finding!.title).toBe("CVE-2024-1234: Remote Code Execution");
    expect(finding!.externalLink).toBe("https://app.wiz.io/issues/wiz-123");
  });

  it("should normalize severity levels", () => {
    expect(adapter.transformToFinding({ severity: "CRITICAL", resource: {} })!.severity).toBe("critical");
    expect(adapter.transformToFinding({ severity: "HIGH", resource: {} })!.severity).toBe("high");
    expect(adapter.transformToFinding({ severity: "MEDIUM", resource: {} })!.severity).toBe("medium");
    expect(adapter.transformToFinding({ severity: "LOW", resource: {} })!.severity).toBe("low");
    expect(adapter.transformToFinding({ severity: "URGENT", resource: {} })!.severity).toBe("critical");
  });

  it("should normalize status levels", () => {
    expect(adapter.transformToFinding({ status: "OPEN", resource: {} })!.status).toBe("open");
    expect(adapter.transformToFinding({ status: "RESOLVED", resource: {} })!.status).toBe("resolved");
    expect(adapter.transformToFinding({ status: "RISK_ACCEPTED", resource: {} })!.status).toBe("ignored");
  });

  it("should return null for null or invalid payload", () => {
    expect(adapter.transformToFinding(null)).toBeNull();
    expect(adapter.transformToFinding(undefined)).toBeNull();
  });

  it("should handle missing optional fields", () => {
    const payload: WizPayload = {
      resource: { name: "test-asset" },
    };

    const finding = adapter.transformToFinding(payload);

    expect(finding).not.toBeNull();
    expect(finding!.asset).toBe("test-asset");
    expect(finding!.cve).toBeUndefined();
    expect(finding!.severity).toBe("medium");
    expect(finding!.status).toBe("open");
  });
});

describe("AWSInspectorAdapter", () => {
  const adapter = new AWSInspectorAdapter();

  it("should have correct tool identifier", () => {
    expect(adapter.tool).toBe("aws_inspector");
  });

  it("should transform valid AWS Inspector payload to finding", () => {
    const payload: AWSInspectorPayload = {
      findingArn: "arn:aws:inspector2:us-east-1:123456789:finding/abc123",
      severity: "HIGH",
      title: "CVE-2024-5678 - SQL Injection Vulnerability",
      vulnerabilityId: "CVE-2024-5678",
      resources: [
        { id: "i-0123456789abcdef0", type: "EC2_INSTANCE" },
      ],
      status: "ACTIVE",
      description: "SQL injection vulnerability in application",
      firstObservedAt: "2024-01-15T10:00:00Z",
    };

    const finding = adapter.transformToFinding(payload);

    expect(finding).not.toBeNull();
    expect(finding!.severity).toBe("high");
    expect(finding!.tool).toBe("aws_inspector");
    expect(finding!.cve).toBe("CVE-2024-5678");
    expect(finding!.asset).toBe("i-0123456789abcdef0");
    expect(finding!.status).toBe("open");
    expect(finding!.title).toBe("CVE-2024-5678 - SQL Injection Vulnerability");
    expect(finding!.externalLink).toContain("inspector2");
  });

  it("should handle SUPPRESSED status as resolved", () => {
    const payload: AWSInspectorPayload = {
      status: "SUPPRESSED",
      resources: [{ id: "test" }],
    };

    const finding = adapter.transformToFinding(payload);
    expect(finding!.status).toBe("resolved");
  });

  it("should return null for invalid payload", () => {
    expect(adapter.transformToFinding(null)).toBeNull();
  });
});

describe("ArtifactoryXrayAdapter", () => {
  const adapter = new ArtifactoryXrayAdapter();

  it("should have correct tool identifier", () => {
    expect(adapter.tool).toBe("artifactory_xray");
  });

  it("should transform valid Xray payload to finding", () => {
    const payload: ArtifactoryXrayPayload = {
      id: "xray-456",
      severity: "High",
      summary: "Outdated dependency with known vulnerability",
      cves: [{ cve: "CVE-2024-9012" }],
      impacted_artifacts: [
        { name: "lodash", path: "npm://lodash:4.17.20" },
      ],
      status: "Open",
      description: "Lodash before 4.17.21 has prototype pollution",
      created: "2024-01-15T10:00:00Z",
      issue_id: "XRAY-12345",
    };

    const finding = adapter.transformToFinding(payload);

    expect(finding).not.toBeNull();
    expect(finding!.severity).toBe("high");
    expect(finding!.tool).toBe("artifactory_xray");
    expect(finding!.cve).toBe("CVE-2024-9012");
    expect(finding!.asset).toBe("npm://lodash:4.17.20");
    expect(finding!.status).toBe("open");
    expect(finding!.title).toBe("Outdated dependency with known vulnerability");
    expect(finding!.externalLink).toContain("XRAY-12345");
  });

  it("should use artifact name if path is not available", () => {
    const payload: ArtifactoryXrayPayload = {
      impacted_artifacts: [{ name: "express" }],
    };

    const finding = adapter.transformToFinding(payload);
    expect(finding!.asset).toBe("express");
  });

  it("should handle missing CVEs", () => {
    const payload: ArtifactoryXrayPayload = {
      impacted_artifacts: [{ name: "test" }],
      cves: [],
    };

    const finding = adapter.transformToFinding(payload);
    expect(finding!.cve).toBeUndefined();
  });

  it("should return null for invalid payload", () => {
    expect(adapter.transformToFinding(null)).toBeNull();
  });
});

describe("securityAdapters map", () => {
  it("should have all three adapters", () => {
    expect(securityAdapters.wiz).toBeInstanceOf(WizAdapter);
    expect(securityAdapters.aws_inspector).toBeInstanceOf(AWSInspectorAdapter);
    expect(securityAdapters.artifactory_xray).toBeInstanceOf(ArtifactoryXrayAdapter);
  });
});

describe("getSecurityAdapter", () => {
  it("should return correct adapter for each tool", () => {
    expect(getSecurityAdapter("wiz")).toBeInstanceOf(WizAdapter);
    expect(getSecurityAdapter("aws_inspector")).toBeInstanceOf(AWSInspectorAdapter);
    expect(getSecurityAdapter("artifactory_xray")).toBeInstanceOf(ArtifactoryXrayAdapter);
  });
});

describe("isValidSecurityTool", () => {
  it("should return true for valid tools", () => {
    expect(isValidSecurityTool("wiz")).toBe(true);
    expect(isValidSecurityTool("aws_inspector")).toBe(true);
    expect(isValidSecurityTool("artifactory_xray")).toBe(true);
  });

  it("should return false for invalid tools", () => {
    expect(isValidSecurityTool("invalid")).toBe(false);
    expect(isValidSecurityTool("")).toBe(false);
    expect(isValidSecurityTool("snyk")).toBe(false);
  });
});
