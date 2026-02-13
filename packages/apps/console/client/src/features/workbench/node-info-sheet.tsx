import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { BlueprintDraft, BlueprintNode } from "@/features/workbench/types";
import { buildExplainStepMessage } from "@/features/workbench/node-explanation";
import type { McpTool } from "@/features/workbench/use-mcp-tools";
import { asObjectSchema, isFilledValue, schemaRequiredKeys, missingRequiredKeys } from "@/features/workbench/required-fields";
import { useWorkflowProgress } from "@/features/workbench/use-workflow-progress";
import { useWorkflowStatus } from "@/features/workbench/use-workflow-status";

function findNode(draft: BlueprintDraft | null, nodeId: string | null): BlueprintNode | null {
  if (!draft || !nodeId) return null;
  return draft.nodes.find((n) => n.id === nodeId) ?? null;
}

type WorkbenchKind = "graphql" | "openapi";
type WorkbenchMode = "launch";

type WorkbenchCreateSessionResponse = {
  sessionId: string;
  expiresAt: string;
  launchUrl?: string;
};

function previewBody(text: string, maxChars: number = 400): string {
  const cleaned = text.replace(/\r/g, "").trim();
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars)}\n… (truncated)`;
}

function looksLikeViteDevHtml(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("/@vite/client") ||
    t.includes("createhotcontext") ||
    t.includes("vite-plugin-runtime-error") ||
    t.includes("__dummy__runtime-error-plugin")
  );
}

function inferProviderFromNodeType(nodeType: string): string {
  const prefix = nodeType.split(".", 1)[0]?.toLowerCase() ?? "";
  if (prefix === "jira") return "jira";
  if (prefix === "gitlab") return "gitlab";
  return "github";
}

export interface NodeInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: BlueprintDraft | null;
  selectedNodeId: string | null;
  /** Active workflow id for live execution mapping (Phase 4.3.2 / Phase 1 draft-run). */
  activeWorkflowId?: string | null;
  tools: McpTool[];
  pinned?: boolean;
  onPinnedChange?: (pinned: boolean) => void;
  onUpdateNodeProperties?: (input: {
    nodeId: string;
    nextProperties: Record<string, unknown>;
  }) => void;
  onRequestConfigureWithAgent?: (input: {
    selectedNodeId: string;
    missingRequired: string[];
  }) => void;
  /** Ask the agent to explain why this step was added (Phase 4.2.3) */
  onRequestExplain?: (input: { node: BlueprintNode }) => void;
}

export function NodeInfoSheet({
  open,
  onOpenChange,
  draft,
  selectedNodeId,
  activeWorkflowId,
  tools,
  pinned,
  onPinnedChange,
  onUpdateNodeProperties,
  onRequestConfigureWithAgent,
  onRequestExplain,
}: NodeInfoSheetProps) {
  const node = React.useMemo(() => findNode(draft, selectedNodeId), [draft, selectedNodeId]);
  const tool = React.useMemo(
    () => (node ? tools.find((t) => t.name === node.type) ?? null : null),
    [node, tools]
  );

  const progress = useWorkflowProgress(activeWorkflowId ?? null);
  const describe = useWorkflowStatus(activeWorkflowId ?? null);
  const stepForNode = React.useMemo(() => {
    if (!node) return null;
    const steps = progress?.steps ?? [];
    return steps.find((s) => s.nodeId === node.id) ?? null;
  }, [node?.id, progress?.steps]);
  const required = React.useMemo(() => schemaRequiredKeys(tool?.inputSchema), [tool]);
  const missing = React.useMemo(
    () =>
      node
        ? missingRequiredKeys({
            properties: node.properties as any,
            required,
          })
        : [],
    [node, required]
  );

  const classification = tool?.dataClassification ?? "INTERNAL";

  const exploration = tool?.exploration ?? { kind: "none" as const, connectionType: "none" as const };

  const provider = React.useMemo(() => {
    if (exploration.connectionType !== "none") return exploration.connectionType;
    return node ? inferProviderFromNodeType(node.type) : "github";
  }, [node, exploration.connectionType]);

  const [localProperties, setLocalProperties] = React.useState<Record<string, unknown>>({});
  const [propertiesText, setPropertiesText] = React.useState<string>("{}");
  const [propertiesError, setPropertiesError] = React.useState<string | null>(null);

  const [resultStatus, setResultStatus] = React.useState<"idle" | "loading" | "ready" | "error">("idle");
  const [resultError, setResultError] = React.useState<string | null>(null);
  const [resultForNode, setResultForNode] = React.useState<unknown>(null);

  React.useEffect(() => {
    const base =
      node?.properties && typeof node.properties === "object"
        ? (node.properties as Record<string, unknown>)
        : {};
    const snapshot = { ...base };
    setLocalProperties(snapshot);
    setPropertiesText(JSON.stringify(snapshot, null, 2));
    setPropertiesError(null);
  }, [node?.id]);

  // Best-effort: fetch workflow result so we can show a per-node output preview.
  React.useEffect(() => {
    if (!open) return;
    if (!activeWorkflowId) return;
    if (!node) return;

    if (describe?.status !== "COMPLETED") {
      setResultStatus("idle");
      setResultError(null);
      setResultForNode(null);
      return;
    }

    let cancelled = false;
    setResultStatus("loading");
    setResultError(null);
    setResultForNode(null);

    fetch(`/api/workflows/${encodeURIComponent(activeWorkflowId)}/result`, { credentials: "include" })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const root = (json as any)?.result ?? null;
        const byNode = root && typeof root === "object" ? (root as any).resultsByNodeId : null;
        setResultForNode(byNode && typeof byNode === "object" ? (byNode as any)[node.id] : null);
        setResultStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setResultStatus("error");
        setResultError(String((e as any)?.message ?? e));
      });

    return () => {
      cancelled = true;
    };
  }, [open, activeWorkflowId, node?.id, describe?.status]);

  const missingLocal = React.useMemo(() => {
    if (!node) return [];
    return missingRequiredKeys({ properties: localProperties, required });
  }, [node, required, localProperties]);

  // Phase 1 Fix-it UX: when a node is selected and has missing required fields,
  // focus the first missing input so users can fix immediately.
  React.useEffect(() => {
    if (!open) return;
    if (!node) return;
    if (missingLocal.length === 0) return;
    const key = missingLocal[0];
    requestAnimationFrame(() => {
      const el = typeof document !== "undefined" ? document.getElementById(`required-${key}`) : null;
      if (el && "focus" in el) (el as any).focus();
    });
  }, [open, node?.id, missingLocal.join(",")]);

  function updateLocalProperty(key: string, value: unknown) {
    setLocalProperties((prev) => {
      const next = { ...prev };
      if (!isFilledValue(value)) {
        delete next[key];
      } else {
        next[key] = value;
      }
      setPropertiesText(JSON.stringify(next, null, 2));
      setPropertiesError(null);
      return next;
    });
  }

  function applyPropertiesToDraft() {
    if (!node || !onUpdateNodeProperties) return;
    setPropertiesError(null);

    try {
      const parsed = JSON.parse(propertiesText) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Properties must be a JSON object.");
      }
      onUpdateNodeProperties({
        nodeId: node.id,
        nextProperties: parsed as Record<string, unknown>,
      });
    } catch (e: any) {
      setPropertiesError(String(e?.message ?? e));
    }
  }

  const [launchStatus, setLaunchStatus] = React.useState<"idle" | "loading" | "ready" | "error">("idle");
  const [launchError, setLaunchError] = React.useState<string | null>(null);
  const [launchUrl, setLaunchUrl] = React.useState<string | null>(null);
  const [launchExpiresAt, setLaunchExpiresAt] = React.useState<string | null>(null);

  async function launch(kind: WorkbenchKind) {
    setLaunchStatus("loading");
    setLaunchError(null);
    setLaunchUrl(null);
    setLaunchExpiresAt(null);

    try {
      const body = {
        provider,
        kind,
        mode: "launch" as WorkbenchMode,
      };
      const res = await fetch("/api/workbench/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        throw new Error(
          `Workbench session request failed (${res.status}).\n\n${previewBody(text) || res.statusText}`
        );
      }

      if (!contentType.toLowerCase().includes("application/json")) {
        const origin = typeof window !== "undefined" ? window.location.origin : "(unknown origin)";
        const isViteOverlay = looksLikeViteDevHtml(text);
        throw new Error(
          [
            `Expected JSON from /api/workbench/sessions but received ${contentType || "(no content-type)"}.`,
            "",
            `Current page origin: ${origin}`,
            "",
            isViteOverlay
              ? "This looks like Vite dev HTML (runtime error overlay). That usually means you’re running the client dev server without the Console API server (or the /api proxy can’t reach it)."
              : "This usually means the dev server returned HTML instead of proxying to the Console API.",
            "",
            "Fix:",
            "- Start the Console server (it serves BOTH UI and API): `pnpm nx serve console` (or `pnpm -C packages/apps/console dev`).",
            "- If you insist on running Vite standalone, ensure its `/api` proxy points to the Console server and that the Console server is reachable on the expected port (default 5000).",
            "",
            "Response preview:",
            previewBody(text) || "(empty)",
          ].join("\n")
        );
      }

      let json: WorkbenchCreateSessionResponse;
      try {
        json = JSON.parse(text) as WorkbenchCreateSessionResponse;
      } catch {
        throw new Error(
          [
            "Failed to parse JSON from /api/workbench/sessions.",
            "",
            "Response preview:",
            previewBody(text) || "(empty)",
          ].join("\n")
        );
      }
      if (!json.launchUrl) throw new Error("Workbench session did not include launchUrl");

      setLaunchUrl(json.launchUrl);
      setLaunchExpiresAt(json.expiresAt);
      setLaunchStatus("ready");

      window.open(json.launchUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setLaunchStatus("error");
      const msg = String(e?.message ?? e);
      setLaunchError(msg);
      // Best-effort logging (helpful when devtools are available).
      // eslint-disable-next-line no-console
      console.error("Workbench launch failed:", msg);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[420px] sm:w-[520px] flex flex-col font-mono"
        data-testid="workbench-node-info-sheet"
      >
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-base truncate">
                {node?.label ?? "Node details"}
              </SheetTitle>
              <SheetDescription className="text-xs font-mono">
                {node?.type ?? "No node selected"}
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              {onPinnedChange ? (
                <Button
                  variant={pinned ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onPinnedChange(!pinned)}
                  data-testid="button-pin-info-pane"
                >
                  {pinned ? "Pinned" : "Pin"}
                </Button>
              ) : null}
              {stepForNode ? (
                <Badge
                  variant={stepForNode.status === "failed" ? "destructive" : "secondary"}
                  className="text-[10px] font-mono"
                >
                  {stepForNode.status}
                </Badge>
              ) : describe?.status ? (
                <Badge variant="outline" className="text-[10px] font-mono">
                  wf:{describe.status}
                </Badge>
              ) : null}
              {tool?.costFactor ? (
                <Badge variant="outline" className="text-[10px] font-mono">
                  cost:{tool.costFactor}
                </Badge>
              ) : null}
              <Badge variant="secondary" className="text-[10px] font-mono">
                {classification}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 py-6">
          <div className="space-y-6 pr-4">
            {activeWorkflowId ? (
              <>
                <section className="space-y-3" aria-label="Execution">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Execution
                  </div>
                  <Card className="p-3 space-y-2">
                    <div className="text-xs text-muted-foreground">
                      workflowId: <span className="font-mono">{activeWorkflowId}</span>
                    </div>
                    {resultStatus === "loading" ? (
                      <div className="text-xs text-muted-foreground">Loading result…</div>
                    ) : resultStatus === "error" ? (
                      <div className="text-xs text-destructive">{resultError ?? "Failed to load result"}</div>
                    ) : resultStatus === "ready" && resultForNode !== null ? (
                      <pre className="mt-1 rounded-md border bg-muted p-2 overflow-auto max-h-[180px] text-[11px]">
                        {JSON.stringify(resultForNode, null, 2)}
                      </pre>
                    ) : (
                      <div className="text-xs text-muted-foreground">No output yet.</div>
                    )}
                  </Card>
                </section>

                <Separator />
              </>
            ) : null}

            <section className="space-y-3" aria-label="Overview">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Overview
              </div>
              <Card className="p-3 space-y-2">
                <div className="text-xs text-muted-foreground">Tool</div>
                <div className="text-sm font-semibold truncate" title={node?.type ?? ""}>
                  {node?.type ?? "—"}
                </div>
                {tool?.description ? (
                  <div className="text-xs text-muted-foreground leading-5">
                    {tool.description}
                  </div>
                ) : null}
                {node && onRequestExplain ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7 text-xs"
                    onClick={() => onRequestExplain({ node })}
                    data-testid="button-explain-step"
                  >
                    Explain step
                  </Button>
                ) : null}
              </Card>
            </section>

            <Separator />

            <section className="space-y-3" aria-label="Required">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Required
                </div>
                {node && onRequestConfigureWithAgent ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      if (!selectedNodeId) return;
                      onRequestConfigureWithAgent({ selectedNodeId, missingRequired: missing });
                    }}
                    data-testid="button-configure-with-agent"
                  >
                    Configure with agent
                  </Button>
                ) : null}
              </div>

              {!node ? (
                <div className="text-xs text-muted-foreground">Select a node to view requirements.</div>
              ) : required.length === 0 ? (
                <div className="text-xs text-muted-foreground" data-testid="required-none">
                  No required fields detected for this tool.
                </div>
              ) : (
                <div className="space-y-2" data-testid="required-fields">
                  <div className="text-xs text-muted-foreground">
                    missing:{" "}
                    <span className="font-mono" data-testid="required-missing">
                      {missingLocal.length ? missingLocal.join(", ") : "—"}
                    </span>
                  </div>
                  <Card className="p-3 space-y-3">
                    {required.map((key) => {
                      const schemaObj = asObjectSchema(tool?.inputSchema);
                      const prop = (schemaObj?.properties?.[key] as any) ?? null;
                      const type = typeof prop?.type === "string" ? (prop.type as string) : "string";
                      const description =
                        typeof prop?.description === "string" ? (prop.description as string) : undefined;
                      const value = localProperties[key];

                      return (
                        <div key={key} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-3">
                            <Label className="text-xs font-mono" htmlFor={`required-${key}`}>
                              {key}
                            </Label>
                            <span className="text-[10px] text-muted-foreground font-mono">{type}</span>
                          </div>
                          {description ? (
                            <div className="text-[11px] text-muted-foreground leading-5">
                              {description}
                            </div>
                          ) : null}
                          <Input
                            id={`required-${key}`}
                            placeholder={key}
                            value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (type === "number" || type === "integer") {
                                const n = Number(raw);
                                if (raw.trim().length === 0) updateLocalProperty(key, undefined);
                                else if (Number.isFinite(n)) updateLocalProperty(key, n);
                                else updateLocalProperty(key, raw);
                                return;
                              }
                              updateLocalProperty(key, raw);
                            }}
                            className={missingLocal.includes(key) ? "border-destructive" : ""}
                            data-testid={`required-input-${key}`}
                          />
                        </div>
                      );
                    })}
                  </Card>
                </div>
              )}
            </section>

            <Separator />

            <section className="space-y-3" aria-label="Properties">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Properties
                </div>
                {node && onUpdateNodeProperties ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={applyPropertiesToDraft}
                    data-testid="button-apply-properties"
                  >
                    Apply to draft
                  </Button>
                ) : null}
              </div>

              {!node ? (
                <div className="text-xs text-muted-foreground">Select a node to edit properties.</div>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    value={propertiesText}
                    onChange={(e) => {
                      setPropertiesText(e.target.value);
                      setPropertiesError(null);
                    }}
                    className="font-mono text-[11px] min-h-[180px]"
                    data-testid="properties-json"
                  />
                  {propertiesError ? (
                    <div className="text-xs text-destructive" data-testid="properties-error">
                      {propertiesError}
                    </div>
                  ) : null}
                </div>
              )}
            </section>

            <Separator />

            <section className="space-y-3" aria-label="Playground">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Playground
              </div>
              <Card className="p-3 space-y-3">
                <div className="text-xs text-muted-foreground">
                  Provider: <span className="font-mono">{provider}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {exploration.kind === "openapi" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={launchStatus === "loading"}
                      onClick={() => launch("openapi")}
                      data-testid="button-launch-swagger"
                    >
                      Open Swagger
                    </Button>
                  ) : exploration.kind === "graphql" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={launchStatus === "loading"}
                      onClick={() => launch("graphql")}
                      data-testid="button-launch-graphiql"
                    >
                      Open GraphQL
                    </Button>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      No explorer available for this capability.
                    </div>
                  )}
                </div>

                {launchStatus === "error" && launchError ? (
                  <div className="text-xs text-destructive whitespace-pre-wrap" data-testid="launch-error">
                    {launchError}
                  </div>
                ) : null}

                {launchStatus === "ready" && launchUrl ? (
                  <div className="space-y-2" data-testid="launch-result">
                    <div className="text-xs text-muted-foreground">
                      expiresAt: <span className="font-mono">{launchExpiresAt ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(launchUrl);
                          } catch {
                            // ignore
                          }
                        }}
                        data-testid="button-copy-launch-url"
                      >
                        Copy link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => window.open(launchUrl, "_blank", "noopener,noreferrer")}
                        data-testid="button-open-launch-url"
                      >
                        Open again
                      </Button>
                    </div>
                  </div>
                ) : null}
              </Card>
            </section>

            <Separator />

            <section className="space-y-3" aria-label="Details">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Details
              </div>
              {tool?.inputSchema ? (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    Show input schema
                  </summary>
                  <pre className="mt-2 rounded-md border bg-muted p-3 overflow-auto max-h-[320px] text-[11px]">
                    {JSON.stringify(tool.inputSchema, null, 2)}
                  </pre>
                </details>
              ) : (
                <div className="text-xs text-muted-foreground">No schema available.</div>
              )}
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

