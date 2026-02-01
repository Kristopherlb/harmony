---
name: open-capability-standard
description: Apply OCS when building or reviewing Capabilities (atomic units of logic): schemas, factory pattern, security, and MCP discovery.
---

# Open Capability Standard (OCS)

Use this skill when implementing or auditing "Capabilities"—atomic units (e.g., API calls, ETL steps) that must be strictly typed, secure, and compatible with Dagger/Temporal and MCP.

## When to Use

- Implementing new Connector, Transformer, Commander, or Reasoner capabilities
- Defining Input/Output/Config/Secrets schemas (Zod or JSON Schema)
- Enforcing the Pure Factory pattern (factory returns Dagger Container, no side effects in factory)
- Configuring security (scopes, classification, network allowlists, secret mounting)
- Adding agent hints (description, tags, exampleInput/exampleOutput) for MCP discovery

## Instructions

1. **Schemas:** Define Input, Output, Config, and Secrets with semantic typing and descriptions. Secret schema declares keys only; values come from the secret broker (OpenBao/ESO).
2. **Factory:** Implement a pure function (Input, Config, SecretRefs) → Dagger.Container. No side effects or network in the factory phase.
3. **Security:** Mount secrets via container mounts (e.g., `withMountedSecret`); never pass as plain env vars. Set `networkAccess.allowOutbound` explicitly.
4. **Metadata & AI hints:** Set `metadata.id`, `metadata.description`, `metadata.tags`, and `aiHints` (examples, usageNotes) for MCP and agent discovery.

For the full normative specification, see **references/open-capability-standard.mdx**.
