---
name: oscal-compliance
description: OSCAL compliance framework vocabulary, concepts, and Harmony integration patterns for compliance-as-code features.
---

# OSCAL Compliance Framework

Use this skill when working with compliance-as-code features, OSCAL documents, or integrating with OSCAL Compass tools (Trestle, C2P).

## When to Use

- Implementing or extending compliance features in Harmony
- Understanding OSCAL document types and relationships
- Mapping Harmony primitives to OSCAL concepts
- Working with Trestle, C2P, or other OSCAL tools
- Building compliance dashboards or SSP generators
- Adding `CapabilityCompliance` blocks to capabilities

## OSCAL Glossary

| Term | Definition |
|------|------------|
| **Catalog** | A collection of security controls (e.g., NIST 800-53, ISO 27001). The authoritative source of control definitions. |
| **Profile** | A selection and tailoring of controls from one or more catalogs. Defines which controls apply to a specific environment (e.g., FedRAMP Moderate). |
| **Component Definition** | Describes how a component (software, service, policy) implements controls. Maps to Harmony **Capabilities**. |
| **System Security Plan (SSP)** | Documents how a system implements all applicable controls. The primary compliance artifact for auditors. |
| **Assessment Plan** | Defines how to evaluate control implementation. |
| **Assessment Results** | Findings from executing an assessment plan. |
| **Plan of Action & Milestones (POA&M)** | Tracks remediation of control gaps. |

## Harmony-OSCAL Mapping

| Harmony Concept | OSCAL Equivalent | Notes |
|-----------------|------------------|-------|
| Capability | Component Definition | Each capability declares which controls it satisfies via `CapabilityCompliance` |
| Blueprint | System | A blueprint composes capabilities into a deployable system |
| Tenant | Authorization Boundary | Tenant config determines which profile and enforcement level apply |
| Certification | Assessment Results | Aggregated pass/fail results from capability tests |
| Agent Decision Record | Assessment Activity | Captures compliance decisions made during execution |

## Control ID Format

NIST controls follow the pattern: `{FAMILY}-{NUMBER}({ENHANCEMENT})`

Examples:
- `AC-2` — Account Management
- `AC-6(1)` — Least Privilege: Authorize Access to Security Functions
- `AU-3` — Content of Audit Records
- `SC-28(1)` — Protection of Information at Rest: Cryptographic Protection

## CapabilityCompliance Schema

```typescript
interface CapabilityCompliance {
  // Controls this capability helps satisfy
  satisfiesControls: string[];  // e.g., ["AC-2", "AC-6(1)"]
  
  // Controls that MUST be satisfied before this capability can execute
  requiresControls?: string[];  // e.g., ["IA-2"]
  
  // Link to SSP implementation narrative
  implementationRef?: string;
  
  // Evidence artifacts produced
  producesEvidence?: string[];
  
  // Version for staleness detection
  mappingVersion: number;
}
```

## Enforcement Levels

| Level | Behavior |
|-------|----------|
| `ADVISORY` | Log gaps, proceed without interruption |
| `WARNING` | Log gaps, require acknowledgment, then proceed |
| `BLOCKING` | Halt execution, require remediation or approval |

## Related Tools

### Compliance Trestle
Python tool for OSCAL document authoring and transformation.
- Repo: https://github.com/oscal-compass/compliance-trestle
- Use for: SSP generation, catalog import, profile resolution

### Compliance to Policy (C2P)
Maps OSCAL controls to Kubernetes policies (Kyverno, OPA Gatekeeper).
- Repo: https://github.com/oscal-compass/compliance-to-policy
- Use for: Runtime policy enforcement from OSCAL profiles

## Instructions

1. When adding compliance metadata to a capability, use the `CapabilityCompliance` schema in the `security` block.
2. Control IDs should reference the appropriate NIST/OSCAL control family.
3. Increment `mappingVersion` whenever `satisfiesControls` or `requiresControls` changes.
4. For enforcement logic, see ADR-001 in `docs/adr/`.

## References

- [references/oscal-glossary.md](file:///Users/kristopherbowles/code/harmony/.cursor/skills/oscal-compliance/references/oscal-glossary.md) — Extended definitions
- [NIST OSCAL Documentation](https://pages.nist.gov/OSCAL/)
- [ADR-001: OSCAL Compass Integration](file:///Users/kristopherbowles/code/harmony/docs/adr/ADR-001-oscal-compass-integration.md)
