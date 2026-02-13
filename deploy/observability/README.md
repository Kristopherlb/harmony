# Golden Path Observability Assets

Observability infrastructure following GOS-001 (Golden Observability Standard).

## Directory Structure

```
observability/
├── grafana/
│   └── incident-lifecycle-dashboard.json    # Grafana dashboard for incident workflows
│   └── workbench-dashboard.json             # Grafana dashboard for Workbench UX (Phase 4.5)
├── prometheus/
│   └── incident-alerts.yaml                 # Prometheus alerting rules
│   └── workbench-alerts.yaml                # Prometheus alerting rules (Workbench UX)
└── README.md
```

## Prometheus Scrape (Console Workbench UX)

To power the Workbench UX dashboard and SLOs, Prometheus must scrape the Console's Workbench metrics endpoint:

- **Metrics endpoint (Prometheus text format)**: `GET /api/workbench/metrics`
- **Runbook**: `/runbooks/console-metrics-scrape.md`

This repository does **not** ship Prometheus scrape wiring (no `prometheus.yml`, no ServiceMonitor/Helm). Configure scraping in your Prometheus deployment (external infra or managed Prometheus).

Example `scrape_configs` job:

```yaml
scrape_configs:
  - job_name: console-workbench
    metrics_path: /api/workbench/metrics
    scheme: https
    static_configs:
      - targets:
          - console.example.com
```

## Grafana Dashboard

### Incident Lifecycle Workflows

**UID:** `incident-lifecycle-gos001`

Features:
- **Overview Row**: Active incidents, MTTR, error rate, pending approvals
- **Four Golden Signals**: Latency, Error Rate, Traffic, Saturation
- **Workflow Details**: Executions by type, approval wait time
- **Capability Execution**: Execution time and error rate per capability
- **Logs Panel**: Loki integration with trace correlation

### Variables

| Variable | Description |
|----------|-------------|
| `$environment` | Environment filter (production/staging/development) |
| `$app_id` | Workflow filter (incident.initiate, incident.remediate, etc.) |
| `$trace_id` | Trace ID for log correlation |

### Installation

```bash
# Import via Grafana API
curl -X POST \
  -H "Authorization: Bearer $GRAFANA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d @grafana/incident-lifecycle-dashboard.json \
  https://grafana.internal/api/dashboards/db
```

### Workbench UX

**UID:** `workbench-ux-gos001`

Features:
- Workbench session volume and activity (sessions, drafts, templates)
- Client-reported duration histograms (e.g. session duration, time-to-accept)

Installation:

```bash
curl -X POST \
  -H "Authorization: Bearer $GRAFANA_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d @grafana/workbench-dashboard.json \
  https://grafana.internal/api/dashboards/db
```

## Prometheus Alerts

### Alert Groups

| Group | Purpose |
|-------|---------|
| `incident-lifecycle-slos` | SLO breach alerts (P1/P2 response times) |
| `incident-workflow-health` | Workflow error rates, stuck workflows, capacity |
| `incident-approval-health` | Approval queue backlog, wait times |
| `incident-capability-health` | Capability failures and latency |
| `incident-saga-health` | Saga compensations |
| `incident-integration-health` | External API availability |

### Key Alerts

| Alert | Severity | Trigger |
|-------|----------|---------|
| `P1IncidentResponseSLOBreach` | critical | P1 incident > 15 min |
| `P2IncidentResponseSLOBreach` | warning | P2 incident > 1 hour |
| `IncidentWorkflowHighErrorRate` | warning | Error rate > 10% |
| `IncidentWorkflowStuck` | warning | No activity > 30 min |
| `ApprovalQueueBacklog` | warning | > 10 pending approvals |
| `IncidentCapabilityFailures` | warning | Capability error > 20% |
| `StatuspageAPIDown` | critical | Statuspage unreachable |

### Installation

```bash
# Add to Prometheus configuration
# In prometheus.yml, add:
rule_files:
  - /etc/prometheus/rules/incident-alerts.yaml
  - /etc/prometheus/rules/workbench-alerts.yaml

# Copy alert rules
kubectl cp prometheus/incident-alerts.yaml \
  monitoring/prometheus-0:/etc/prometheus/rules/
kubectl cp prometheus/workbench-alerts.yaml \
  monitoring/prometheus-0:/etc/prometheus/rules/

# Reload Prometheus
curl -X POST http://prometheus:9090/-/reload
```

## GOS-001 Compliance

### Required Attributes

All metrics/spans include:

| Attribute | Value |
|-----------|-------|
| `golden.app_id` | Workflow/capability ID |
| `golden.component_type` | ORCHESTRATOR, REASONER, CONTRACT, EXECUTABLE |
| `golden.data_classification` | INTERNAL (incident data) |
| `golden.cost_center` | Team budget code |
| `golden.initiator_id` | User/agent ID |
| `golden.is_compensation` | Boolean for saga rollback |

### Annotations

Dashboard includes overlay annotations for:
- Saga compensations (orange)
- Workflow retries (yellow)

## Related Documentation

- [GOS-001 Standard](/.cursor/skills/golden-observability/SKILL.md)
- [Incident Lifecycle Blueprints](/packages/blueprints/src/workflows/incident/)
- [Runbooks](/runbooks/)
- [Console metrics scrape (Workbench UX)](/runbooks/console-metrics-scrape.md)