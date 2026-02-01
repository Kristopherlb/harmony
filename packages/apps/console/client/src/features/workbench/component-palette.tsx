import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GripVertical } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { useMcpToolCatalog } from "./use-mcp-tools";

const DraggableNode = ({ type, label, color }: { type: string; label: string; color: string }) => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      className={`flex items-center gap-2 p-3 text-sm font-medium border rounded-md cursor-grab bg-card hover:bg-accent/50 transition-colors ${color}`}
      onDragStart={(event) => onDragStart(event, type)}
      draggable
    >
      <GripVertical className="w-4 h-4 text-muted-foreground" />
      {label}
    </div>
  );
};

function groupForToolId(toolId: string) {
  const [group] = toolId.split(".", 1);
  return group || "other";
}

export function ComponentPalette({
  onInsertTool,
}: {
  onInsertTool?: (toolId: string) => void;
}) {
  const { tools, loading, error, data } = useMcpToolCatalog();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter((t) => {
      return (
        t.name.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q)
      );
    });
  }, [tools, query]);

  const groups = React.useMemo(() => {
    const byGroup = new Map<string, typeof filtered>();
    for (const t of filtered) {
      const g = groupForToolId(t.name);
      byGroup.set(g, [...(byGroup.get(g) ?? []), t]);
    }
    return Array.from(byGroup.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <Card className="h-full border-r rounded-none border-y-0 border-l-0">
      <CardHeader className="p-4 border-b">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">Components</CardTitle>
          <Badge variant="secondary" className="text-[10px] font-mono">
            {data?.manifest?.version ? `MCP v${data.manifest.version}` : "Cmd/Ctrl+K"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-6">
        <div className="space-y-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools…"
            className="h-9"
          />
          <div className="text-[10px] text-muted-foreground">
            Press <span className="font-mono">Cmd/Ctrl+K</span> for quick insert
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Primitives
          </h3>
          <DraggableNode type="start" label="Start" color="border-green-200 dark:border-green-900" />
          <DraggableNode type="sleep" label="Sleep" color="border-blue-200 dark:border-blue-900" />
          <DraggableNode type="log" label="Log" color="border-slate-200 dark:border-slate-800" />
          <DraggableNode type="condition" label="Condition (If/Else)" color="border-orange-200 dark:border-orange-900" />
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Harmony MCP tools
          </h3>
          {loading ? (
            <div className="text-xs text-muted-foreground">Loading tools…</div>
          ) : error ? (
            <div className="text-xs text-destructive">
              Failed to load MCP tools. ({error.message})
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground">No tools match.</div>
          ) : (
            <div className="space-y-3">
              {groups.map(([group, groupTools]) => (
                <div key={group} className="space-y-2">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {group}
                  </div>
                  {groupTools.map((t) => (
                    <DraggableNode
                      key={t.name}
                      type={t.name}
                      label={t.description ? `${t.name} — ${t.description}` : t.name}
                      color="border-purple-200 dark:border-purple-900"
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search tools…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          {groups.map(([group, groupTools]) => (
            <CommandGroup key={group} heading={group}>
              {groupTools.map((t) => (
                <CommandItem
                  key={t.name}
                  value={`${t.name} ${t.description ?? ""}`}
                  onSelect={() => {
                    setOpen(false);
                    onInsertTool?.(t.name);
                  }}
                >
                  <span className="font-mono text-xs">{t.name}</span>
                  <span className="text-xs text-muted-foreground line-clamp-1">
                    {t.description}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </Card>
  );
}
