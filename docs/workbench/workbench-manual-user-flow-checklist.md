## Workbench manual user-flow checklist (Given/When/Then)

**Purpose**: A comprehensive set of manual flow statements for Workbench and adjacent Ops flows. Use this to validate UX, readiness, and determinism assumptions by hand.

**How to use**
- Treat each item as a “manual acceptance test”.
- Record: environment, browser, user role, pass/fail, notes, screenshots.
- For “Runtime smoke” items: ensure dependencies (Temporal worker, workbench-server) are running.

**Validation levels**
- **Contract-only**: UI + deterministic fixtures; no external systems required.
- **Runtime smoke**: relies on local runtime surfaces (Temporal, workbench-server).
- **Day-two ops**: observability, alerting, operational readiness checks.

**Auth / identity (dev)**
- Console API dev headers (recommended for deterministic testing):
  - `x-user-id`, `x-username`, `x-user-role` (examples: `dev`, `sre`)
- workbench-server dev auth (for Swagger/GraphiQL launch):
  - set `WORKBENCH_DEV_AUTH=true` on workbench-server
  - send `x-dev-user`, `x-dev-roles` from Console → workbench-server proxy

**Core routes**
- Workbench: `/workbench`
- Library: `/workbench/library`
- Shared read-only: `/workbench/shared?d=...`

---

## Checklist

### Onboarding + Help

- **MF-001 — Onboarding appears for first-time user**
  - **Personas**: End user, Leadership
  - **Validation level**: Contract-only
  - **Given**: Browser localStorage does not include the Workbench onboarding “seen” key
  - **When**: Navigate to `/workbench`
  - **Then**: Onboarding UI opens and explains the chat-canvas hybrid

- **MF-002 — Onboarding does not block normal use**
  - **Personas**: End user
  - **Validation level**: Contract-only
  - **Given**: Onboarding UI is open
  - **When**: Dismiss/finish onboarding
  - **Then**: Workbench remains usable; user can interact with chat and canvas

- **MF-003 — Help sheet opens**
  - **Personas**: End user
  - **Validation level**: Contract-only
  - **Given**: Workbench loaded
  - **When**: Click Help (`data-testid="workbench-help"`)
  - **Then**: Help UI opens with actionable guidance (browse templates, restart onboarding)

- **MF-004 — Restart onboarding via Help**
  - **Personas**: End user, Leadership
  - **Validation level**: Contract-only
  - **Given**: Onboarding previously completed
  - **When**: Open Help and choose “restart onboarding”
  - **Then**: Onboarding UI opens again

---

### Library (templates): browse, search, preview, insert

- **MF-010 — Library page loads**
  - **Personas**: End user, Developer
  - **Validation level**: Contract-only
  - **Given**: Console server is running
  - **When**: Navigate to `/workbench/library`
  - **Then**: Library page renders (`data-testid="library-page"`) and shows a templates grid (or an empty-state)

- **MF-011 — Search filters results**
  - **Personas**: End user, Developer
  - **Validation level**: Contract-only
  - **Given**: Library page shows templates
  - **When**: Type a keyword in search (`data-testid="template-search-input"`)
  - **Then**: Result cards filter to match the term in name/description/tags

- **MF-012 — Domain filter works**
  - **Personas**: End user
  - **Validation level**: Contract-only
  - **Given**: Library page shows at least one domain badge filter
  - **When**: Click a domain filter badge (`data-testid="filter-domain-<domain>"`)
  - **Then**: Only templates in that domain remain

- **MF-013 — Preview a template from the grid**
  - **Personas**: End user
  - **Validation level**: Contract-only
  - **Given**: At least one template card is visible
  - **When**: Click Preview (`data-testid="template-preview"`)
  - **Then**: Detail sheet opens (`data-testid="template-detail"`) showing full description + steps list

- **MF-014 — Use template from the grid**
  - **Personas**: End user
  - **Validation level**: Contract-only
  - **Given**: At least one template card is visible
  - **When**: Click “Use template” (`data-testid="template-use"`)
  - **Then**: App navigates to `/workbench?templateId=...` and loads the draft on the canvas; URL normalizes back to `/workbench`

- **MF-015 — Use template from the detail view**
  - **Personas**: End user
  - **Validation level**: Contract-only
  - **Given**: Template detail sheet is open
  - **When**: Click “Use this template” (`data-testid="template-detail-use"`)
  - **Then**: Workbench loads the draft on the canvas

---

### Workbench empty state + draft creation ingress

- **MF-020 — Empty state appears when there is no draft**
  - **Personas**: End user
  - **Validation level**: Contract-only
  - **Given**: No draft has been created/loaded
  - **When**: Navigate to `/workbench`
  - **Then**: Empty state is visible (`data-testid="workbench-empty-state"`) with a “Browse templates” action

- **MF-021 — Empty state Browse templates navigates to library**
  - **Personas**: End user
  - **Validation level**: Contract-only
  - **Given**: Workbench empty state is visible
  - **When**: Click “Browse templates”
  - **Then**: Navigate to `/workbench/library`

---

### Chat: propose draft, apply/reject proposal, iterate

> Note: For deterministic testing, use fixture mode for `/api/chat` (see `docs/workbench/workbench-user-flows-and-states.md`).

- **MF-030 — Chat can accept a message**
  - **Personas**: End user, Developer
  - **Validation level**: Contract-only
  - **Given**: Workbench is open with chat panel visible
  - **When**: Type a prompt and submit
  - **Then**: A new user message appears in the chat transcript; the system begins generating a response

- **MF-031 — Chat proposes a draft and triggers Apply dialog**
  - **Personas**: End user, Agent, Developer
  - **Validation level**: Contract-only
  - **Given**: A chat prompt that produces a draft (fixture or live)
  - **When**: The assistant completes its response
  - **Then**: An “Apply agent proposal?” dialog opens; the canvas previews the proposed draft

- **MF-032 — Reject proposal restores previous draft**
  - **Personas**: End user
  - **Validation level**: Contract-only
  - **Given**: A proposal is pending (apply dialog open)
  - **When**: Click Reject
  - **Then**: Pending proposal clears; canvas returns to the previous draft (or empty state if none)

- **MF-033 — Apply proposal commits to history**
  - **Personas**: End user, Agent
  - **Validation level**: Contract-only
  - **Given**: A proposal is pending and contains only known tools
  - **When**: Click Apply
  - **Then**: Pending proposal becomes the current draft; undo becomes available

- **MF-034 — Unknown tool types block apply**
  - **Personas**: End user, Agent, Developer
  - **Validation level**: Contract-only
  - **Given**: A proposal includes a node with a type that is not a primitive and not present in the MCP tool catalog
  - **When**: Click Apply
  - **Then**: The proposal is not committed; an error appears indicating unknown tool types

- **MF-035 — Iterative refinement loop (2 rounds)**
  - **Personas**: End user, Agent
  - **Validation level**: Contract-only
  - **Given**: A draft exists on canvas
  - **When**: Send a refinement instruction, apply it, then send a second refinement instruction and apply it
  - **Then**: The draft changes on each iteration and remains in sync with chat

---

### Undo/redo + “no context loss”

- **MF-040 — Undo returns to previous draft snapshot**
  - **Personas**: End user
  - **Validation level**: Contract-only
  - **Given**: Two or more draft states exist in history
  - **When**: Click Undo
  - **Then**: The draft reverts to the prior snapshot; the canvas updates accordingly

- **MF-041 — Redo restores the undone snapshot**
  - **Personas**: End user
  - **Validation level**: Contract-only
  - **Given**: Undo was used at least once and redo is available
  - **When**: Click Redo
  - **Then**: Draft returns to the later snapshot

- **MF-042 — Repeated focus toggles do not lose state**
  - **Personas**: End user, Developer
  - **Validation level**: Contract-only
  - **Given**: A draft exists and chat has at least one message
  - **When**: Toggle focus between chat and canvas repeatedly (and open/close sheets where available)
  - **Then**: Draft and chat history remain unchanged and consistent

---

### Node info sheet: required fields, properties, explain/configure with agent

- **MF-050 — Selecting a node opens the node info sheet**
  - **Personas**: End user
  - **Validation level**: Contract-only
  - **Given**: A draft exists on canvas
  - **When**: Click a node
  - **Then**: Node info sheet opens (`data-testid="workbench-node-info-sheet"`) and displays node label/type

- **MF-051 — Required fields display and missing fields are indicated**
  - **Personas**: End user, Domain expert
  - **Validation level**: Contract-only
  - **Given**: Selected node tool has a schema with required keys
  - **When**: Open “Required” section
  - **Then**: Missing required fields are listed (`data-testid="required-missing"`) and inputs exist per required key

- **MF-052 — Filling required fields clears missing indicators**
  - **Personas**: End user
  - **Validation level**: Contract-only
  - **Given**: Some required fields are missing
  - **When**: Fill inputs (`data-testid="required-input-<key>"`)
  - **Then**: Missing list updates and red border indicators clear

- **MF-053 — Apply properties with invalid JSON shows error**
  - **Personas**: End user, Developer
  - **Validation level**: Contract-only
  - **Given**: Node info sheet open
  - **When**: Enter invalid JSON in `data-testid="properties-json"` and click Apply
  - **Then**: `data-testid="properties-error"` shows an error and the draft does not change

- **MF-054 — Apply properties with valid JSON updates draft**
  - **Personas**: End user, Domain expert
  - **Validation level**: Contract-only
  - **Given**: Node info sheet open
  - **When**: Enter valid JSON and click Apply (`data-testid="button-apply-properties"`)
  - **Then**: The draft updates and remains stable under undo/redo

- **MF-055 — Configure with agent produces a chat request**
  - **Personas**: End user, Agent
  - **Validation level**: Contract-only
  - **Given**: Required fields are missing for a node
  - **When**: Click “Configure with agent” (`data-testid="button-configure-with-agent"`)
  - **Then**: A new chat message is sent (prefilled) that includes node context and missing required fields

- **MF-056 — Explain step produces a chat request**
  - **Personas**: End user, Agent
  - **Validation level**: Contract-only
  - **Given**: Node info sheet open
  - **When**: Click “Explain step” (`data-testid="button-explain-step"`)
  - **Then**: A chat message is sent asking the agent to explain why the step exists

---

### Playground launches (Swagger / GraphiQL)

- **MF-060 — Launch Swagger succeeds when workbench-server is running**
  - **Personas**: Domain expert, Developer
  - **Validation level**: Runtime smoke
  - **Given**: workbench-server is running and dev auth is enabled (`WORKBENCH_DEV_AUTH=true`)
  - **When**: Click “Open Swagger” (`data-testid="button-launch-swagger"`)
  - **Then**: A new tab opens at a launch URL; the session indicates an expiry timestamp

- **MF-061 — Launch GraphiQL succeeds when workbench-server is running**
  - **Personas**: Domain expert, Developer
  - **Validation level**: Runtime smoke
  - **Given**: workbench-server running
  - **When**: Click “Open GraphQL” (`data-testid="button-launch-graphiql"`)
  - **Then**: A new tab opens to GraphiQL

- **MF-062 — Launch shows actionable error when workbench-server is unreachable**
  - **Personas**: Developer, Domain expert
  - **Validation level**: Runtime smoke
  - **Given**: workbench-server is not reachable (wrong URL/port)
  - **When**: Attempt launch
  - **Then**: An error message appears that clearly explains how to start workbench-server or set `WORKBENCH_SERVER_URL`

---

### Execution: run workflow + observe timeline

- **MF-070 — Run dialog opens**
  - **Personas**: End user, Domain expert
  - **Validation level**: Runtime smoke
  - **Given**: Workbench is loaded and MCP tool catalog includes at least one blueprint tool
  - **When**: Click the Run affordance in the canvas toolbar
  - **Then**: “Run workflow (local Temporal)” dialog opens

- **MF-071 — Invalid JSON input blocks run**
  - **Personas**: End user, Developer
  - **Validation level**: Runtime smoke
  - **Given**: Run dialog open
  - **When**: Enter invalid JSON and click Run
  - **Then**: An error appears; no run begins; timeline does not start

- **MF-072 — Run starts and timeline appears**
  - **Personas**: End user, Domain expert, Leadership
  - **Validation level**: Runtime smoke
  - **Given**: Local Temporal + worker are running
  - **When**: Click Run with valid JSON input
  - **Then**: A workflowId is shown; execution timeline (`data-testid="execution-timeline"`) renders and updates status

- **MF-073 — Terminal status is visible**
  - **Personas**: Domain expert
  - **Validation level**: Runtime smoke
  - **Given**: A run was started
  - **When**: Wait until status becomes terminal (COMPLETED/FAILED/CANCELED/TERMINATED)
  - **Then**: Timeline indicates terminal state and stops polling

---

### Restricted tools approval + approval history

- **MF-080 — Restricted tool proposal requires explicit approval**
  - **Personas**: End user, Leadership
  - **Validation level**: Contract-only
  - **Given**: A proposal contains at least one tool with classification `RESTRICTED`
  - **When**: Apply dialog appears
  - **Then**: User must check an “approve restricted tools” box before Apply succeeds

- **MF-081 — Approval history sheet opens**
  - **Personas**: Leadership, End user
  - **Validation level**: Contract-only
  - **Given**: Workbench is open
  - **When**: Click “Approval history” (`data-testid="workbench-approval-history"`)
  - **Then**: Approval history UI opens and shows entries (if any)

- **MF-082 — Approval entry is recorded after approving restricted tools**
  - **Personas**: Leadership
  - **Validation level**: Contract-only
  - **Given**: A restricted proposal was applied with approval
  - **When**: Open approval history
  - **Then**: Entry exists containing approver ID and tool IDs; context includes draftTitle at minimum

---

### Sharing + shared read-only view

- **MF-090 — Share link copies and opens read-only view**
  - **Personas**: End user, Leadership
  - **Validation level**: Contract-only
  - **Given**: A draft exists on the canvas
  - **When**: Click Share
  - **Then**: A share link is copied (or shown); opening it displays a read-only canvas

- **MF-091 — Invalid share payload shows empty state**
  - **Personas**: End user
  - **Validation level**: Contract-only
  - **Given**: Navigate to `/workbench/shared?d=not-a-valid-payload`
  - **When**: Page renders
  - **Then**: Empty state appears (`data-testid="workbench-shared-empty"`)

---

### Tool catalog freshness (refresh vs restart)

- **MF-100 — Tool catalog shows freshness metadata**
  - **Personas**: Developer, Agent
  - **Validation level**: Contract-only
  - **Given**: Console server is running
  - **When**: Call `GET /api/mcp/tools`
  - **Then**: Response includes `manifest.generated_at` and it is parseable as a timestamp

- **MF-101 — Refresh updates tool catalog timestamp**
  - **Personas**: Developer
  - **Validation level**: Contract-only
  - **Given**: Tool catalog has some `generated_at`
  - **When**: Call `POST /api/mcp/tools/refresh` then `GET /api/mcp/tools`
  - **Then**: `generated_at` increases

- **MF-102 — When refresh is insufficient, restart is documented**
  - **Personas**: Developer
  - **Validation level**: Contract-only
  - **Given**: You changed code affecting module loading/exports
  - **When**: Tools appear stale even after refresh
  - **Then**: Restart Console using the canonical command (`pnpm dev:console:restart`)

---

### Day-two ops: telemetry + metrics + dashboard/alert sanity

- **MF-110 — Workbench telemetry endpoint accepts low-cardinality events**
  - **Personas**: Leadership, Domain expert
  - **Validation level**: Day-two ops
  - **Given**: Console server is running
  - **When**: POST a minimal analytics event to `/api/workbench/telemetry` (event/sessionId/timestamp)
  - **Then**: Endpoint returns 204 and does not require chat content

- **MF-111 — Metrics endpoint exposes series after telemetry event**
  - **Personas**: Leadership, Domain expert
  - **Validation level**: Day-two ops
  - **Given**: At least one telemetry event has been recorded
  - **When**: GET `/api/workbench/metrics`
  - **Then**: Response contains Workbench-related metric series and labels for the event name

- **MF-112 — Dashboard sanity (manual)**
  - **Personas**: Leadership, Domain expert
  - **Validation level**: Day-two ops
  - **Given**: Grafana is running and Prometheus scrape is configured
  - **When**: Open the Workbench dashboard
  - **Then**: Panels show recent series; no “No data” due to missing scrape wiring

- **MF-113 — Alert rule sanity (manual)**
  - **Personas**: Domain expert
  - **Validation level**: Day-two ops
  - **Given**: Alerts are deployed
  - **When**: Validate alert rules reference existing series and use appropriate thresholds
  - **Then**: Rules evaluate; no permanent “pending” due to missing metrics

