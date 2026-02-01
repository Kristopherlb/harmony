---
name: agent-specification-standard
description: Apply ASS-001 when building or reviewing LangGraph agents, reasoners, or MCP-integrated cognitive workflows.
---

# Agent Specification Standard (ASS-001)

Use this skill when implementing or auditing probabilistic "Reasoner" agents that use LangGraph, MCP tools, and checkpointer-based state.

## When to Use

- Designing or implementing LangGraph-based agents
- Integrating agents with MCP (Model Context Protocol) for tool discovery
- Defining agent state schemas, system prompts, or safety guardrails
- Setting up agent observability (OTel, reasoning logs) or HITL interrupts

## Instructions

1. **State & determinism:** Define a strictly typed State Schema (Zod). Use a checkpointer (Postgres or Temporal-backed) for resumable agentic loops. Keep nodes as pure as possible; offload side effects to OCS Capabilities.
2. **Tools:** Do not hardcode API clients. Bind tools via MCP; discover Blueprints and Capabilities from the MCP Registry at runtime.
3. **Safety:** Version system prompts as code; include a "Negative Constraint" block. Define `max_iterations` and `token_limit` per cycle. Trigger HITL interrupts for tools marked RESTRICTED in OCS.
4. **Observability:** Nest LangGraph spans under the parent OTel Trace ID. Capture "thought process" in structured logs and strip from user-facing responses.

For the full normative standard and TypeScript/LangGraph contract, see **references/agent-specification-standard.md**.
