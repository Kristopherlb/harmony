import React from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { NodeExecutionStatus } from "./live-canvas-state";

export type BlueprintFlowNodeData = {
  label: string;
  toolId?: string;
  description?: string;
  /** Diff status for iterative refinement visualization (Phase 4.2.2) */
  diffStatus?: "added" | "removed" | "changed" | "unchanged";
  /** Background preflight visualization status (Phase 4.1). */
  validationStatus?: "ghost" | "warning";
  /** Live execution status (Phase 4.3.2) */
  executionStatus?: NodeExecutionStatus;
};

export function BlueprintFlowNode({
  data,
  selected,
}: NodeProps<BlueprintFlowNodeData>) {
  const toolId = data.toolId ?? "unknown.tool";
  const group = toolId.split(".", 1)[0] ?? "tool";

  const diffRing =
    data.diffStatus === "added"
      ? "ring-2 ring-green-500 ring-offset-2 ring-offset-background"
      : data.diffStatus === "changed"
        ? "ring-2 ring-amber-500 ring-offset-2 ring-offset-background"
        : selected
          ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
          : "";

  const executionRing =
    data.executionStatus === "running"
      ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-background"
      : data.executionStatus === "completed"
        ? "ring-2 ring-green-500/80 ring-offset-2 ring-offset-background"
        : data.executionStatus === "failed"
          ? "ring-2 ring-destructive/80 ring-offset-2 ring-offset-background"
          : "";

  const validationTone =
    data.validationStatus === "ghost"
      ? "opacity-65 border-dashed"
      : data.validationStatus === "warning"
        ? "border-status-degraded/80"
        : "";

  const ExecutionIcon =
    data.executionStatus === "running"
      ? Loader2
      : data.executionStatus === "completed"
        ? CheckCircle2
        : data.executionStatus === "failed"
          ? XCircle
          : null;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        "min-w-[260px] max-w-[360px]",
        "px-4 py-3 font-mono",
        validationTone,
        diffRing,
        executionRing
      )}
      data-testid="blueprint-flow-node"
      data-execution-status={data.executionStatus ?? "pending"}
      data-validation-status={data.validationStatus ?? "ok"}
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
            {ExecutionIcon ? (
              <span
                className={cn(
                  "ml-1",
                  data.executionStatus === "running" && "text-blue-600",
                  data.executionStatus === "completed" && "text-green-600",
                  data.executionStatus === "failed" && "text-destructive"
                )}
                title={data.executionStatus}
              >
                {data.executionStatus === "running" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ExecutionIcon className="h-3.5 w-3.5" />
                )}
              </span>
            ) : null}
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

