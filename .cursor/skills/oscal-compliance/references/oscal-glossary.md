# OSCAL Glossary — Extended Definitions

This document provides detailed definitions of OSCAL (Open Security Controls Assessment Language) concepts for use in Harmony compliance features.

---

## Document Model Hierarchy

```
                    ┌─────────────┐
                    │   Catalog   │  ← Authoritative control definitions
                    │ (e.g., NIST │     (800+ controls in NIST 800-53)
                    │   800-53)   │
                    └──────┬──────┘
                           │ selects & tailors
                           ▼
                    ┌─────────────┐
                    │   Profile   │  ← Baseline selection
                    │ (e.g.,      │     (120-200 controls for FedRAMP Moderate)
                    │ FedRAMP-M)  │
                    └──────┬──────┘
                           │ applied to
                           ▼
           ┌───────────────┴───────────────┐
           │                               │
    ┌──────▼──────┐                 ┌──────▼──────┐
    │  Component  │                 │    SSP      │
    │ Definition  │                 │  (System    │
    │(Capabilities)│                │  Security   │
    └──────┬──────┘                 │   Plan)     │
           │                        └──────┬──────┘
           │ aggregated into               │
           └───────────────────────────────┘
```

---

## Core Concepts

### Catalog

A **Catalog** is the authoritative source of control definitions. It contains:

- **Control families** (e.g., AC = Access Control, AU = Audit)
- **Individual controls** with IDs, titles, and statements
- **Parameters** that can be tailored (e.g., password length)
- **Control enhancements** (numbered sub-controls)

**Examples:**
- NIST SP 800-53 Rev 5 (873 controls)
- ISO 27001:2022 (93 controls)
- CIS Controls v8 (153 safeguards)

**Harmony Usage:** Catalogs are imported into the compliance domain and cached for reference.

---

### Profile

A **Profile** selects and tailors controls from one or more catalogs to create a specific baseline.

**Contains:**
- **Imports** — Which catalogs to pull from
- **Include/Exclude** — Which controls to apply
- **Modify** — Parameter value assignments and additions

**Examples:**
- FedRAMP Moderate (378 controls from NIST 800-53)
- SOC 2 Type II (derived from TSC criteria)
- HIPAA Security Rule (derived from NIST)

**Harmony Usage:** Tenants select a profile in their `TenantComplianceConfig`. The profile determines which controls are in scope for enforcement.

---

### Component Definition

A **Component Definition** describes how a specific component (software, service, policy, or hardware) implements controls.

**Contains:**
- **Component metadata** (name, type, description)
- **Control implementations** — Which controls this component satisfies
- **Implementation narratives** — How the control is implemented
- **Responsible roles** — Who owns this implementation

**Harmony Mapping:** Each **Capability** maps to a Component Definition. The `CapabilityCompliance.satisfiesControls` field declares which controls the capability addresses.

---

### System Security Plan (SSP)

An **SSP** is the master compliance document for a system. It aggregates all control implementations from components into a unified narrative.

**Contains:**
- **System characteristics** (boundaries, users, data types)
- **Control implementations** — For every in-scope control
- **Inventories** — Components, users, services
- **Authorization boundary** — What's in/out of scope

**Harmony Mapping:** A **Blueprint** deployed for a tenant maps to a System. The SSP is auto-generated from the capabilities in the blueprint, with human overrides tracked separately.

---

### Assessment Plan

An **Assessment Plan** defines how to evaluate control implementations.

**Contains:**
- **Assessment objectives** — What to verify
- **Assessment methods** — Interview, examine, test
- **Tasks and schedule** — When and how

**Harmony Usage:** Not directly modeled, but informs the structure of CERTIFICATION.json and compliance checks.

---

### Assessment Results

**Assessment Results** capture findings from executing an assessment plan.

**Contains:**
- **Finding summaries** (satisfied, other-than-satisfied)
- **Observations** — Evidence collected
- **Risks** — Identified vulnerabilities

**Harmony Mapping:** The output of `nx test` and compliance checks maps to assessment results. The Compliance Dashboard displays this data.

---

### Plan of Action & Milestones (POA&M)

A **POA&M** tracks remediation of control deficiencies.

**Contains:**
- **Findings** — What gaps exist
- **Milestones** — Target dates for remediation
- **Status** — Open, closed, risk-accepted

**Harmony Usage:** Future feature — POA&Ms could be auto-generated from failed compliance checks.

---

## Control Families (NIST 800-53)

| Family | Name | Common Controls |
|--------|------|-----------------|
| AC | Access Control | AC-2 (Account Mgmt), AC-6 (Least Privilege) |
| AT | Awareness & Training | AT-2, AT-3 |
| AU | Audit & Accountability | AU-2 (Events), AU-3 (Content), AU-6 (Review) |
| CA | Assessment & Authorization | CA-2, CA-6 |
| CM | Configuration Management | CM-2 (Baseline), CM-6 (Settings), CM-7 (Least Func) |
| CP | Contingency Planning | CP-2, CP-9 (Backups) |
| IA | Identification & Authentication | IA-2 (Multi-factor), IA-5 (Authenticator Mgmt) |
| IR | Incident Response | IR-4, IR-6 |
| MA | Maintenance | MA-2, MA-4 |
| MP | Media Protection | MP-2, MP-6 |
| PE | Physical Protection | PE-2, PE-3 |
| PL | Planning | PL-2 |
| PM | Program Management | PM-1 through PM-32 |
| PS | Personnel Security | PS-2, PS-3 |
| PT | PII Processing | PT-2, PT-3 |
| RA | Risk Assessment | RA-3, RA-5 (Vuln Scanning) |
| SA | System & Services Acquisition | SA-3, SA-11 |
| SC | System & Comms Protection | SC-7 (Boundary), SC-8 (Transmission), SC-28 (At-Rest) |
| SI | System & Info Integrity | SI-2 (Patching), SI-3 (Malware), SI-4 (Monitoring) |
| SR | Supply Chain | SR-3, SR-5 |

---

## References

- [NIST SP 800-53 Rev 5](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final)
- [OSCAL Complete Reference](https://pages.nist.gov/OSCAL/reference/)
- [FedRAMP OSCAL Resources](https://www.fedramp.gov/oscal/)
