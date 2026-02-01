---
name: golden-observability
description: Apply GOS-001 for OTel attributes, structured logs, and metrics so the platform is observable and compliant with the Golden Observability Standard.
---

# Golden Observability Standard (GOS-001)

Use this skill when implementing or reviewing telemetry: spans, logs, and metrics that must follow the semantic attribute dictionary and enable Ops Agent root-cause analysis and cost allocation.

## When to Use

- Adding or validating OTel attributes (golden.* namespace)
- Defining structured log format (timestamp, level, message, trace_id, span_id, golden.app_id)
- Implementing or reviewing Prometheus metrics (naming convention, Golden Signals)
- Ensuring redaction of secret fields and correlation with Temporal/Dagger execution IDs

## Instructions

1. **Attributes:** All spans/logs/metrics must include the mandatory golden.* attributes where applicable: golden.app_id, golden.component_type (ORCHESTRATOR, REASONER, CONTRACT, EXECUTABLE), golden.data_classification, golden.cost_center, golden.initiator_id, golden.is_compensation; optional golden.business_value.
2. **Logs:** Emit structured JSON with required fields; redact OCS SecretSchema keys automatically; correlate via trace_id to Temporal RunID or Dagger ExecutionID.
3. **Metrics:** Use naming convention golden_{component}_{metric_name}; expose via Prometheus and align with the four Golden Signals where applicable.

For the full normative standard, see **references/golden-observability.mdx**.
