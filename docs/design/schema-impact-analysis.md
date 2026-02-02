# Design: Schema Impact Analysis Tool

> **Status:** Concept / Future Work  
> **Related ADR:** ADR-001 (OSCAL Compass Integration)

## Problem Statement

When proposing schema changes (e.g., adding `CapabilityCompliance` to the OCS), developers need to understand:

1. Which existing capabilities would need migration?
2. Which blueprints/workflows would be affected?
3. What tests would need updates?
4. Are there runtime implications?

Currently, this analysis is done manually by searching the codebase, which is time-consuming and error-prone.

## Proposed Solution

A CLI tool that analyzes proposed schema changes and reports downstream impact:

```bash
nx schema:impact --change="add security.compliance to Capability"

# Output:
Impact Analysis for: add security.compliance to Capability
===========================================================

Affected Files:
  - packages/capabilities/src/**/*.capability.ts (47 files)
    - All need optional `compliance` block (backward compatible)
  
  - packages/schema-registry/src/capability.ts
    - Schema definition needs update
  
  - packages/core/src/types/capability.ts
    - TypeScript interface needs update

Migration Required:
  - 0 files (field is optional)

Breaking Changes:
  - None (additive change)

Test Updates Needed:
  - packages/capabilities/src/**/*.capability.test.ts
    - Add tests for compliance block validation

Related Documentation:
  - docs/adr/ADR-001-oscal-compass-integration.md
  - .cursor/skills/open-capability-standard/references/open-capability-standard.mdx
```

## Technical Approach

### Phase 1: Static Analysis

1. **TypeScript AST parsing** — Parse capability files to extract schema definitions
2. **Zod schema introspection** — Analyze schema shapes
3. **Import graph** — Build dependency graph of schema usage

### Phase 2: Change Simulation

1. **Schema diff** — Compare current vs proposed schema
2. **Compatibility check** — Required vs optional fields
3. **Migration classification** — Breaking, non-breaking, additive

### Phase 3: Impact Report

1. **File enumeration** — List all affected files
2. **Change classification** — Type of change per file
3. **Test requirements** — What tests need updates

## Implementation Options

### Option A: Custom nx Plugin

```typescript
// packages/tools/schema-impact/src/executor.ts
export default async function runExecutor(options: SchemaImpactOptions) {
  const changeSpec = parseChangeSpec(options.change);
  const graph = await buildSchemaGraph();
  const impact = analyzeImpact(graph, changeSpec);
  return formatReport(impact);
}
```

**Pros:** Native nx integration, type-safe  
**Cons:** Significant development effort

### Option B: Script + ts-morph

```typescript
// scripts/schema-impact.ts
import { Project } from 'ts-morph';

const project = new Project();
project.addSourceFilesAtPaths('packages/**/*.ts');
// Analyze usage...
```

**Pros:** Quick to prototype  
**Cons:** Less integrated, manual invocation

### Option C: AI-Assisted Analysis

Have agents use codebase search tools with structured prompts to identify impact.

**Pros:** No code changes needed  
**Cons:** Non-deterministic, may miss edge cases

## Recommended Approach

Start with **Option B** (script + ts-morph) as a prototype, then graduate to **Option A** (nx plugin) if the tool proves valuable.

## Success Criteria

- [ ] Tool identifies all files referencing a changed schema
- [ ] Tool correctly classifies breaking vs non-breaking changes
- [ ] Tool suggests migration strategy for breaking changes
- [ ] Tool runs in < 10 seconds for typical schema changes

## Estimated Effort

- Prototype (Option B): 3-5 days
- Production (Option A): 2 weeks

## References

- [ts-morph documentation](https://ts-morph.com/)
- [nx custom executors](https://nx.dev/extending-nx/recipes/local-executors)
- [Zod schema introspection](https://github.com/colinhacks/zod#extracting-the-inferred-type)
