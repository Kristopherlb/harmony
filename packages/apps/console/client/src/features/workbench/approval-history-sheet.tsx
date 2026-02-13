/**
 * packages/apps/console/client/src/features/workbench/approval-history-sheet.tsx
 * Approval audit log UI (Phase 4.1.5).
 */

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import type { WorkbenchApprovalLogEntry, WorkbenchApprovalLogListResponse } from "@shared/schema";

interface ApprovalHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApprovalHistorySheet({ open, onOpenChange }: ApprovalHistorySheetProps) {
  const { data, isLoading } = useQuery<WorkbenchApprovalLogListResponse>({
    queryKey: ["/api/workbench/approvals/log"],
    enabled: open,
  });

  const entries: WorkbenchApprovalLogEntry[] = data?.entries ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md" data-testid="approval-history-sheet">
        <SheetHeader>
          <SheetTitle>Approval history</SheetTitle>
          <SheetDescription>
            RESTRICTED tool approvals in this session. Approver, time, tools, and context.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-12rem)] mt-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No approvals recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="rounded-md border p-3 text-sm space-y-1"
                  data-testid="approval-log-entry"
                >
                  <div className="font-mono text-xs text-muted-foreground">
                    {format(new Date(e.timestamp), "yyyy-MM-dd HH:mm:ss")} · {e.approverId}
                  </div>
                  <div className="font-medium">Tools: {e.approvedToolIds.join(", ")}</div>
                  {(e.context?.draftTitle ?? e.context?.incidentId ?? e.context?.workflowId) ? (
                    <div className="text-muted-foreground space-y-0.5">
                      {e.context.draftTitle ? <div>Draft: {e.context.draftTitle}</div> : null}
                      {e.context.incidentId ? <div>Incident: {e.context.incidentId}</div> : null}
                      {e.context.workflowId ? <div>Workflow: {e.context.workflowId}</div> : null}
                      {e.context.contextType ? <div>Context: {e.context.contextType}</div> : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
