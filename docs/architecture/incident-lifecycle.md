# Incident Lifecycle Architecture

## Overview

The Incident Lifecycle Blueprint Suite provides end-to-end incident management orchestrated through Temporal workflows. It automates incident initiation, remediation, close-out, and post-mortem generation while maintaining human oversight through HITL approval gates.

```mermaid
flowchart LR
    subgraph Trigger["Trigger Sources"]
        PD[PagerDuty Alert]
        Manual[Manual Trigger]
        Agent[AI Agent]
    end

    subgraph Lifecycle["Incident Lifecycle"]
        Init[Initiate]
        Rem[Remediate]
        Close[Close-Out]
        PM[Post-Mortem]
    end

    subgraph External["External Services"]
        SP[Statuspage]
        Slack[Slack]
        Conf[Confluence]
    end

    PD --> Init
    Manual --> Init
    Agent --> Init

    Init --> Rem
    Rem --> Close
    Close --> PM

    Init --> SP
    Init --> Slack
    Rem --> Slack
    Close --> SP
    Close --> Slack
    PM --> Conf
```

---

## Key Concepts

### Blueprints

Blueprints are Temporal workflows that orchestrate capabilities. Each incident lifecycle phase is a separate blueprint:

| Blueprint | Purpose | HITL Required |
|-----------|---------|---------------|
| `incident.initiate` | Start incident response | Severity-dependent |
| `incident.remediate` | Execute remediation actions | Yes |
| `incident.close-out` | Close incident and communications | Severity-dependent |
| `incident.post-mortem` | Generate post-incident review | Yes |

### Capabilities

Capabilities are OCS-compliant modules that perform specific actions:

| Capability | Type | Purpose |
|------------|------|---------|
| `golden.connectors.statuspage` | Connector | Manage Statuspage incidents |
| `golden.connectors.confluence` | Connector | Create Confluence pages |
| `golden.connectors.pagerduty` | Connector | Interact with PagerDuty |
| `golden.integrations.slack-interactive` | Integration | Slack messaging and approvals |
| `golden.operations.runme-runner` | Commander | Execute runbooks |
| `golden.transformers.incident-timeline` | Transformer | Record/query timeline |

### GoldenContext

Every workflow receives a `GoldenContext` with incident-specific fields:

```typescript
interface GoldenContext {
  trace_id: string;
  initiator_id: string;
  cost_center: string;
  
  // Incident-specific
  incident_id?: string;
  incident_severity?: 'P1' | 'P2' | 'P3' | 'P4';
  incident_title?: string;
  incident_channel?: string;
  pagerduty_incident_id?: string;
  statuspage_incident_id?: string;
  impacted_services?: string[];
}
```

---

## Architecture

### System Context

```mermaid
flowchart TB
    subgraph Users["Users"]
        SRE[SRE / On-Call]
        IC[Incident Commander]
    end

    subgraph Harmony["Harmony Platform"]
        Console[Console UI]
        API[Harmony API]
        Worker[Temporal Worker]
    end

    subgraph Orchestration["Orchestration"]
        Temporal[Temporal Server]
        Dagger[Dagger Engine]
    end

    subgraph Integrations["External Integrations"]
        PD[PagerDuty]
        SP[Statuspage]
        Slack[Slack]
        Conf[Confluence]
        Grafana[Grafana]
    end

    SRE --> Console
    IC --> Console
    Console --> API
    API --> Temporal
    Temporal --> Worker
    Worker --> Dagger

    Dagger --> PD
    Dagger --> SP
    Dagger --> Slack
    Dagger --> Conf
    Dagger --> Grafana
```

### Component Architecture

```mermaid
flowchart TB
    subgraph Console["Console Application"]
        UI[React UI]
        Routes[API Routes]
        WfEngine[Workflow Engine]
    end

    subgraph Core["@golden/core"]
        Context[GoldenContext]
        Signals[Approval Signals]
        Spans[OTel Spans]
    end

    subgraph Blueprints["@golden/blueprints"]
        Base[BaseBlueprint]
        IncInit[incident.initiate]
        IncRem[incident.remediate]
        IncClose[incident.close-out]
        IncPM[incident.post-mortem]
    end

    subgraph Capabilities["@golden/capabilities"]
        Statuspage[Statuspage Connector]
        Confluence[Confluence Connector]
        Runme[Runme Runner]
        Timeline[Incident Timeline]
    end

    UI --> Routes
    Routes --> WfEngine
    WfEngine --> Temporal[Temporal]

    Temporal --> Base
    Base --> IncInit
    Base --> IncRem
    Base --> IncClose
    Base --> IncPM

    IncInit --> Context
    IncInit --> Signals
    IncRem --> Signals
    IncClose --> Signals
    IncPM --> Signals

    IncInit --> Statuspage
    IncInit --> Timeline
    IncRem --> Runme
    IncClose --> Statuspage
    IncPM --> Confluence
    IncPM --> Timeline
```

---

## How It Works

### Incident Initiation Flow

```mermaid
sequenceDiagram
    autonumber
    participant User as SRE
    participant Console
    participant Temporal
    participant Worker
    participant SP as Statuspage
    participant Slack
    participant TL as Timeline

    User->>Console: Report Incident
    Console->>Temporal: Start incident.initiate

    Temporal->>Worker: Execute Workflow
    
    Worker->>SP: Create Incident
    SP-->>Worker: Incident ID

    Worker->>Slack: Create Channel
    Slack-->>Worker: Channel ID

    Worker->>Slack: Post Initial Update
    
    Worker->>TL: Record Event
    TL-->>Worker: Recorded

    Worker-->>Temporal: Complete
    Temporal-->>Console: Workflow Complete
    Console-->>User: Incident INC-2026-0001 Created
```

### Remediation with HITL Approval

```mermaid
sequenceDiagram
    autonumber
    participant IC as Incident Commander
    participant Console
    participant Temporal
    participant Worker
    participant Slack
    participant Runme

    IC->>Console: Request Runbook Execution
    Console->>Temporal: Start incident.remediate

    Temporal->>Worker: Execute Workflow
    
    Worker->>Slack: Post Approval Request
    Note over Slack: Approval buttons:<br/>Approve / Reject

    alt User Approves
        Slack->>Worker: Approval Signal (approved)
        Worker->>Runme: Execute Runbook
        Runme-->>Worker: Execution Output
        Worker->>Slack: Post Success
    else User Rejects
        Slack->>Worker: Approval Signal (rejected)
        Worker->>Slack: Post Rejection Notice
    else Timeout
        Worker->>Slack: Post Timeout Notice
        Note over Worker: Auto-escalate if P1
    end

    Worker-->>Temporal: Complete
    Temporal-->>Console: Result
```

### Close-Out Flow

```mermaid
sequenceDiagram
    autonumber
    participant IC as Incident Commander
    participant Console
    participant Temporal
    participant Worker
    participant SP as Statuspage
    participant Slack
    participant TL as Timeline

    IC->>Console: Close Incident
    Console->>Temporal: Start incident.close-out

    Temporal->>Worker: Execute Workflow
    
    Worker->>SP: Update Status (Resolved)
    SP-->>Worker: Updated

    Worker->>Slack: Post Resolution
    
    Worker->>TL: Record Close Event
    TL-->>Worker: Recorded

    alt Archive Channel Requested
        Worker->>Slack: Request Archive Approval
        Slack->>Worker: Approval Signal
        Worker->>Slack: Archive Channel
    end

    Worker-->>Temporal: Complete
    Temporal-->>Console: Incident Closed
```

### Post-Mortem Generation

```mermaid
sequenceDiagram
    autonumber
    participant IC as Incident Commander
    participant Console
    participant Temporal
    participant Worker
    participant TL as Timeline
    participant Conf as Confluence
    participant Slack

    IC->>Console: Generate Post-Mortem
    Console->>Temporal: Start incident.post-mortem

    Temporal->>Worker: Execute Workflow
    
    Worker->>TL: Query Timeline Events
    TL-->>Worker: Events Array

    Note over Worker: Build post-mortem<br/>from template

    Worker->>Conf: Create Page
    Conf-->>Worker: Page URL

    Worker->>Slack: Post Link
    
    Worker-->>Temporal: Complete
    Temporal-->>Console: Post-Mortem Created
    Console-->>IC: Link to Confluence Page
```

---

## State Machine

### Incident Lifecycle States

```mermaid
stateDiagram-v2
    [*] --> Created: Report Incident

    Created --> Investigating: incident.initiate
    
    state Investigating {
        [*] --> Triaging
        Triaging --> Remediating: Start Remediation
        Remediating --> Verifying: Remediation Complete
        Verifying --> Triaging: Verification Failed
        Verifying --> [*]: Verified
    }

    Investigating --> Resolved: incident.close-out
    
    Resolved --> PostMortem: incident.post-mortem
    PostMortem --> Closed: Review Complete
    
    Closed --> [*]

    Investigating --> Escalated: Escalation
    Escalated --> Investigating: De-escalate
```

### Approval States

```mermaid
stateDiagram-v2
    [*] --> Pending: Request Approval

    Pending --> Approved: User Approves
    Pending --> Rejected: User Rejects
    Pending --> TimedOut: Timeout Reached

    TimedOut --> Escalated: Auto-Escalate (P1/P2)
    TimedOut --> Rejected: No Escalation (P3/P4)

    Approved --> [*]
    Rejected --> [*]
    Escalated --> Pending: New Approvers
```

---

## Data Model

### Incident Context

```mermaid
erDiagram
    INCIDENT ||--o{ TIMELINE_EVENT : has
    INCIDENT ||--o{ APPROVAL : requires
    INCIDENT ||--o| STATUSPAGE_INCIDENT : creates
    INCIDENT ||--o| SLACK_CHANNEL : creates
    INCIDENT ||--o| CONFLUENCE_PAGE : generates

    INCIDENT {
        string id PK
        string title
        string severity
        string status
        datetime started_at
        datetime resolved_at
        string[] impacted_services
    }

    TIMELINE_EVENT {
        string id PK
        string incident_id FK
        string event_type
        string actor
        string description
        datetime timestamp
    }

    APPROVAL {
        string id PK
        string incident_id FK
        string workflow_id
        string action
        string status
        string approver_id
        datetime requested_at
        datetime decided_at
    }

    STATUSPAGE_INCIDENT {
        string id PK
        string incident_id FK
        string statuspage_id
        string status
    }

    SLACK_CHANNEL {
        string id PK
        string incident_id FK
        string channel_id
        string channel_name
        boolean archived
    }

    CONFLUENCE_PAGE {
        string id PK
        string incident_id FK
        string page_id
        string page_url
        string space_key
    }
```

---

## RBAC Matrix

```mermaid
flowchart TB
    subgraph Roles["RBAC Roles"]
        Viewer[incident-viewer]
        Responder[incident-responder]
        Manager[incident-manager]
        Approver[incident-approver]
    end

    subgraph Capabilities["Capability Access"]
        SPRead[statuspage:read]
        SPWrite[statuspage:write]
        SlackRead[slack:read]
        SlackWrite[slack:write]
        OpsExec[operations:execute]
        ConfWrite[confluence:write]
        WfApprove[workflow:approve]
    end

    Viewer --> SPRead
    Viewer --> SlackRead

    Responder --> SPRead
    Responder --> SPWrite
    Responder --> SlackRead
    Responder --> SlackWrite
    Responder --> OpsExec

    Manager --> SPRead
    Manager --> SPWrite
    Manager --> SlackRead
    Manager --> SlackWrite
    Manager --> OpsExec
    Manager --> ConfWrite

    Approver --> WfApprove
```

---

## Deployment

### Kubernetes Architecture

```mermaid
flowchart TB
    subgraph Ingress["Ingress Layer"]
        LB[Load Balancer]
        Istio[Istio Gateway]
    end

    subgraph Services["Service Layer"]
        Console[Console Pod]
        MCP[MCP Server Pod]
    end

    subgraph Workers["Worker Layer"]
        W1[Temporal Worker 1]
        W2[Temporal Worker 2]
        W3[Temporal Worker 3]
    end

    subgraph Platform["Platform Services"]
        Temporal[Temporal Server]
        Dagger[Dagger Engine]
        FlagD[FlagD]
    end

    subgraph Observability["Observability"]
        Prometheus[Prometheus]
        Loki[Loki]
        Grafana[Grafana]
    end

    LB --> Istio
    Istio --> Console
    Istio --> MCP

    Console --> Temporal
    MCP --> Temporal

    Temporal --> W1
    Temporal --> W2
    Temporal --> W3

    W1 --> Dagger
    W2 --> Dagger
    W3 --> Dagger

    W1 --> FlagD
    W2 --> FlagD
    W3 --> FlagD

    W1 --> Prometheus
    W2 --> Prometheus
    W3 --> Prometheus

    Console --> Loki
    MCP --> Loki
```

---

## Configuration

### Feature Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `cap-golden.connectors.statuspage-enabled` | true | Enable Statuspage integration |
| `cap-golden.connectors.confluence-enabled` | true | Enable Confluence integration |
| `cap-golden.operations.runme-runner-enabled` | true | Enable runbook execution |
| `incident.auto-escalate-p1` | true | Auto-escalate P1 on timeout |

### Environment Variables

```bash
# External Services
STATUSPAGE_API_KEY=secret
CONFLUENCE_API_TOKEN=secret
PAGERDUTY_API_KEY=secret
SLACK_BOT_TOKEN=secret
SLACK_SIGNING_SECRET=secret

# Temporal
TEMPORAL_ADDRESS=temporal:7233
TEMPORAL_NAMESPACE=harmony

# Feature Flags
FLAGD_HOST=flagd
FLAGD_PORT=8013
```

---

## Troubleshooting

### Common Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| Approval timeout | No approvers available | Check on-call schedule |
| Statuspage update fails | Invalid API key | Rotate STATUSPAGE_API_KEY |
| Slack channel not created | Missing permissions | Verify Slack app scopes |
| Runbook execution hangs | Container timeout | Increase activity timeout |
| Post-mortem empty | No timeline events | Verify Timeline capability |

### Debug Workflow

```bash
# Get workflow history
tctl workflow show -w incident.initiate-INC-2026-0001

# Query workflow state
tctl workflow query -w incident.initiate-INC-2026-0001 -qt approvalState

# Signal approval manually
tctl workflow signal -w incident.initiate-INC-2026-0001 -n approval \
  --input '{"decision":"approved","approverId":"admin"}'
```

---

## Related Documentation

- [Severity Definitions](/docs/incidents/severity-definitions.md)
- [RBAC Model](/docs/security/incident-lifecycle-rbac.md)
- [Threat Model](/docs/security/incident-lifecycle-threat-model.md)
- [ADR-002: Incident Management Architecture](/docs/adr/ADR-002-incident-management.md)
- [Runbooks](/runbooks/)
