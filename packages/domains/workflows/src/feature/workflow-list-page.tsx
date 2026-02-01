import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Play } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { StatusBadge } from "../ui/status-badge";
import { WorkflowExecutionDrawer } from "../ui/execution-drawer";

interface Workflow {
    workflowId: string;
    runId: string;
    type: string;
    status: string;
    startTime: string;
    closeTime?: string;
}

export default function WorkflowListPage() {
    const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

    const { data: workflows, isLoading, error } = useQuery<Workflow[]>({
        queryKey: ["workflows"],
        queryFn: async () => {
            const res = await fetch("/api/workflows");
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.details || "Failed to fetch workflows");
            }
            return res.json();
        },
        refetchInterval: 5000,
    });

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-destructive">
                Error loading workflows: {error instanceof Error ? error.message : String(error)}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Workflows</h2>
                <Button>
                    <Play className="mr-2 h-4 w-4" /> Trigger Workflow
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Executions</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Workflow ID</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Started</TableHead>
                                <TableHead>Duration</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {workflows?.map((wf) => (
                                <TableRow
                                    key={wf.runId}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => setSelectedWorkflowId(wf.workflowId)}
                                >
                                    <TableCell className="font-mono text-sm max-w-[200px] truncate font-medium" title={wf.workflowId}>
                                        {wf.workflowId}
                                    </TableCell>
                                    <TableCell>{wf.type}</TableCell>
                                    <TableCell>
                                        <StatusBadge status={wf.status} />
                                    </TableCell>
                                    <TableCell>
                                        {formatDistanceToNow(new Date(wf.startTime), { addSuffix: true })}
                                    </TableCell>
                                    <TableCell>
                                        {wf.closeTime
                                            ? formatDuration(wf.startTime, wf.closeTime)
                                            : "Running..."}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {workflows?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                                        No workflows found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <WorkflowExecutionDrawer
                workflowId={selectedWorkflowId}
                onClose={() => setSelectedWorkflowId(null)}
            />
        </div>
    );
}

function formatDuration(start: string, end: string) {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    if (diff < 1000) return `${diff}ms`;
    return `${(diff / 1000).toFixed(2)}s`;
}
