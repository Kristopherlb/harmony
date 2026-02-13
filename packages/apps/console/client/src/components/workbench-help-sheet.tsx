/**
 * packages/apps/console/client/src/components/workbench-help-sheet.tsx
 * Help panel with example prompts and shortcuts for the Workbench (Phase 4.4.2).
 */
import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const examplePrompts = [
  "Create an incident response workflow: Slack alert → Jira ticket → notify on-call.",
  "Add a retry step if the API call fails and log errors with context.",
  "Replace step 2 with a conditional branch based on severity.",
  "Explain why you added the ‘sleep’ step.",
  "Show me which steps will require approval.",
];

export function WorkbenchHelpSheet(input: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBrowseTemplates: () => void;
  onRestartOnboarding: () => void;
}) {
  return (
    <Sheet open={input.open} onOpenChange={input.onOpenChange}>
      <SheetContent className="w-[420px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Workbench help</SheetTitle>
          <SheetDescription>
            Quick ways to get productive without leaving the page.
          </SheetDescription>
        </SheetHeader>

        <div className="pt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={input.onBrowseTemplates}>
              Browse templates
            </Button>
            <Button variant="outline" onClick={input.onRestartOnboarding}>
              Restart tour
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-sm font-medium">Example prompts</div>
            <div className="text-xs text-muted-foreground">
              Paste one into chat and iterate from there.
            </div>
            <ul className="space-y-2">
              {examplePrompts.map((p) => (
                <li key={p} className="rounded-md border bg-background p-3">
                  <div className="text-sm">{p}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

