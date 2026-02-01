<!-- path: /product-management/standards-and-skills-requirements.md -->

## Purpose

Define the **product requirements** for:

- **New standards** that must be documented (normative) so Harmony artifacts are repeatable.
- **New Cursor Agent SKILLs** that must be created so code generation, execution behavior, and audits are consistent across capabilities, blueprints, and agents.
- **Quality gates** (tests + audits) required for certification.

This document is written to align with the project’s existing standards-as-skills approach (canonical standards under `.cursor/skills/*`).

## Existing knowledge base (must be treated as canonical inputs)

The following are already defined and must be referenced (not reinvented):

- **OCS (Open Capability Standard)**: `.cursor/skills/open-capability-standard/`
- **WCS (Workflow Composition Standard)**: `.cursor/skills/workflow-composition-standard/`
- **TCS (Testing & Certification Standard)**: `.cursor/skills/testing-certification-standard/`
- **GOS (Golden Observability Standard)**: `.cursor/skills/golden-observability/`
- **ISS (Infrastructure Secrets Standard)**: `.cursor/skills/infrastructure-secrets/`
- **UIM (Unified Identity Model)**: `.cursor/skills/unified-identity-model/`
- **AIP (Agent Interaction Protocol)**: `.cursor/skills/agent-interaction-protocol/`
- **ASS (Agent Specification Standard)**: `.cursor/skills/agent-specification-standard/`
- **Generators**:
  - Capability generation: `.cursor/skills/capability-generator/`
  - Blueprint assembly: `.cursor/skills/generate-blueprint-code/`
  - Scaffolding rules: `.cursor/skills/generator-scaffolding-standard/`
- **TDD baseline** (development discipline): `~/.cursor/skills/test-driven-development/`

## Normative standard document template (required)

All new standards defined by this document (NIS/VCS/BDS/AECS/DGS/CAS) MUST follow a single template to avoid drift and bikeshedding.

**Template sections (required)**

- **Metadata**: `ID`, `Version`, `Status`, `Authors`, `Context`
- **Scope**: what the standard applies to and what it explicitly does not apply to
- **Terms**: glossary with canonical names (one term per concept; no aliases like `runAs/initiator`)
- **Normative requirements**: MUST/SHOULD/MAY statements
- **Validation rules**: machine-checkable rules with clear failure conditions
- **Test vectors**: inputs/outputs that audits and contract tests MUST include
- **Examples (non-normative)**: implementation examples that clarify intent but are not binding
- **Changelog**: versioned changes and compatibility notes

## Problem statement

Harmony has strong top-level specs (OCS/WCS/TCS/etc.), but several **repeatable “middle-layer” contracts** are missing or under-specified, causing:

- Drift between **spec → generator → emitted code → runtime behavior → audit signals**.
- Inconsistent naming/versioning and inconsistent artifact metadata, which reduces deterministic discovery and reliable automation.
- Audits that exist in spirit (or in single tests) but lack a complete, standardized “certification surface.”

## Goals

- **Repeatable generation**: given the same structured inputs, generators and agents produce consistent artifacts.
- **Deterministic discovery**: IDs, registries, and manifests are stable and validated.
- **Consistent execution**: security context, classification, retries, observability, and secret handling behave uniformly.
- **Self-auditing**: an automated certification run yields a single PASS/FAIL plus a machine-readable report artifact.
- **Agent decision stability**: agent reasoning uses standardized decision records, typed state, and explicit HITL gates.

## Non-goals

- Defining new product features of any specific integration (e.g., Jira, GitHub) beyond the scaffolding patterns.
- Replacing OCS/WCS/TCS/GOS/ISS/UIM; the intent is to **close gaps** between them and their operationalization.

## Required NEW standards (normative documents to be authored)

Each item below must become a normative standard, placed under `.cursor/skills/<new-skill>/references/` and referenced by a new or updated SKILL.

### 1) Naming & Identity Standard (NIS-001)

Define the single source of truth mapping rules for:

- **Capability generator name** (kebab-case) ↔ **OCS metadata.id** (namespaced, dotted) ↔ **file paths** ↔ **export symbol name** ↔ **registry key** ↔ **MCP tool name**.
- **Blueprint ID** (`metadata.id`) ↔ `blueprintId` ↔ workflowType naming conventions.
- Allowed character sets and separators (e.g., dots, underscores) and when each is permitted.

**Authoritative surfaces (normative)**

- **Canonical identity**: `metadata.id` is authoritative for all artifacts.
- **Derived identities**:
  - **Registry keys MUST equal** `metadata.id`.
  - **MCP tool `name` MUST equal** `metadata.id`.
  - **File paths, export names, and generator “name” are derived** from `metadata.id` via a single deterministic transform defined by NIS-001.

**Registry invariants (normative)**

- No duplicate IDs across **capabilities + blueprints** (global uniqueness).
- Reserved namespaces MUST be defined (e.g., `golden.*`, `workflows.*`, `agents.*`), and generation MUST enforce reservations.
- Support for “experimental/internal” IDs MUST be defined (e.g., suffix/prefix policy) and enforced by audit.

**ID format decision (normative)**

- Underscores are **disallowed** in new IDs.
- Legacy IDs with underscores may exist only under an explicit **legacy allowlist + migration plan**, audited by NIS-001.

**Acceptance criteria**

- A deterministic linter/audit can validate ID ↔ file path ↔ export naming.
- The MCP manifest tool list is stable and sorted by ID; IDs are unique.

### 2) Versioning & Compatibility Standard (VCS-001)

Define SemVer rules for:

- **Schema changes** (input/output/config/secrets) and their version bump requirements.
- **Behavior changes** impacting idempotency/retry/error mapping.
- **Blueprint changes** impacting determinism and in-flight Temporal executions.
- Mapping to Temporal safe rollout requirements (e.g., build-id/worker versioning rules from WCS).

**Deprecation policy (normative)**

- Define how fields/IDs are deprecated (marking mechanism + documentation requirement).
- Define support windows (time-based or release-count-based).
- Define audit treatment: **WARN** during grace period, **FAIL** after end-of-life.

**Acceptance criteria**

- Audit can detect “breaking schema change without major bump.”
- Blueprint versioning policy is compatible with Temporal determinism constraints.

### 3) Blueprint Descriptor Standard (BDS-001)

Current blueprint descriptors are minimal; define a **TypeScript/Node descriptor contract** that is isomorphic (or intentionally subset) of WCS `BaseBlueprint` governance + adds agent-friendly hints.

**Descriptor MUST include**

- `metadata`: `id`, `version`, `name`, `description`, `owner`, `costCenter`, `tags`
- `security`: `requiredRoles`, `classification`, `oscalControlIds?`
- `operations`: `sla`, `alerting?`
- `schemas`: at least `input` and **config**
- `aiHints`: `exampleInput`, `exampleOutput`, `usageNotes?`

**Output schema vs exampleOutput rule (normative)**

Pick one consistent contract to eliminate ambiguity across standards and gates:

- If an artifact is exposed as an **MCP tool**, then `schemas.output` is **MUST** and `aiHints.exampleOutput` is **MUST**.
- If an artifact is **not** exposed as an MCP tool, then `schemas.output` is **MAY** and `aiHints.exampleOutput` is **MAY** (but if either exists, it MUST validate against the other).

**Classification semantics (normative)**

- BDS-001 MUST reference classification semantics from a single shared source (see “Classification semantics standardization” below) and MUST NOT restate the lattice.

**Acceptance criteria**

- Manifest generation for blueprints can include accurate `description`, `classification`, and JSON Schema derived from input schema.
- Blueprint registry and descriptor must be consistent: `blueprintId === metadata.id`.

### 4) Activity Envelope & Execution Contract Standard (AECS-001)

Standardize the activity request/response envelope for “execute capability” and blueprint invocation runners.

**MUST define**

- Required request fields with exact JSON keys and types (no “either/or” fields).
- Standard initiator shape:
  - `initiator`: `{ subjectId: string; roles: string[]; tenantId?: string }`
- Standard trace shape:
  - `trace`: `{ traceId: string }`
- Standard invocation target:
  - capability: `capabilityId: string`
  - blueprint: `blueprintId: string`
- Standard payload:
  - `input: unknown` (validated)
  - `config?: unknown` (validated when required by BDS-001 exposure rules)
- Required context (for observability + policy):
  - `goldenContext: unknown` (typed in implementation; presence required when executing capabilities from workflows)
  - `classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'`
  - `costCenter: string`
- Retry mapping rules: capability retryPolicy → Temporal retry policy.
- How secrets are referenced (keys only) and resolved by the secret broker (ISS-001).
- Error normalization contract and mapping categories (OCS operations.errorMap).

**Threat model hooks (normative)**

- AECS-001 MUST define what is authenticated vs authorized for:
  - initiator identity and roles
  - restricted approvals
  - secret resolution and secret broker access
- AECS-001 MUST define evidence required for certification (CAS-001) that these checks are enforced.

**Acceptance criteria**

- A contract test validates that the worker implementation accepts the envelope and preserves trace + identity.
- Observability attributes (GOS-001) are attached consistently.

### 5) Determinism Guardrails Standard (DGS-001)

WCS mandates determinism; define the enforceable rules and lint surface.

**MUST define**

- Allowed deterministic wrappers (time, uuid, sleep).
- Prohibited APIs in workflow bundles and where exceptions are allowed (e.g., only in base wrappers).
- A lint rule set and test strategy to prevent regressions.

**Enforcement mechanism (normative)**

DGS-001 MUST specify:

- The exact lint layers to use (e.g., ESLint `no-restricted-globals`, `no-restricted-syntax`, and/or `no-restricted-imports`).
- The exact scope: which packages/directories are considered “workflow bundle code” and therefore restricted.
- The allowed exception list (e.g., sanctioned wrappers in `BaseBlueprint` only) and how it is encoded in lint config.
- A regression test strategy (e.g., unit tests that assert lint rules apply to workflow directories, or a fixture-based lint check).

**Acceptance criteria**

- Linting fails if prohibited APIs are used in workflow code outside the sanctioned wrappers.

### 6) Certification & Audit Standard (CAS-001)

TCS defines pipeline stages conceptually; CAS-001 defines the **complete certification surface** and report artifact.

**MUST define**

- Required checks for Capabilities: OCS compliance + contract tests + manifest inclusion.
- Required checks for Blueprints: WCS compliance + descriptor compliance + saga/compensation coverage.
- Required checks for Agents: ASS compliance + AIP compatibility + eval thresholds.
- Required checks for Observability: GOS required `golden.*` attributes.
- Required outputs: `CERTIFICATION.json` (or equivalent) with PASS/FAIL and structured evidence.

**Report schema & deterministic output (normative)**

- The report MUST be versioned and self-describing:
  - `CERTIFICATION.json` MUST include `$schema`, `specVersion`, `generatedAt`, `gitSha`, and `status`.
- The report MUST be written to a deterministic path (for Nx caching), e.g.:
  - `dist/certification/CERTIFICATION.json`
- The report MUST include a stable ordering for collections (sort by `metadata.id`) to avoid nondeterministic diffs.

**Threat model hooks (normative)**

- CAS-001 MUST define certification evidence for authentication/authorization of:
  - initiator identity propagation
  - RESTRICTED approval verification
  - secret resolution policy enforcement
  - network allowlist enforcement (OCS)

**Acceptance criteria**

- A single `nx` target can run all gates and produce the report artifact deterministically.

## Required NEW SKILLs (generation, audit, and stability)

Each skill below must be created under `.cursor/skills/<skill-name>/SKILL.md` with a `references/` normative doc and (where relevant) `scripts/` for runnable audits/codegen.

### 1) `naming-and-identity-standard` (implements NIS-001)

- **Purpose**: Provide deterministic naming rules for all artifact types and how generators derive IDs and symbols.
- **Outputs**: A “mapping table” template that a generator/auditor can validate.
- **Scripts**: Optional: `scripts/audit-naming.ts` (or similar) invoked by Nx.

### 2) `versioning-and-compatibility-standard` (implements VCS-001)

- **Purpose**: Encode SemVer bump rules and Temporal compatibility constraints for workflows.
- **Outputs**: A “change classifier” checklist used by reviewers and audit tooling.

### 3) `blueprint-descriptor-standard` (implements BDS-001)

- **Purpose**: Ensure blueprints are discoverable and auditable in Node-land (manifest generation, MCP listing, docs).
- **Outputs**: Required descriptor fields and examples; minimal descriptor generation template.

### 4) `activity-envelope-standard` (implements AECS-001)

- **Purpose**: Ensure consistent activity invocation semantics (trace, identity, secrets, retries).
- **Outputs**: Canonical request/response envelopes and validation rules.

### 5) `determinism-guardrails` (implements DGS-001)

- **Purpose**: Provide lint rules and enforcement guidance for deterministic Temporal workflow code.
- **Outputs**: Allowed/prohibited API list, exception rules, and audit checklist.

### 6) `certification-and-audit` (implements CAS-001)

- **Purpose**: Define a single certification gate and report artifact.
- **Outputs**: `CERTIFICATION.json` schema + evidence requirements and failure taxonomy.
- **Scripts**: `scripts/certify.ts` that runs all checks and emits report.

### 7) `usecase-refinement-protocol` (new)

- **Purpose**: Standardize working with a user to refine a use case into structured artifacts consumed by architects/generators.
- **MUST produce**:
  - `usecase_brief.json` (goals, constraints, RBAC roles, classification, failure modes, SLA targets)
  - `acceptance_tests.json` (scenario list and expected outcomes aligned with TCS)
  - `capability_gap_analysis.json` (existing vs needed; pattern selection; secrets/config/outbound allowlist)

### 8) `pattern-catalog-capabilities` (new)

- **Purpose**: Enforce repeatable implementation baselines per capability pattern.
- **MUST cover**:
  - CONNECTOR / TRANSFORMER / COMMANDER / (future: GUARDIAN / REASONER)
  - Required schemas, required ops defaults, required security posture, required tests

### 9) `pattern-catalog-blueprints` (new)

- **Purpose**: Provide repeatable blueprint patterns: pipeline, fan-out/fan-in, saga orchestration, signal/waiting, human-approval, batching/APS-aware designs.
- **MUST cover**: how each pattern maps to WCS primitives (execute, saga, memo contexts) and test scaffolds (TCS).

### 10) `agent-decision-records` (new, extends AIP/ASS usage)

- **Purpose**: Make agent decisions stable, reviewable, and auditable.
- **MUST define**:
  - Standard “decision record” object (constraints applied, alternatives considered, risk notes, HITL requirements)
  - Standard state fields to attach decision records (AIP shared state alignment)

## Required automation / quality gates (must be implemented and wired into Nx)

This section defines **requirements** for the future implementation work.

### 1) Contract tests (required by TCS; standardized harness)

- **Capabilities**
  - Validate `aiHints.exampleInput` passes input schema.
  - If the capability is exposed as an **MCP tool**:
    - `schemas.output` is **MUST** and `aiHints.exampleOutput` is **MUST**
    - Validate `aiHints.exampleOutput` passes output schema.
  - If the capability is **not** exposed as an MCP tool:
    - `schemas.output` is **MAY** and `aiHints.exampleOutput` is **MAY**
    - If either exists, validate mutual consistency (exampleOutput validates when output schema exists).
  - Validate required OCS fields are present.
  - Validate `metadata.id` uniqueness across registry.
- **Blueprints**
  - Validate descriptor compliance with BDS-001.
  - Validate `blueprintId === metadata.id`.
  - Validate saga behavior using a failure-matrix test harness (induce failure per step and assert compensations).

**Global uniqueness gate (normative)**

- Contract tests MUST validate global uniqueness across both registries:
  - `capability.metadata.id` and `blueprint.metadata.id` share the same namespace and MUST not collide.

### 2) Manifest integrity & MCP surface checks

- Generated tool manifest MUST:
  - Use JSON Schema 2020-12 compatible `$schema` field.
  - Provide deterministic ordering (sort by ID).
  - Contain correct `description` and `data_classification` derived from descriptors/capabilities.
- Tool surface MUST:
  - Validate inputs against schema.
  - Enforce RESTRICTED preflight requiring explicit approval (ASS/HITL).
  - Always return `trace_id` in structured content for correlation (AIP intent).

### 3) Observability compliance

- For every executable category, ensure required `golden.*` attributes are present (GOS-001).
- Ensure logs follow structured JSON format and redaction rules (ISS-001 alignment).

### 4) Certification report output

- One command produces:
  - PASS/FAIL summary
  - Evidence: list of artifacts checked and their versions/ids
  - Violations: typed list with codes (e.g., `OCS_MISSING_FIELD`, `WCS_NONDETERMINISTIC_API`, `ID_NOT_UNIQUE`)
  - Machine-readable schema for the report

## Definition of Done (for “standards + skills” delivery)

- New standards are written as normative docs under `.cursor/skills/<skill>/references/`.
- Each new standard has a corresponding SKILL under `.cursor/skills/<skill>/SKILL.md` with:
  - When to Use
  - Inputs/Outputs
  - Step-by-step deterministic instructions
  - Links to existing canonical standards (OCS/WCS/TCS/GOS/etc.)
- A “certify” gate is specified (CAS-001) with a report schema and required checks list.
- All naming/versioning/descriptor/activity envelope/determinism rules are explicitly stated and lintable/testable.

## Classification semantics standardization (required)

To prevent semantic drift, classification semantics MUST be defined exactly once, in a single canonical reference (preferably adjacent to ISS/GOS/UIM references), and all other standards MUST reference it.

This canonical reference MUST define:

- The classification lattice and ordering (e.g., PUBLIC < INTERNAL < CONFIDENTIAL < RESTRICTED).
- Defaulting rules and escalation rules.
- Audit semantics (fail vs warn) and required justifications.

## Resolutions (decisions to prevent implementation stalls)

These decisions are binding inputs to the new standards unless superseded by an explicit later revision.

- **ID format (underscores?)**: Disallow underscores in new IDs; allow legacy via an explicit allowlist + migration plan audited by NIS-001.
- **Blueprint tool schema exposure**:
  - Always expose `schemas.input` for MCP tools.
  - Expose `schemas.config` when the tool is installable/runnable by others (policy defined by BDS-001).
  - Expose `schemas.output` only when it is stable and required for UX/agent use; if exposed, it is validated and `aiHints.exampleOutput` is required.
- **RESTRICTED approval token**:
  - Require a signed approval token bound to `{ toolId, initiator.subjectId, trace.traceId, issuedAt, expiresAt, scope }`.
  - AECS-001 MUST define where it travels in the envelope and how it is verified.
  - CAS-001 MUST define what evidence is emitted to prove verification occurred (without leaking secret material).
- **Classification derivation**:
  - Blueprint descriptors MUST explicitly declare classification.
  - Audit MUST enforce: `blueprint.classification >= max(capability.classification)` (FAIL if lower; WARN if higher unless justified).

## Follow-on enforcement roadmap (deferred)

This section ties each new standard to the concrete repo surfaces that must be updated when moving from “docs-only” to “enforced.”

### 1) BDS-001 (Blueprint descriptors) → repo enforcement surfaces

- **Descriptor type**: `packages/blueprints/src/descriptors/types.ts`
- **Blueprint generator output**: `tools/path/src/generators/blueprint/generator.ts` (descriptor generation block)
- **Registry sync**: `tools/path/src/generators/sync/generator.ts` (descriptor discovery extracts `blueprintId`/`workflowType`; will need to extract additional required fields or validate presence)
- **Manifest generation**: `packages/tools/mcp-server/src/manifest/capabilities.ts` (blueprint inclusion path)

**Enforcement steps**

- Upgrade descriptor type to include required governance/security/operations/schemas/aiHints fields.
- Update manifest generator to use descriptor schemas consistently (input/config/output per exposure rules).
- Add/extend tests: blueprint ID consistency + example schema validation.

### 2) NIS-001 (Naming/ID surfaces) → repo enforcement surfaces

- **Capability generator ID transform**: `tools/path/src/generators/capability/generator.ts`
- **Blueprint fileBase transform**: `tools/path/src/generators/blueprint/generator.ts` (slugify policy)
- **Sync generator registry invariants**: `tools/path/src/generators/sync/generator.ts`
- **Tool manifest ordering**: `packages/tools/mcp-server/src/manifest/capabilities.ts`

**Enforcement steps**

- Make canonical ID rules explicit in generators (no underscores for new, allowlist for legacy).
- Add an audit to validate derived surfaces (file paths/export names) reconcile to `metadata.id`.
- Add a global uniqueness check across capability + blueprint registries.

### 3) AECS-001 (Execution envelopes) → repo enforcement surfaces

- **Blueprint capability execution**: `packages/core/src/wcs/base-blueprint.ts` (payload to ExecuteCapability activity)
- **MCP tool surface**: `packages/tools/mcp-server/src/mcp/tool-surface.ts`
- **Call envelope signing/verification**: `packages/tools/mcp-server/src/mcp/call-envelope.ts` (and related tests)

**Enforcement steps**

- Pin one canonical JSON shape for initiator/trace/approval token across MCP and workflow execution.
- Add contract tests that validate envelope schemas and RESTRICTED gating behavior.
- Ensure evidence hooks for CAS-001 are emitted (without leaking secrets).

### 4) DGS-001 (Determinism guardrails) → repo enforcement surfaces

- **Lint configuration**: `eslint.config.mjs`
- **Workflow bundle directories**: `packages/blueprints/src/workflows/**` (and other Temporal-bundled code)

**Enforcement steps**

- Scope determinism lint rules to workflow bundle code (not all `packages/blueprints/**/*.ts` if that creates false positives).
- Add explicit exception sites (BaseBlueprint wrapper implementation) and regression fixtures.

### 5) CAS-001 (Certification report) → repo enforcement surfaces

- **Nx targets**: `nx.json` cacheable operations already include `audit`; add `certify` target in an appropriate project (`project.json` or `tools/path`).
- **Report output path**: `dist/certification/CERTIFICATION.json`

**Enforcement steps**

- Implement `nx audit` / `nx certify` target that runs contract tests + audits and emits deterministic report JSON.
- Add a report schema (`$schema`) and stable ordering rules.
- (Deferred) Add signing after MVP, per ISS-001.

### 6) CSS-001 (Classification semantics) → repo enforcement surfaces

- **Capability classification**: `packages/core/src/ocs/capability.ts` usage sites and capability implementations
- **Blueprint descriptor classification**: `packages/blueprints/src/descriptors/*`
- **Manifest/tool gating**: `packages/tools/mcp-server/src/manifest/capabilities.ts` and `packages/tools/mcp-server/src/mcp/tool-surface.ts`

**Enforcement steps**

- Enforce `blueprint.classification >= max(invoked capability classifications)` and gate RESTRICTED execution.

## Notes (non-normative)

- The intent of this doc is to specify standards and skills that are **lintable/testable** to eliminate ambiguity and reduce drift.
- Editorial: prefer “TypeScript/Node descriptor contract” over colloquial phrasing.

## Remaining open questions (must be resolved by the standards)

- **Reserved namespaces**: enumerate the full reserved list and what’s allowed (including third-party vendor namespaces).
- **MCP exposure policy**: define the precise rule for “installable/runnable by others” (org boundary? tenant boundary? environment boundary?).
- **Certification signing**: decide whether `CERTIFICATION.json` is additionally signed (and if so, key management location and rotation policy per ISS-001).

