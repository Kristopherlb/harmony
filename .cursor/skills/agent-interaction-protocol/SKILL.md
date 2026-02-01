---
name: agent-interaction-protocol
description: Apply AIP-001 when designing multi-agent systems, task handoffs, or shared state between Builder and Ops agents.
---

# Agent Interaction Protocol (AIP-001)

Use this skill when multiple agents (e.g., Builder Agent, Ops Agent) need to hand off tasks, share context, or handle human intervention through a typed state machine.

## When to Use

- Designing inter-agent communication or handoffs
- Defining shared state schemas for multi-agent graphs
- Implementing HITL (human-in-the-loop) flows across agents
- Ensuring consistent context and artifact passing between agents

## Instructions

1. **Shared state:** All AIP-compliant agents must share a base state schema (e.g., intent, active_task_id, artifacts, status). Use the normative `GoldenPathState` (or equivalent) from the standard.
2. **Handoffs:** Pass full context in state when delegating; do not rely on out-of-band or untyped channels.
3. **Human intervention:** Model HITL as explicit state transitions and interrupts; document when and how to ask for help.

For the full normative standard and shared state schema, see **references/agent-interaction-protocol.mdx**.
