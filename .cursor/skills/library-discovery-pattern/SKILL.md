---
name: library-discovery-pattern
description: Best practices for building searchable asset libraries (workflow templates, steps) with filtering, search, preview, and insertion. Use when implementing the Workbench Library UX (Phase 4.1).
---

# Library Discovery Pattern

Use this skill when designing or implementing the Workbench Library (template gallery): search, filter, preview, and insert workflow templates.

## When to Use

- Implementing the Library page or template gallery UI (Phase 4.1)
- Adding faceted search, tag filters, or keyword search for templates
- Designing card/list views and detail/preview views for library items
- Defining the insertion flow (template → draft → canvas)

## Instructions

### 1. Search and Filter Patterns

- **Faceted search:** Allow filtering by `domain`, `subdomain`, and `tags` (align with CDM-001 and `packages/core/src/templates/template-schema.ts`). Use checkboxes or chips; multiple selections within a facet are OR, across facets are AND.
- **Keyword search:** Full-text or prefix match on template `name`, `description`, and `tags`. Debounce input (e.g. 300ms) and show loading state while fetching.
- **Tag clouds:** Optional; show top N tags with counts; clicking a tag applies it as a filter. Useful for discovery; keep secondary to primary search/filters.
- **Sort:** Support at least “name A–Z” and “recent” (if templates have a version or updated field). Deterministic ordering improves testability.

### 2. Card / List View Patterns

- **Card view:** Each template is a card with: name, short description (truncated), domain/tags (pills), optional icon. Primary action: “Use template” or “Preview.”
- **List view:** Compact row per template (name, description snippet, domain, tags). Same primary actions. Prefer card for fewer items, list for many.
- **Empty state:** When no results match filters/search, show a clear message (“No templates match your filters”) and a control to clear filters.

### 3. Preview / Detail View Patterns

- **Detail view:** On “Preview” or card click, show a side panel or modal with: full name, description, domain, subdomain, tags, author/version if present, and a short representation of the workflow (e.g. list of step labels or a mini diagram). Require explicit “Use this template” to insert.
- **Insert from preview:** “Use this template” loads the template as a pending draft (Propose tier per workbench-ux.spec.md); user can edit before accepting. Do not auto-apply to canvas without confirmation.

### 4. Insertion Flow Patterns

- **Insert = load as draft:** Template → `TemplateDraft` (or `BlueprintDraft` extracted from template) → set as current workbench draft; canvas and chat reflect the new draft. User may then edit and accept.
- **Conflict handling:** If the user already has an unsaved draft, prompt: “Replace current draft?” or “Open in new session?” (product decision). Prefer replace for single-session UX unless we support multiple drafts later.
- **Required config:** If a template documents required integrations (e.g. Slack), show a short checklist or prompt after insert (“Connect Slack to run this template”).

### 5. Example Implementations (Reference)

- **Zapier:** Browse by app/category; search; template cards with name, description, “Use this Zap”; detail view with steps before use.
- **Make (Integromat):** Scenarios by category/tag; search; preview scenario; duplicate to own account then edit.
- **n8n:** Workflow templates by category; search; open template in editor (loads as new workflow); user saves when ready.

For Harmony, align with:

- **Schema:** `packages/core/src/templates/template-schema.ts` (`TemplateDraft`, `TemplateManifest`)
- **Spec:** `product-management/workbench-ux.spec.md` (glossary, approval policy, build mode)
- **Phase 4.1:** Library page at `/workbench/library`, components `TemplateCard`, `TemplateFilters`, `TemplateDetail`, “Use Template” → pending draft → canvas.

## Related

- [Capability Discovery Metadata (CDM-001)](../capability-discovery-metadata/SKILL.md) – domain/subdomain/tags taxonomy
- Workbench UX Spec Pack (`product-management/workbench-ux.spec.md`) – glossary, approval, build/run modes
- Workbench UX Implementation Plan – Phase 4.1 Library UX
