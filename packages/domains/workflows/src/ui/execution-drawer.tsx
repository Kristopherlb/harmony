import { useQuery } from "@tanstack/react-query";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "./sheet";
import { Separator } from "./separator";
import { StatusBadge } from "./status-badge";
import { Loader2, Calendar, Clock, Activity, FileJson } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface WorkflowExecutionDrawerProps {
    workflowId: string | null;
    onClose: () => void;
}

export function WorkflowExecutionDrawer({ workflowId, onClose }: WorkflowExecutionDrawerProps) {
    const { data: workflow, isLoading, error } = useQuery({
        queryKey: ["workflow", workflowId],
        queryFn: async () => {
            if (!workflowId) return null;
            const res = await fetch(`/api/workflows/${encodeURIComponent(workflowId)}`);
            if (!res.ok) throw new Error("Failed to fetch workflow details");
            return res.json();
        },
        enabled: !!workflowId,
    });

    return (
        <Sheet open={!!workflowId} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-[400px] sm:w-[540px] flex flex-col" side="right">
                {!workflowId ? (
                    <div className="flex h-full items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : isLoading ? (
                    <div className="flex h-full items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <div className="p-6 text-destructive">Failed to load workflow details</div>
                ) : (
                    <>
                        <SheetHeader className="pb-4 border-b">
                            <div className="flex items-center justify-between">
                                <SheetTitle className="font-mono text-base truncate pr-8" title={workflow.workflowId}>
                                    {workflow.workflowId}
                                </SheetTitle>
                                <StatusBadge status={workflow.status} />
                            </div>
                            <SheetDescription className="font-mono text-xs">
                                Run: {workflow.runId}
                            </SheetDescription>
                        </SheetHeader>

                        <div className="flex-1 overflow-y-auto py-6 space-y-8">
                            {/* Quick Stats Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                        <Activity className="h-3 w-3" /> Type
                                    </p>
                                    <p className="text-sm font-semibold">{workflow.type}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                        <Calendar className="h-3 w-3" /> Started
                                    </p>
                                    <p className="text-sm">{new Date(workflow.startTime).toLocaleString()}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> Duration
                                    </p>
                                    <p className="text-sm">
                                        {workflow.closeTime
                                            ? formatDuration(workflow.startTime, workflow.closeTime)
                                            : "Running..."}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground">History Events</p>
                                    <p className="text-sm font-mono">{workflow.historyLength}</p>
                                </div>
                            </div>

                            <Separator />

                            {/* Timeline Placeholder */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Execution Timeline</h3>
                                <div className="border border-dashed border-border rounded-md p-6 text-center text-sm text-muted-foreground bg-muted/20">
                                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    Timeline Visualization Coming Soon
                                </div>
                            </div>

                            <Separator />

                            {/* JSON Data */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Input / Results</h3>
                                    <Button variant="ghost" size="sm" className="h-6 text-xs">
                                        <FileJson className="h-3 w-3 mr-1" /> View Raw
                                    </Button>
                                </div>
                                <div className="border rounded-md bg-muted/50 p-3 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                                    {/* Mock Data for now */}
                                    {`{
  "workflowId": "${workflow.workflowId}",
  "runId": "${workflow.runId}"
}`}
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t flex justify-end gap-2">
                            <Button variant="outline" onClick={onClose}>Close</Button>
                            {workflow.status === 'Running' && (
                                <Button variant="destructive">Terminate</Button>
                            )}
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}

function formatDuration(start: string, end: string) {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    if (diff < 1000) return `${diff}ms`;
    return `${(diff / 1000).toFixed(2)}s`;
}
