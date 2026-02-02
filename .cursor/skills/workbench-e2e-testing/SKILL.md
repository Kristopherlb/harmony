---
name: workbench-e2e-testing
description: E2E test patterns for the Workbench chat-canvas hybrid UX using Playwright. Use when adding or maintaining Playwright E2E tests for the Console workbench (Phase 4.1+).
---

# Workbench E2E Testing Skill

Use this skill when writing or running end-to-end tests for the Workbench: chat panel, drafting canvas, template insertion, and chat→canvas sync.

## When to Use

- Adding Playwright E2E tests for the workbench page
- Testing chat→canvas flow (user sends message, draft appears on canvas)
- Testing library→template insertion (browse library, select template, edit, accept)
- Testing iterative refinement (user edits draft via chat 2–3 times)
- Ensuring deterministic scenarios from `product-management/workbench-ux.acceptance.json`

## Instructions

### 1. Playwright Setup

- **Tool:** Use Playwright for browser E2E (recommended for React apps). Add `@playwright/test` as devDependency in the Console app or at workspace root.
- **Config:** Create `playwright.config.ts` (or `.config.js`) at repo root or under `packages/apps/console/`. Set baseURL to the dev server (e.g. `http://localhost:4200`), project(s) for chromium/firefox/webkit, and timeout (e.g. 30s for workbench flows).
- **Dev server:** E2E runs should start the Console dev server (or assume it is already running). Use `webServer: { command: 'pnpm dev:console', url: '...', reuseExistingServer: true }` in Playwright config so tests can attach to a running server when developing.
- **Auth:** If the workbench requires auth, use a test user or mock auth (e.g. bypass or fixture token) so tests are deterministic and not blocked by login UI.

### 2. Selectors for Chat and Canvas

- **Chat panel:** Use a stable data attribute or test id for the chat container, e.g. `[data-testid="workbench-chat-panel"]` or `[data-testid="agent-chat-panel"]`. For the message input, e.g. `[data-testid="workbench-chat-input"]` or `role="textbox"` within the chat panel. Prefer `data-testid` for resilience to copy/layout changes.
- **Canvas:** Use a stable selector for the React Flow canvas, e.g. `[data-testid="drafting-canvas"]` or `.react-flow` (if no test id). For nodes, use `[data-id="<nodeId>"]` (React Flow default) or a custom `data-testid` on node wrappers. For edges, React Flow does not always expose stable data attributes; prefer asserting on node count or node labels.
- **Draft state:** Assert on visible node labels or node count to verify draft content (e.g. “Canvas shows at least 3 nodes” from acceptance scenarios). Avoid relying on internal state unless exposed via test hooks.
- **Recommendation:** Add `data-testid` to key workbench components (chat panel, chat input, canvas, template card, “Use template” button) so E2E selectors remain stable.

### 3. Chat→Canvas Flow Tests

- **Scenario:** User opens workbench, types a message that triggers workflow generation, and the canvas shows the resulting draft.
- **Steps:** Navigate to `/workbench` (or workbench route); wait for chat and canvas to be visible; fill chat input with a prompt (e.g. “Create a workflow with 3 steps: trigger, action, notify”); submit; wait for assistant reply and for canvas to show at least 3 nodes (or a minimum node count). Use `expect(locator).toHaveCount(n)` or `toBeVisible()` with a timeout.
- **Flakiness:** Wait for network idle or for a specific element (e.g. “Accept” button or new node) instead of a fixed delay. Mock or stub the agent response if needed for speed and determinism (e.g. return a fixed BlueprintDraft from the API).

### 4. Library→Template Insertion Tests

- **Scenario:** User browses library, selects a template, edits (optional), and accepts.
- **Steps:** Navigate to workbench or library route; open library (e.g. “Library” link or “Browse templates”); search or filter (e.g. by “incident”); click a template card; click “Use template” or “Preview” then “Use template”; assert canvas shows nodes from the template; optionally edit a node label; accept draft. Assert final node count or labels match expectation.
- **Fixtures:** Use template IDs from `packages/core/src/templates/catalog/` and scenarios from `product-management/workbench-ux.acceptance.json` (e.g. `library-usage-ease`).

### 5. Iterative Refinement (Chat Edits) Tests

- **Scenario:** User iterates on a draft via chat (e.g. “Rename step 2 to X”, “Remove the last step”).
- **Steps:** Start with a draft on canvas (from chat or template); send chat message “Rename the second step to Notify”; wait for canvas update; assert the node label changed. Repeat for remove/reorder/add. Use acceptance scenario `chat-canvas-edit-loop` and `generative-blueprint-revision` as reference.
- **Determinism:** Mock agent responses (EditIntent or full draft) so the test does not depend on LLM non-determinism.

### 6. Deterministic Scenarios and CI

- **Acceptance pack:** Map tests to `product-management/workbench-ux.acceptance.json` scenario IDs. One E2E test per scenario (or one test with multiple `test()` blocks) so regression is tied to acceptance criteria.
- **CI:** Run Playwright E2E in CI only when Console is built and a dev/server is available (or use a static build + mock API). Keep tests short (< 2 min per scenario) where possible; use `test.describe.serial` or tags if some tests are slow.
- **Stability:** Prefer visible assertions (node count, label text) over internal state; avoid flaky timeouts by waiting for specific elements.

### 7. File and Config Locations (Recommendations)

- **Tests:** `packages/apps/console/e2e/workbench-*.spec.ts` (or `*.e2e.ts`) for workbench-specific E2E.
- **Config:** `packages/apps/console/playwright.config.ts` or root `playwright.config.ts` with project for console.
- **Test IDs:** Document required `data-testid` values in this skill or in a short “E2E selectors” doc so front-end and E2E stay in sync.

## Related

- Workbench UX Acceptance Scenario Pack: `product-management/workbench-ux.acceptance.json` – scenario fixtures and UI assertions
- Workbench UX Spec: `product-management/workbench-ux.spec.md` – glossary, approval, build/run modes
- ADR-003 Workbench State Model: `docs/adr/ADR-003-workbench-state-model.md` – single source of truth and reducer
- Workbench UX Implementation Plan – Phase 4.1 (Library E2E), Phase 4.2 (iterative refinement E2E)
