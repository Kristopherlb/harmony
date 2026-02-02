---
title: "Sample Plan: Incident On-Call Handoff Improvements"
owner: "platform-devex"
domain: "incident-management"
status: "draft"
---

## Intent

Improve on-call handoff quality by standardizing incident context capture, ensuring the NOC header shows current incident state, and providing a short checklist for responders.

## Goals

- Add a durable incident context model that can be referenced across workflows.
- Ensure the console UI can render a consistent “incident banner” header.
- Provide a small set of runbooks that operators can follow during handoff.

## Constraints

- No external secrets or credentials in this plan or fixtures.
- Keep changes deterministic for Temporal workflows (no non-deterministic APIs in workflow bundles).
- Prefer generators/utilities where possible instead of ad-hoc scripts.

## Non-Goals

- Building a full incident management product.
- Adding new integrations beyond what already exists.

## Deliverables

- A capability/skill documenting the incident context and signal/query patterns.
- A minimal UI surface that renders the current incident context.
- Tests for core context parsing and rendering logic.
- A checkpoint-style retrospective entry capturing learnings and friction.

## Phases

### Phase 0: Pre-work

- [ ] Document missing patterns as a skill (reasoner, prompt structure, determinism boundaries)
- [ ] Create minimal fixtures for plan parsing (file/content/intent)
- [ ] Capture a pre-work checkpoint

### Phase 1: Implementation

- [ ] Implement incident context types and serialization rules
- [ ] Add UI banner/header rendering using the context model
- [ ] Add small runbooks for the operator journey

### Phase 2: Verification

- [ ] Unit tests for context model + serialization
- [ ] UI tests for banner rendering
- [ ] Documentation review

## Success metrics

- A new responder can understand incident state in < 60 seconds using the banner + runbooks.
- Tests cover the primary state transitions and rendering scenarios.

