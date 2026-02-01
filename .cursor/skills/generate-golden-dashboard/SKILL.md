---
name: generate-golden-dashboard
description: Generate observability assets (Grafana JSON, Prometheus alerts, LogQL/CloudWatch queries) for a Blueprint from its metadata and dependencies.
---

# Generate Golden Dashboard (generate_golden_dashboard)

Use this skill when creating dashboards and alerts for a BaseBlueprint so every workflow is observable, SLO-aligned, and debuggable via the Four Golden Signals and dependency health.

## When to Use

- Building Grafana dashboards, Prometheus/AlertManager rules, or log queries for a Blueprint
- Ensuring Latency, Errors, Traffic, Saturation and business metrics are covered
- Correlating logs with OTel trace_id and Blueprint metadata.id
- Tying alerts to Blueprint operations.sla and cost visibility

## Instructions

1. **Analysis:** Read Blueprint metadata (id, version) and operations (SLA). Map each `this.execute()` to a "Dependency Health" panel.
2. **Four Golden Signals:** Implement panels for Latency (P50/P90/P99), Traffic (WORKFLOW_STARTED rate), Errors (WORKFLOW_FAILED vs COMPLETED), Saturation (worker slots, Dagger utilization).
3. **Business value:** Use recordMetric calls to add "Workload Success" panels (e.g., tickets created, bytes processed).
4. **Logs:** Generate LogQL/CloudWatch queries filtered by metadata.id and trace_id; include a "Dead Letter" panel for failed Saga/compensation logs.
5. **Alerting:** Create AlertingRule YAML with burn-rate thresholds aligned to 24h SLA; link to remediation playbooks.
6. **Output:** Provide dashboard.json (Grafana model), alerts.yaml, log_queries.txt. If Blueprint lacks business metrics, ask the user (HITL) for value milestones.

For the full prompt and principles, see **references/generate-golden-dashboard.md**.
