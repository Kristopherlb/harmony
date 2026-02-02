import * as React from "react";
import { Link } from "wouter";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Tags, ExternalLink } from "lucide-react";
import type { WorkflowExecution } from "@shared/schema";

export interface ApprovalCardProps {
  execution: WorkflowExecution;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
}

export function ApprovalCard({ execution, onApprove, onReject, isPending }: ApprovalCardProps) {
  const contextType = execution.context?.contextType;
  const serviceTags = execution.context?.serviceTags ?? [];
  const eventId = execution.context?.eventId;

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
        {contextType || serviceTags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {contextType ? (
              <Badge variant="outline" className="text-[10px] font-mono">
                ctx:{contextType}
              </Badge>
            ) : null}
            {serviceTags.length > 0 ? (
              <div className="flex items-center gap-1">
                <Tags className="h-3 w-3 text-muted-foreground" />
                <div className="flex flex-wrap gap-1">
                  {serviceTags.slice(0, 6).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px] font-mono">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="text-sm">
          <span className="text-muted-foreground">Reasoning: </span>
          {execution.reasoning}
        </div>
        <div className="text-xs text-muted-foreground">
          Parameters: {JSON.stringify(execution.params)}
        </div>
        {eventId ? (
          <div className="pt-1">
            <Link href={`/incidents/${eventId}`}>
              <Button variant="outline" size="sm" className="gap-1.5" data-testid={`button-open-context-${execution.id}`}>
                <ExternalLink className="h-3.5 w-3.5" />
                Open incident
              </Button>
            </Link>
          </div>
        ) : null}
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
