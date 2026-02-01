# Golden Path Monorepo

Welcome to the **Self-Assembling Platform**. This repository is a high-fidelity automation ecosystem built on the principles of the **Runtime Tetrad**: Orchestrator, Reasoner, Contract, and Executable.

## Project Architecture

This monorepo is managed by **Nx** and **pnpm**. It is organized into distinct layers to ensure strict separation of concerns and adherence to SOLID principles.

## Docs

- **Architecture & flows**: [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md)

## Quickstart (Persona A: tool caller)

Goal: run a minimal **MCP tool call** end-to-end with `trace_id` correlation.

### Prereqs

- Node.js >= 20
- pnpm >= 8
- Docker (for Temporal via `docker compose`)

### 0) Install

```bash
pnpm install
```

### 1) Fast smoke test (no Docker/Temporal)

Runs the MCP demo in **local fallback** mode (no Temporal runners):

```bash
pnpm nx run harmony:dev-demo-local -- --x 7
```

Expected: JSON lines for `initialize`, `tools/list`, `tools/call`, including `structuredContent.trace_id`.

To pass a different input value, run the demo script directly:

```bash
pnpm nx run mcp-server:build
node packages/tools/mcp-server/dist/src/demo/run-demo.js --local --x 42
```

To print the final `tools/call` structured output as a markdown table:

```bash
pnpm nx run mcp-server:build
node packages/tools/mcp-server/dist/src/demo/run-demo.js --temporal --name golden.math_add --args '{"a":2,"b":3}' --table
```

### 2) Canonical demo (Temporal-primary)

Single-command bootstrap (recommended):

```bash
pnpm nx run harmony:dev-bootstrap
```

This brings up dependencies (Docker) and prints the next two canonical commands (worker + demo).

Terminal 1 (dependencies):

```bash
pnpm nx run harmony:dev-up
```

Terminal 2 (Temporal worker, dev stub activity):

```bash
pnpm nx run harmony:dev-worker
```

Terminal 3 (demo tool call routed through Temporal):

```bash
pnpm nx run harmony:dev-demo -- --x 7
```

Notes:

- `harmony:dev-worker` uses a **deterministic stub** for `executeDaggerCapability` so this demo does **not** require Dagger.
- Temporal UI (dashboard) runs at `http://localhost:8233` (from `temporalio/ui`).

## PR / CI checks

Before opening a PR, run:

```bash
pnpm nx run harmony:audit
```

This runs a determinism gate (`@golden/path:sync --dry-run`) plus affected lint/test. If it fails due to generated drift, run `pnpm nx g @golden/path:sync` and commit the result.

### Troubleshooting (high-signal)

- **Worker fails with `Connection refused`**: Temporal isn’t running; run `harmony:dev-up` first.
- **`INPUT_VALIDATION_FAILED`**: tool arguments didn’t match the manifest JSON Schema.
- **`APPROVAL_REQUIRED`**: tool is `RESTRICTED` and requires explicit approval.
- **`NOT_CONFIGURED`**: MCP server has no runner configured for that tool type (use local demo or configure runners).
- **`DAGGER_E2E_DISABLED`**: you’re using a Dagger-backed worker without `ENABLE_DAGGER_E2E=1` (the Persona A dev worker stub avoids Dagger).
- **`GoldenContext not set in workflow memo` / `SecurityContext not set in workflow memo`**: workflows were started without required memo context.

### Directory Structure

- **packages/core**: The standard library containing base classes and interfaces for OCS, WCS, and ASS.
- **packages/capabilities**: The Bricks. OCS-compliant components (Connectors, Transformers, Commanders).
- **packages/blueprints**: The Blueprints. Deterministic Temporal workflows (WCS).
- **packages/agents**: The Brains. Probabilistic LangGraph reasoners (ASS).
- **packages/schema-registry**: The Contract. Centralized Zod schemas for the entire ecosystem.
- **tools/**: Scaffolding generators and internal CLI tools.

## Conventions (recommended)

### Role-suffix filenames

We use explicit role suffixes so you can understand a file’s responsibility without opening it:

- **Capabilities**: `*.capability.ts` (e.g. `jira-get-issue.capability.ts`)
- **Blueprint workflow class**: `*.workflow.ts` (extends `BaseBlueprint`)
- **Workflow entrypoint**: `*.workflow-run.ts` (exports the Temporal workflow function)
- **Blueprint descriptor**: `*.descriptor.ts` (Node-land metadata + schema for registry/MCP)

### Generators (preferred over hand-editing registries)

- **Generate a capability**:

```bash
pnpm nx g @golden/path:capability --name jira-get-issue --pattern connector --classification INTERNAL
```

- **Generate a blueprint from an architecture plan**:

```bash
pnpm nx g @golden/path:blueprint --plan plans/<plan>.json
```

These generators keep `packages/*/src/registry.ts` and workflow barrel exports deterministic.
