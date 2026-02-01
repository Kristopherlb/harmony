/**
 * packages/apps/console/client/src/pages/workflows.tsx
 * Console UI placeholders for workflow browsing until a dedicated workflows package exists.
 */
import React from "react";
import { Link } from "wouter";

export function WorkflowListPage(): JSX.Element {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Workflows</h1>
        <p className="text-sm text-muted-foreground">
          Workflow browsing UI is not wired up yet. Use the Workbench for provider calls, and Temporal UI for execution
          history.
        </p>
      </div>

      <div className="text-sm">
        <div className="font-medium">Links</div>
        <ul className="list-disc pl-5">
          <li>
            <Link href="/workbench" className="underline">
              Open Workbench
            </Link>
          </li>
          <li>
            <a href="http://localhost:8233" className="underline" target="_blank" rel="noreferrer">
              Open Temporal UI (localhost)
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}

export function WorkflowDetailPage(props: { params: { id: string } }): JSX.Element {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Workflow</h1>
        <p className="text-sm text-muted-foreground">
          Detail view for <code className="font-mono">{props.params.id}</code> is not available yet.
        </p>
      </div>

      <div className="text-sm">
        <Link href="/workflows" className="underline">
          Back to workflows
        </Link>
      </div>
    </div>
  );
}

