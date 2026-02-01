import React from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type BlueprintFlowNodeData = {
  label: string;
  toolId?: string;
  description?: string;
};

export function BlueprintFlowNode({
  data,
  selected,
}: NodeProps<{ label: string; toolId?: string; description?: string }>) {
  const toolId = data.toolId ?? "unknown.tool";
  const group = toolId.split(".", 1)[0] ?? "tool";

  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        "min-w-[260px] max-w-[360px]",
        "px-4 py-3 font-mono",
        selected ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : ""
      )}
      data-testid="blueprint-flow-node"
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !border-border !bg-background"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-5 truncate">
            {data.label}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] font-mono">
              {group}
            </Badge>
            <span className="text-[11px] text-muted-foreground truncate">
              {toolId}
            </span>
          </div>
        </div>
      </div>

      {data.description ? (
        <div className="mt-2 text-xs text-muted-foreground leading-5 line-clamp-2">
          {data.description}
        </div>
      ) : null}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !border-border !bg-background"
      />
    </div>
  );
}

