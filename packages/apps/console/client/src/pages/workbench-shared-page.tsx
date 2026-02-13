/**
 * packages/apps/console/client/src/pages/workbench-shared-page.tsx
 * Read-only view for shared Workbench drafts (Phase 4.4.1).
 */
import React, { useMemo } from "react";
import { useLocation } from "wouter";
import { DraftingCanvas } from "@/features/workbench/drafting-canvas";
import { decodeShareDraftPayload } from "@/features/workbench/share-draft";
import { EmptyState } from "@/components/patterns/EmptyState";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Link2Off, GitFork } from "lucide-react";

export default function WorkbenchSharedPage() {
  const [, setLocation] = useLocation();

  const payload = useMemo(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    return params.get("d") ?? "";
  }, []);

  const draft = useMemo(() => decodeShareDraftPayload(payload), [payload]);

  return (
    <div className="h-full overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-2 py-1 border-b shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/workbench")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Workbench
        </Button>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">Shared draft (read-only)</div>
          {draft ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setLocation(`/workbench?d=${encodeURIComponent(payload)}`)}
              data-testid="button-fork-shared-draft"
            >
              <GitFork className="h-3.5 w-3.5 mr-1" />
              Fork
            </Button>
          ) : null}
        </div>
      </div>

      {draft ? (
        <DraftingCanvas draft={draft} readOnly />
      ) : (
        <div className="flex h-full items-center justify-center p-8" data-testid="workbench-shared-empty">
          <EmptyState
            icon={Link2Off}
            title="Invalid or expired share link"
            description="This link doesn’t contain a valid shared workflow draft. Ask the sender to generate a new share link."
            actionLabel="Go to Workbench"
            onAction={() => setLocation("/workbench")}
          />
        </div>
      )}
    </div>
  );
}

