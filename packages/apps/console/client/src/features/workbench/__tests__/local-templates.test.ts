/**
 * packages/apps/console/client/src/features/workbench/__tests__/local-templates.test.ts
 * Unit tests for locally saved templates (Phase 4.4.1).
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { TemplateDraftLike } from "../template-insertion";
import { clearLocalTemplates, loadLocalTemplates, saveLocalTemplate } from "../library/local-templates";

describe("library local-templates", () => {
  beforeEach(() => {
    clearLocalTemplates();
  });

  it("saves and loads templates from localStorage", () => {
    const tpl: TemplateDraftLike = {
      id: "local-1",
      name: "My template",
      description: "A local template",
      title: "My workflow",
      summary: "Does things",
      nodes: [{ id: "start", label: "Start", type: "start" }],
      edges: [],
    };

    saveLocalTemplate(tpl);
    expect(loadLocalTemplates()).toEqual([tpl]);
  });
});

