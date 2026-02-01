import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { StatusBadge } from "../ui/status-badge";

export default function WorkflowDetailPage() {
    const [, params] = useRoute("/workflows/:id");
    const workflowId = params?.id;

    const { data: workflow, isLoading, error, refetch } = useQuery({
        queryKey: ["workflow", workflowId],
        queryFn: async () => {
            if (!workflowId) return null;
            const res = await fetch(`/api/workflows/${encodeURIComponent(workflowId)}`);
            if (!res.ok) throw new Error("Failed to fetch workflow details");
            return res.json();
        },
        enabled: !!workflowId,
        refetchInterval: 2000,
    });

    if (isLoading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !workflow) {
        return (
            <div className="space-y-4">
                <div className="text-destructive">Error: {error ? error.message : "Not found"}</div>
                <Link href="/workflows">
                    <Button variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Workflows
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/workflows">
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight">Workflow Details</h1>
                </div>
                <Button variant="outline" onClick={() => refetch()}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Execution Info</CardTitle>
                        <CardDescription>Run ID: {workflow.runId}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Type</p>
                                <p className="font-mono">{workflow.type}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Status</p>
                                <StatusBadge status={workflow.status} />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Started</p>
                                <p>{new Date(workflow.startTime).toLocaleString()}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">Closed</p>
                                <p>{workflow.closeTime ? new Date(workflow.closeTime).toLocaleString() : "Running"}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>History</CardTitle>
                        <CardDescription>Event History Length</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold">{workflow.historyLength}</div>
                        <p className="text-sm text-muted-foreground mt-2">
                            Events in history. Full history view coming soon.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
