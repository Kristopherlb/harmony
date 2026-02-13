# Workbench Agent Golden Path (Operator Playbook)

Purpose: provide a practical, repeatable way to collaborate with the Workbench agent from idea to observable execution, including the dogfooding loop for continuous improvement.

Skills used:

- `.cursor/skills/workbench-prompt-patterns/SKILL.md`
- `.cursor/skills/feature-golden-path/SKILL.md`
- `.cursor/skills/strategic-planning-protocol/SKILL.md`
- `.cursor/skills/usecase-refinement-protocol/SKILL.md`

Validation level target:

- `contract` for prompt and interaction consistency
- `local_smoke` for startup -> generate -> run -> observe

---

## 1) Quick Start (5-minute path)

From repo root:

```bash
pnpm install
pnpm nx serve console
```

Optional runtime path (recommended for run monitoring):

```bash
pnpm nx run harmony:dev-up
pnpm nx run harmony:dev-worker
```

Open:

- `http://localhost:5000/workbench`

If tools appear stale after capability/catalog work:

```bash
pnpm tools:regen-sync
pnpm dev:console:restart
```

MCP hard gate before blueprint generation tests:

```bash
pnpm --dir packages/apps/console exec vitest run server/blueprint-first-api-smoke.test.ts
pnpm -w vitest run packages/tools/mcp-server/src/demo/stdio-jsonrpc-client.test.ts
```

---

## 2) Curated Skill Set for Agent Collaboration

Use this sequence during real work (or while coaching users):

1. `usecase-refinement-protocol`: shape ambiguous requests into a concrete goal and acceptance checks.
2. `workbench-prompt-patterns`: choose prompt style (discovery, generation, refinement, clarification).
3. `feature-golden-path`: validate telemetry and run-path behavior with local checks.
4. `strategic-planning-protocol`: capture gaps, risks, and follow-up improvements after each loop.

---

## 3) Interaction Model (Golden Loop)

### Stage A: Discover and Scope

Ask discovery-first prompts to prevent premature draft generation.

Examples:

- `What tools are available for incident triage and rollback verification?`
- `What constraints or approvals apply to production-impacting actions?`
- `Which tool chain is best for rollout health checks?`

Expected result:

- capability-centric response
- catalog-grounded capability IDs (from `/api/mcp/tools`)
- no forced draft for pure discovery intent

Discovery fidelity check (required before generation):

1. Ask: `What security tools do we have available?`
2. Verify response includes concrete capability IDs from catalog (example: `golden.security.*`).
3. If response is generic or non-catalog, refresh MCP tools and rerun discovery before generation.

### Stage B: Plan-First Checkpoint (Steerage)

Before large generation asks, request a short strategic plan:

- `Before drafting, propose a 5-bullet plan with assumptions, risks, and approval points.`
- `Wait for my confirmation before generating the workflow graph.`

Expected result:

- short checklist with explicit approval and preflight notes
- user confirmation before graph generation

### Stage C: Generate

Create first draft only after scope is aligned:

- `Create a workflow that triages an incident, notifies Slack, opens a Jira issue, and verifies rollout health.`

Expected result:

- draft proposal on canvas
- user applies or rejects proposal intentionally

### Stage D: Partial Refinement (Targeted Edits)

Prefer small, explicit updates over full replacement.

Examples:

- `Add an approval step before production traffic shift.`
- `Rename step "Create Jira Issue" to "Create Incident Jira Ticket".`
- `Only modify the notification branch; keep all other nodes unchanged.`

Expected result:

- node/property-focused updates
- visible change clarity on the latest turn

### Stage E: Preflight and Run

Use a run gate checklist before execution:

1. No blocking preflight findings.
2. Required node fields are set.
3. Restricted tool approvals are explicit.
4. Approval context is actionable (`workflowId` or `incidentId` or `draftTitle`).

Then run current draft and monitor terminal status.

### Stage F: Observe Outcomes

Validate user actions against observability surfaces:

- run status progression in Workbench timeline
- approval history entries are present and reviewable
- telemetry/metrics endpoints move with user actions:
  - `POST /api/workbench/telemetry`
  - `GET /api/workbench/metrics`

---

## 4) Prompt Starter Pack (Copy/Paste)

### Discovery

- `What can you do for incident response with the currently available tools?`
- `List rollout verification options and when each is preferred.`

### Plan-first steerage

- `Propose a concise execution plan first: steps, risks, and approvals. Do not generate the graph yet.`

### Generation

- `Generate a workflow for canary verification with rollback on failed health checks.`

### Refinement

- `Insert an approval gate before the rollback decision.`
- `Change only the rollback criteria threshold and keep all node IDs stable.`

### Troubleshooting

- `The run failed in preflight. Explain exactly which fields are missing and the minimal fix.`

---

## 5) Safe Execution Checklist

- Validate draft shape before run (required fields and schemas).
- Resolve unknown-tool or unsupported-step findings before execution.
- Confirm restricted tool approvals and review context payload.
- Prefer local smoke first for new patterns before broader environments.

---

## 6) Observability Checklist

For each run session:

1. Capture one success path and one failure/recovery path.
2. Verify both are reflected in timeline and metrics.
3. Confirm duration/terminal status are observable for completed runs.
4. Record notable friction (missing context, confusing prompts, stale tools).

Recommended smoke command:

```bash
pnpm telemetry:smoke:workbench -- --base-url http://localhost:3000
```

---

## 7) Dogfooding Workflow Generation Loop

Use the platform to improve the platform:

1. Generate and refine a workflow with the agent.
2. Execute locally with preflight + approvals.
3. Observe telemetry, status, and operator friction.
4. Feed improvements back into:
   - prompt patterns
   - recipe/spec docs
   - validation matrix and QA scripts

Definition of done for each loop:

- one successful run and one failure-recovery cycle validated
- at least one concrete improvement captured and linked to a doc/spec/test update

---

## 8) Troubleshooting (High Signal)

- `Workbench loads but tools are missing`: run `pnpm tools:regen-sync`, restart console, and refresh tools.
- `Run stays stuck`: verify Temporal and worker are running (`harmony:dev-up`, `harmony:dev-worker`).
- `Approval log not actionable`: include at least one of `workflowId`, `incidentId`, or `draftTitle`.
- `Discovery asks generate drafts`: use explicit discovery prompt wording and confirm intent routing behavior with QA flow A.

---

## 9) Related References

- `docs/workbench/SPEC-Agent-Interaction-Golden-Path.md`
- `docs/workbench/workbench-operator-command-cheatsheet.md`
- `docs/workbench/workbench-golden-path-manual-qa.md`
- `docs/workbench/VALIDATION-MATRIX.md`
- `docs/workbench/workbench-manual-user-flow-checklist.md`
