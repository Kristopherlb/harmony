import React from "react";
import { nanoid } from "nanoid";
import { BookmarkPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BlueprintDraft } from "@/features/workbench/types";
import { saveLocalTemplate } from "@/features/workbench/library/local-templates";
import { toast } from "@/hooks/use-toast";
import { emitWorkbenchEvent, getOrCreateWorkbenchSessionId } from "@/lib/workbench-telemetry";

export interface SaveTemplateDialogProps {
  draft: BlueprintDraft | null;
}

function splitTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 25);
}

export function SaveTemplateDialog({ draft }: SaveTemplateDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [domain, setDomain] = React.useState("");
  const [subdomain, setSubdomain] = React.useState("");
  const [tagsText, setTagsText] = React.useState("");
  const [version, setVersion] = React.useState("0.1.0");
  const [author, setAuthor] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    if (!draft) return;
    setName(draft.title || "Untitled template");
    setDescription(draft.summary || "");
    setDomain("");
    setSubdomain("");
    setTagsText("");
    setVersion("0.1.0");
    setAuthor("");
  }, [open, draft]);

  async function onSave() {
    if (!draft) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ variant: "destructive", title: "Name required", description: "Template name cannot be empty." });
      return;
    }

    setSaving(true);
    try {
      const id = `local-${nanoid(10)}`;
      const tags = splitTags(tagsText);
      saveLocalTemplate({
        id,
        name: trimmedName,
        description: description.trim(),
        ...(domain.trim() ? { domain: domain.trim() } : {}),
        ...(subdomain.trim() ? { subdomain: subdomain.trim() } : {}),
        ...(tags.length ? { tags } : {}),
        ...(author.trim() ? { author: author.trim() } : {}),
        ...(version.trim() ? { version: version.trim() } : {}),
        title: draft.title || "Untitled workflow",
        summary: draft.summary || "",
        nodes: draft.nodes.map((n) => ({
          id: n.id,
          label: n.label,
          type: n.type,
          ...(n.description !== undefined && { description: n.description }),
          ...(n.properties !== undefined && { properties: n.properties }),
        })),
        edges: draft.edges.map((e) => ({
          source: e.source,
          target: e.target,
          ...(e.label !== undefined && { label: e.label }),
        })),
      });

      const sessionId = getOrCreateWorkbenchSessionId();
      emitWorkbenchEvent({
        event: "workbench.template_saved",
        sessionId,
      }).catch(() => {});

      toast({
        title: "Saved to Library",
        description: "Stored locally in this browser. Open the Library to reuse it.",
      });
      setOpen(false);
    } catch {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "Try downloading the draft JSON instead.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        disabled={!draft}
        onClick={() => setOpen(true)}
        title="Save as template"
        aria-label="Save draft as template"
        data-testid="workbench-save-template-open"
      >
        <BookmarkPlus className="w-4 h-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg" data-testid="save-template-dialog">
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>
              Templates appear in the Library and can be reused as starting drafts. (Local-only in this MVP.)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="tpl-name">Name</Label>
              <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tpl-desc">Description</Label>
              <Textarea id="tpl-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="tpl-domain">Domain</Label>
                <Input id="tpl-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="deploy" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tpl-subdomain">Subdomain</Label>
                <Input
                  id="tpl-subdomain"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  placeholder="kubernetes"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tpl-tags">Tags (comma-separated)</Label>
              <Input
                id="tpl-tags"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="rollout, canary, verification"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="tpl-version">Version</Label>
                <Input id="tpl-version" value={version} onChange={(e) => setVersion(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tpl-author">Author</Label>
                <Input id="tpl-author" value={author} onChange={(e) => setAuthor(e.target.value)} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

