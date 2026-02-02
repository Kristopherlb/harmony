/**
 * packages/apps/console/client/src/features/workbench/library/template-card.tsx
 * Card for a single template in the library (name, description, domain/tags, primary action).
 */

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileStack } from "lucide-react";
import type { TemplateDraftLike } from "@/features/workbench/template-insertion";

export interface TemplateCardProps {
  template: TemplateDraftLike;
  onPreview: (template: TemplateDraftLike) => void;
  onUseTemplate: (template: TemplateDraftLike) => void;
}

export function TemplateCard({ template, onPreview, onUseTemplate }: TemplateCardProps) {
  const description =
    template.description.length > 120
      ? `${template.description.slice(0, 120).trim()}…`
      : template.description;

  return (
    <Card
      className="flex flex-col"
      data-testid="template-card"
      data-template-id={template.id}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2">
          <FileStack className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base truncate">{template.name}</CardTitle>
            <CardDescription className="line-clamp-2 mt-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="mt-auto pt-0 space-y-3">
        <div className="flex flex-wrap gap-1">
          {template.domain ? (
            <Badge variant="secondary" className="text-xs">
              {template.domain}
            </Badge>
          ) : null}
          {(template.tags ?? []).slice(0, 4).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onPreview(template)}
            data-testid="template-preview"
          >
            Preview
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onUseTemplate(template)}
            data-testid="template-use"
          >
            Use template
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
