/**
 * packages/apps/console/client/src/pages/capabilities-catalog.tsx
 * Capabilities Catalog: guided discovery + facets + tool details.
 */
import React from "react";
import { Link, useLocation } from "wouter";
import { Search, Shield, Route, Boxes, Wrench, ArrowRight, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMcpToolCatalog, type McpTool } from "@/features/workbench/use-mcp-tools";
import { deriveDomainParts, getCollectionsForToolId, type ToolCollectionId } from "@/features/capabilities/tool-taxonomy";

type ToolType = McpTool["type"];
type ToolClassification = McpTool["dataClassification"];

const COLLECTIONS: Array<{
  id: ToolCollectionId;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "progressive_delivery",
    title: "Progressive delivery",
    description: "Rollouts, canary, traffic shifting, feature flags.",
    icon: Route,
  },
  {
    id: "security_scanning",
    title: "Security scanning",
    description: "SAST, IaC scanning, SBOM, supply chain checks.",
    icon: Shield,
  },
];

function uniqSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function friendlyDomainLabel(domain: string): string {
  const d = domain.toLowerCase();
  if (d === "ci") return "CI/CD";
  if (d === "sbom") return "SBOM";
  if (d === "k8s") return "Kubernetes";
  if (d === "demo") return "Demo";
  if (d === "workflows") return "Workflows";
  if (d === "blueprints") return "Blueprints";
  return d.replace(/-/g, " ");
}

function toolDomain(tool: McpTool): string {
  if (tool.domain && tool.domain.trim().length > 0) return tool.domain;
  return deriveDomainParts(tool.name).domain;
}

function toolSubdomain(tool: McpTool): string {
  if (tool.subdomain && tool.subdomain.trim().length > 0) return tool.subdomain;
  return deriveDomainParts(tool.name).subdomain;
}

function toolCollections(tool: McpTool): ToolCollectionId[] {
  return getCollectionsForToolId({ toolId: tool.name, tags: tool.tags, domain: toolDomain(tool) });
}

function toolMatchesQuery(tool: McpTool, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${tool.name} ${tool.description ?? ""} ${(tool.tags ?? []).join(" ")}`.toLowerCase();
  return hay.includes(q);
}

export default function CapabilitiesCatalogPage(): JSX.Element {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { tools, loading, error, data, refresh, refreshing } = useMcpToolCatalog();

  const [activeCollection, setActiveCollection] = React.useState<ToolCollectionId | "all">("all");
  const [query, setQuery] = React.useState("");
  const [domainFilter, setDomainFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<ToolType | "all">("all");
  const [classificationFilter, setClassificationFilter] = React.useState<ToolClassification | "all">("all");

  const [selectedToolId, setSelectedToolId] = React.useState<string | null>(null);
  const selectedTool = React.useMemo(
    () => tools.find((t) => t.name === selectedToolId) ?? null,
    [tools, selectedToolId]
  );

  const domains = React.useMemo(() => {
    return uniqSorted(tools.map(toolDomain));
  }, [tools]);

  const countsByDomain = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tools) {
      const d = toolDomain(t);
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    return map;
  }, [tools]);

  const collectionCounts = React.useMemo(() => {
    const map = new Map<ToolCollectionId, number>();
    for (const c of COLLECTIONS) map.set(c.id, 0);
    for (const t of tools) {
      for (const c of toolCollections(t)) map.set(c, (map.get(c) ?? 0) + 1);
    }
    return map;
  }, [tools]);

  const filteredTools = React.useMemo(() => {
    return tools
      .filter((t) => toolMatchesQuery(t, query))
      .filter((t) => (domainFilter === "all" ? true : toolDomain(t) === domainFilter))
      .filter((t) => (typeFilter === "all" ? true : t.type === typeFilter))
      .filter((t) => (classificationFilter === "all" ? true : t.dataClassification === classificationFilter))
      .filter((t) => (activeCollection === "all" ? true : toolCollections(t).includes(activeCollection)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tools, query, domainFilter, typeFilter, classificationFilter, activeCollection]);

  const clearFilters = () => {
    setActiveCollection("all");
    setQuery("");
    setDomainFilter("all");
    setTypeFilter("all");
    setClassificationFilter("all");
  };

  const onCopyToolId = async (toolId: string) => {
    try {
      await navigator.clipboard.writeText(toolId);
      toast({ title: "Copied", description: "Tool ID copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Could not access clipboard.", variant: "destructive" });
    }
  };

  return (
    <div data-testid="capabilities-catalog-page" className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Capabilities</h1>
          </div>
          <div className="text-sm text-muted-foreground">
            Browse tools by outcome, category, or filters.{" "}
            <span className="font-mono">
              {data?.manifest?.version ? `MCP v${data.manifest.version}` : ""}
            </span>
              {data?.manifest?.generated_at ? (
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  updated:{new Date(data.manifest.generated_at).toLocaleString()}
                </span>
              ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={refreshing || loading}
              onClick={() => refresh()}
            >
              {refreshing ? "Refreshing…" : "Refresh tools"}
            </Button>
          <Link href="/workbench">
            <Button variant="secondary" className="gap-2">
              <Wrench className="h-4 w-4" />
              Open Workbench
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="guided">
        <TabsList>
          <TabsTrigger value="guided">I want to…</TabsTrigger>
          <TabsTrigger value="browse">Browse</TabsTrigger>
        </TabsList>

        <TabsContent value="guided" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {COLLECTIONS.map((c) => {
              const Icon = c.icon;
              const count = collectionCounts.get(c.id) ?? 0;
              const active = activeCollection === c.id;
              return (
                <Card
                  key={c.id}
                  className={`cursor-pointer transition-colors ${active ? "border-primary" : ""}`}
                  onClick={() => setActiveCollection((prev) => (prev === c.id ? "all" : c.id))}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {c.title}
                        </CardTitle>
                        <div className="text-xs text-muted-foreground">{c.description}</div>
                      </div>
                      <Badge variant={active ? "default" : "secondary"} className="font-mono text-[10px]">
                        {count}
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-2.5" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search tools…"
                    className="pl-9"
                  />
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <Select value={domainFilter} onValueChange={setDomainFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Domain" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All domains</SelectItem>
                      {domains.map((d) => (
                        <SelectItem key={d} value={d}>
                          {friendlyDomainLabel(d)} ({countsByDomain.get(d) ?? 0})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ToolType | "all")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="CAPABILITY">Capabilities</SelectItem>
                      <SelectItem value="BLUEPRINT">Blueprints</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={classificationFilter}
                    onValueChange={(v) => setClassificationFilter(v as ToolClassification | "all")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Classification" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All classifications</SelectItem>
                      <SelectItem value="PUBLIC">PUBLIC</SelectItem>
                      <SelectItem value="INTERNAL">INTERNAL</SelectItem>
                      <SelectItem value="CONFIDENTIAL">CONFIDENTIAL</SelectItem>
                      <SelectItem value="RESTRICTED">RESTRICTED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={clearFilters} className="w-full">
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold">
                    Results{" "}
                    <span className="text-muted-foreground font-mono text-xs">({filteredTools.length})</span>
                  </CardTitle>
                  {activeCollection !== "all" ? (
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {activeCollection}
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-4 text-sm text-muted-foreground">Loading tools…</div>
                ) : error ? (
                  <div className="p-4 text-sm text-destructive">Failed to load tools. ({error.message})</div>
                ) : filteredTools.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">No tools match the current filters.</div>
                ) : (
                  <ScrollArea className="h-[520px]">
                    <div className="divide-y">
                      {filteredTools.map((t) => {
                        const d = toolDomain(t);
                        const sd = toolSubdomain(t);
                        return (
                          <button
                            key={t.name}
                            type="button"
                            onClick={() => setSelectedToolId(t.name)}
                            className="w-full text-left p-4 hover:bg-accent/40 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs truncate">{t.name}</span>
                                  <Badge variant="outline" className="text-[10px]">
                                    {friendlyDomainLabel(d)}
                                  </Badge>
                                  <Badge variant="secondary" className="text-[10px]">
                                    {t.type}
                                  </Badge>
                                  <Badge
                                    variant={t.dataClassification === "RESTRICTED" ? "destructive" : "secondary"}
                                    className="text-[10px] font-mono"
                                  >
                                    {t.dataClassification}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground line-clamp-2">
                                  {t.description}
                                </div>
                                {sd ? (
                                  <div className="text-[10px] text-muted-foreground font-mono">sub: {sd}</div>
                                ) : null}
                                {(t.tags?.length ?? 0) > 0 ? (
                                  <div className="flex flex-wrap gap-1 pt-1">
                                    {(t.tags ?? []).slice(0, 6).map((tag) => (
                                      <Badge key={tag} variant="outline" className="text-[10px]">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="browse" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {domains.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`p-3 rounded-md border text-left hover:bg-accent/40 transition-colors ${
                      domainFilter === d ? "border-primary" : "border-border"
                    }`}
                    onClick={() => setDomainFilter((prev) => (prev === d ? "all" : d))}
                  >
                    <div className="text-xs font-semibold">{friendlyDomainLabel(d)}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{countsByDomain.get(d) ?? 0}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="text-sm text-muted-foreground">
            Use the filters in the “I want to…” tab to search and narrow results.
          </div>
        </TabsContent>
      </Tabs>

      <Sheet open={!!selectedToolId} onOpenChange={(open) => !open && setSelectedToolId(null)}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm truncate">{selectedTool?.name ?? ""}</span>
            </SheetTitle>
          </SheetHeader>

          {selectedTool ? (
            <div className="pt-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {selectedTool.type}
                </Badge>
                <Badge
                  variant={selectedTool.dataClassification === "RESTRICTED" ? "destructive" : "secondary"}
                  className="text-[10px] font-mono"
                >
                  {selectedTool.dataClassification}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {friendlyDomainLabel(toolDomain(selectedTool))}
                </Badge>
                {selectedTool.costFactor ? (
                  <Badge variant="outline" className="text-[10px] font-mono">
                    cost:{selectedTool.costFactor}
                  </Badge>
                ) : null}
                {typeof selectedTool.isIdempotent === "boolean" ? (
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {selectedTool.isIdempotent ? "idempotent" : "non-idempotent"}
                  </Badge>
                ) : null}
              </div>

              <div className="text-sm">{selectedTool.description}</div>

              {(selectedTool.tags?.length ?? 0) > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags</div>
                  <div className="flex flex-wrap gap-1">
                    {(selectedTool.tags ?? []).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedTool.requiredScopes?.length ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Required scopes
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">
                    {selectedTool.requiredScopes.join(", ")}
                  </div>
                </div>
              ) : null}

              {selectedTool.allowOutbound?.length ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Outbound network
                  </div>
                  <div className="text-xs font-mono text-muted-foreground break-words">
                    {selectedTool.allowOutbound.join(", ")}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="secondary"
                  className="gap-2"
                  onClick={() => {
                    setSelectedToolId(null);
                    setLocation("/workbench");
                  }}
                >
                  <Wrench className="h-4 w-4" />
                  Use in Workbench
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => onCopyToolId(selectedTool.name)}>
                  <Copy className="h-4 w-4" />
                  Copy ID
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

