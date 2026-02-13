# SPEC: Agent Interaction Golden Path

Status: Approved  
Scope: End-user operating model for working with the agent from idea to execution and observability

Skills used:

- `.cursor/skills/workbench-prompt-patterns/SKILL.md`
- `.cursor/skills/strategic-planning-protocol/SKILL.md`
- `.cursor/skills/feature-golden-path/SKILL.md`

---

## 1. Objective

Provide a clear, repeatable path for users to collaborate with the agent to solve automation problems with:

- easy startup
- iterative refinement
- safe execution
- observable outcomes

---

## 2. Golden Path Stages

### Stage A: Startup (Fast Path)

- User starts from one command path to run Console and required local services.
- User receives a short "first prompt set" to begin discovery or generation.

### Stage B: Discovery and Scoping

- User asks discovery questions to map available capabilities.
- Agent answers with tools/constraints, not fake workflows.

### Stage C: Generate and Refine

- User requests initial workflow draft.
- Agent proposes draft, user accepts/rejects, then iterates with refinement prompts.

### Stage D: Preflight and Execute

- Agent/user trigger run-current-draft.
- Preflight findings are resolved before run.
- Restricted actions require explicit approval context.

### Stage E: Observe and Learn

- User validates run status, terminal results, and key metrics.
- Agent uses local outcomes to improve next recommendations.

---

## 3. Prompt Patterns (Normative Guidance)

### 3.1 Discovery Prompts

- "What can you do for incident response?"
- "Which tools can verify rollout health?"

Expected behavior:

- agent gives capability-centric guidance
- no forced draft generation

### 3.2 Generation Prompts

- "Create a workflow to detect failed canary and rollback."
- "Add approval before production traffic shift."

Expected behavior:

- draft produced/refined against available tool catalog constraints

---

## 4. Execution Safety Requirements

- Runs MUST pass preflight before execution.
- Restricted tool usage MUST include approval context that is reviewable.
- Telemetry MUST capture run start/completion parity for draft and blueprint paths.

---

## 5. Observability Checklist

- Validate telemetry ingestion on key actions.
- Validate metric counters/histograms align with observed user flow.
- Validate unknown-tool/hallucination rate and preflight error trends.

---

## 6. Dogfooding Loop

1. Use the agent to generate/iterate a workflow.
2. Run locally with preflight and approvals.
3. Observe run and metrics outcomes.
4. Update recipe/constraints/specs based on failures and friction.

---

## 7. Validation

Contract checks:

- intent routing, approval context, and catalog metadata tests pass.

Local smoke checks:

- end-user completes full A->E path with one successful and one failure-recovery cycle.

---

## 8. Operator Playbook Mapping

This spec defines normative behavior. The practical execution guide is:

- `docs/workbench/workbench-agent-golden-path.md`

