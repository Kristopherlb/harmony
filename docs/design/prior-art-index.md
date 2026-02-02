# Design: Prior Art Index

> **Status:** Concept / Future Work  
> **Related ADR:** ADR-001 (OSCAL Compass Integration)

## Problem Statement

When implementing a new capability, developers (and agents) need to find similar existing implementations to use as reference. Currently this requires:

1. Manually browsing `packages/capabilities/src/`
2. Reading multiple files to understand patterns
3. Guessing which capabilities are similar

This slows down development and leads to inconsistent implementations.

## Proposed Solution

A searchable index of capability patterns that maps:
- **Pattern type** (CLI wrapper, API connector, transformer, etc.)
- **Input/output characteristics** (file-based, streaming, batch, etc.)
- **External dependencies** (Python, Go, Docker, cloud APIs)
- **Example capabilities** (specific files to reference)

## Index Structure

### JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "pattern": {
        "type": "string",
        "enum": ["CLI_WRAPPER", "API_CONNECTOR", "TRANSFORMER", "REASONER"]
      },
      "subPattern": {
        "type": "string",
        "description": "More specific pattern variant"
      },
      "characteristics": {
        "type": "array",
        "items": { "type": "string" }
      },
      "externalDependency": {
        "type": "object",
        "properties": {
          "type": { "type": "string", "enum": ["python", "go", "rust", "docker", "api"] },
          "tool": { "type": "string" }
        }
      },
      "examples": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "file": { "type": "string" },
            "description": { "type": "string" },
            "notableFeatures": { "type": "array", "items": { "type": "string" } }
          }
        }
      }
    }
  }
}
```

### Example Index

```json
[
  {
    "pattern": "CLI_WRAPPER",
    "subPattern": "python-cli",
    "characteristics": ["containerized", "json-output", "security-scanning"],
    "externalDependency": {
      "type": "python",
      "tool": "checkov"
    },
    "examples": [
      {
        "file": "packages/capabilities/src/security/checkov.capability.ts",
        "description": "IaC security scanning with Checkov",
        "notableFeatures": [
          "Multi-operation support (scan, scan-plan, list-checks)",
          "Bridgecrew API integration",
          "Soft-fail mode for CI"
        ]
      }
    ]
  },
  {
    "pattern": "CLI_WRAPPER",
    "subPattern": "go-cli",
    "characteristics": ["containerized", "json-output", "vulnerability-scanning"],
    "externalDependency": {
      "type": "go",
      "tool": "trivy"
    },
    "examples": [
      {
        "file": "packages/capabilities/src/security/trivy-scanner.capability.ts",
        "description": "Container and filesystem vulnerability scanning",
        "notableFeatures": [
          "Multiple scan targets (image, fs, repo)",
          "Severity filtering",
          "SBOM output support"
        ]
      }
    ]
  },
  {
    "pattern": "CLI_WRAPPER",
    "subPattern": "signing-tool",
    "characteristics": ["containerized", "cryptographic", "artifact-signing"],
    "externalDependency": {
      "type": "go",
      "tool": "cosign"
    },
    "examples": [
      {
        "file": "packages/capabilities/src/security/sigstore.capability.ts",
        "description": "Keyless signing with Sigstore/Cosign",
        "notableFeatures": [
          "Sign and verify operations",
          "Keyless OIDC flow",
          "Rekor transparency log integration"
        ]
      }
    ]
  }
]
```

## Query Interface

### Option A: CLI Tool

```bash
nx prior-art:find --pattern=CLI_WRAPPER --dependency=python

# Output:
Prior Art for CLI_WRAPPER with python dependency:
  - checkov.capability.ts (Checkov IaC scanning)
  - [future: trestle.capability.ts, c2p.capability.ts]
```

### Option B: Agent-Queryable File

Place index at `.cursor/skills/prior-art-index/index.json` so agents can read it directly.

### Option C: Skill with Embedded Index

Embed the index in a SKILL.md with structured markdown tables.

## Maintenance Strategy

### Manual Curation

Developers update the index when adding new capabilities.

**Pros:** Accurate, curated examples  
**Cons:** Can become stale

### Auto-Generation

Script parses capability files and extracts pattern metadata.

```typescript
// scripts/generate-prior-art-index.ts
for (const file of capabilityFiles) {
  const pattern = inferPattern(file);  // Based on imports, factory structure
  const deps = extractDependencies(file);  // Parse container image
  index.push({ pattern, deps, file });
}
```

**Pros:** Always up-to-date  
**Cons:** Inference may be imprecise

### Hybrid

Auto-generate base index, allow manual annotations for notable features.

## Implementation Plan

1. **Manual index** — Start with curated JSON covering existing security capabilities
2. **Skill wrapper** — Create skill that reads and queries the index
3. **Auto-generation script** — Add script to update index from codebase
4. **CI validation** — Fail build if index is stale

## Success Criteria

- [ ] Index covers all existing capability patterns
- [ ] Agents can query "find me a capability like X"
- [ ] Index stays in sync with codebase (manual or automated)
- [ ] New capability implementations reference prior art

## Estimated Effort

- Manual index + skill: 1 day
- Auto-generation script: 2-3 days
- CI integration: 1 day

## References

- [External CLI Wrapper Pattern](file:///Users/kristopherbowles/code/harmony/.cursor/skills/external-cli-wrapper/SKILL.md)
- [Capability Generator Skill](file:///Users/kristopherbowles/code/harmony/.cursor/skills/capability-generator/SKILL.md)
