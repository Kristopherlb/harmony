/**
 * packages/apps/console/client/src/features/workbench/library/template-detail.tsx
 * Detail/preview panel for a template (full description, steps, Use this template).
 */

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TemplateDraftLike } from "@/features/workbench/template-insertion";

export interface TemplateDetailProps {
  template: TemplateDraftLike | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseTemplate: (template: TemplateDraftLike) => void;
}

export function TemplateDetail({
  template,
  open,
  onOpenChange,
  onUseTemplate,
}: TemplateDetailProps) {
  if (!template) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col w-full sm:max-w-md" data-testid="template-detail">
        <SheetHeader>
          <SheetTitle>{template.name}</SheetTitle>
          <SheetDescription>{template.description}</SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 -mx-6 px-6 mt-4">
          <div className="space-y-4 pb-6">
            <div className="flex flex-wrap gap-1">
              {template.domain ? (
                <Badge variant="secondary">{template.domain}</Badge>
              ) : null}
              {template.subdomain ? (
                <Badge variant="outline">{template.subdomain}</Badge>
              ) : null}
              {(template.tags ?? []).map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">Steps</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                {template.nodes.map((n) => (
                  <li key={n.id}>
                    <span className="font-medium text-foreground">{n.label}</span>
                    {n.description ? ` — ${n.description}` : ""}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </ScrollArea>
        <div className="border-t pt-4 mt-4">
          <Button
            className="w-full"
            onClick={() => {
              onUseTemplate(template);
              onOpenChange(false);
            }}
            data-testid="template-detail-use"
          >
            Use this template
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
