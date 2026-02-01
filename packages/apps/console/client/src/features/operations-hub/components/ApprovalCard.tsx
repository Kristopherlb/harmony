import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";
import type { WorkflowExecution } from "@shared/schema";

export interface ApprovalCardProps {
  execution: WorkflowExecution;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
}

export function ApprovalCard({ execution, onApprove, onReject, isPending }: ApprovalCardProps) {
  return (
    <Card key={execution.id} className="border-status-degraded/30" data-testid={`card-approval-${execution.id}`}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{execution.actionName}</CardTitle>
          <Badge className="bg-status-degraded/20 text-status-degraded">
            Pending Approval
          </Badge>
        </div>
        <CardDescription>
          Requested by {execution.executedByUsername} at{" "}
          {new Date(execution.startedAt).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-sm">
          <span className="text-muted-foreground">Reasoning: </span>
          {execution.reasoning}
        </div>
        <div className="text-xs text-muted-foreground">
          Parameters: {JSON.stringify(execution.params)}
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          variant="default"
          className="gap-1"
          onClick={onApprove}
          disabled={isPending}
          data-testid={`button-approve-${execution.id}`}
        >
          <CheckCircle className="h-4 w-4" />
          Approve
        </Button>
        <Button
          variant="destructive"
          className="gap-1"
          onClick={onReject}
          disabled={isPending}
          data-testid={`button-reject-${execution.id}`}
        >
          <XCircle className="h-4 w-4" />
          Reject
        </Button>
      </CardFooter>
    </Card>
  );
}
