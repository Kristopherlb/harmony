/**
 * packages/apps/console/client/src/components/workbench-onboarding.tsx
 * First-time onboarding wizard for the Workbench (Phase 4.4.2).
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const WORKBENCH_ONBOARDING_SEEN_KEY = "harmony.workbench.onboarding.v1.seen";

type Step = {
  title: string;
  description: string;
  bullets: string[];
};

const steps: Step[] = [
  {
    title: "Welcome to Workbench",
    description: "Chat + canvas for building and running automations.",
    bullets: [
      "Describe your goal in chat to generate a draft.",
      "Click nodes to configure required fields.",
      "Review proposals before applying changes.",
    ],
  },
  {
    title: "Create workflows faster",
    description: "Start from templates or iterate with the assistant.",
    bullets: [
      "Browse the Library for curated templates.",
      "Save your own templates locally for reuse.",
      "Ask the assistant to refine steps and fill config.",
    ],
  },
  {
    title: "Run and share",
    description: "Execute drafts and share read-only links for review.",
    bullets: [
      "Run the workflow when you’re ready.",
      "Copy a share link for reviewers (read-only).",
      "Download JSON for backups or reviews.",
    ],
  },
];

export function WorkbenchOnboarding(input: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinish: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = useMemo(() => steps[Math.min(stepIndex, steps.length - 1)], [stepIndex]);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  useEffect(() => {
    if (input.open) setStepIndex(0);
  }, [input.open]);

  return (
    <Dialog open={input.open} onOpenChange={input.onOpenChange}>
      <DialogContent className="sm:max-w-[520px]" aria-label="Workbench onboarding">
        <DialogHeader>
          <DialogTitle>{step.title}</DialogTitle>
          <DialogDescription>{step.description}</DialogDescription>
        </DialogHeader>

        <Separator />

        <ul className="space-y-2 text-sm">
          {step.bullets.map((b) => (
            <li key={b} className="flex gap-2">
              <span className="mt-1 inline-block size-2 rounded-full bg-muted-foreground/60" />
              <span className="text-muted-foreground">{b}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-muted-foreground">
            Step {stepIndex + 1} of {steps.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => input.onOpenChange(false)}
            >
              Skip
            </Button>
            <Button
              variant="ghost"
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              disabled={isFirst}
            >
              Back
            </Button>
            {isLast ? (
              <Button
                onClick={() => {
                  input.onFinish();
                  input.onOpenChange(false);
                }}
              >
                Done
              </Button>
            ) : (
              <Button onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}>
                Next
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

