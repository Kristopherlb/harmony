# Engineering Operations Dashboard

## Overview

The Engineering Operations Dashboard is a NOC-style application designed to unify engineering operations. It aggregates signals from human inputs (Slack) and various machine inputs (Jira, Bitbucket, GitLab, PagerDuty), providing a real-time activity stream, DORA metrics, and Slack command integration. The project aims to offer a comprehensive view of engineering activities and facilitate efficient operations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The project follows a Test-Driven Development (TDD) approach with Zod schemas defining domain entities for TypeScript types and runtime validation.

### Frontend
- **Framework**: React with TypeScript and Vite.
- **Styling**: Tailwind CSS with shadcn/ui.
- **Theme**: Dark-mode NOC aesthetic.
- **State Management**: TanStack React Query.
- **Routing**: Wouter.

### Backend
- **Runtime**: Node.js with Express.
- **Language**: TypeScript with ESM modules.
- **API Design**: RESTful endpoints.
- **Build**: Custom esbuild for server, Vite for client.

### Data Layer
- **ORM**: Drizzle ORM for PostgreSQL.
- **Schema**: Zod schemas (`shared/schema.ts`) for data validation and typing.
- **Repository Pattern**: `IActivityRepository` with a `SeedableMemoryRepository` implementation, designed for easy PostgreSQL integration via dependency injection.

### Integration Patterns
- **Adapter Pattern**: `SourceAdapter` for transforming external webhooks into internal `EventSchema` (implemented for Slack, GitLab, Bitbucket, Jira, PagerDuty).
- **Service Clients**: `ServiceClient` interface for fetching data from external APIs (implemented for Slack, GitLab, Bitbucket, Jira, PagerDuty). Sync endpoints `/api/sync/:source` and `/api/sync/all` are available.
- **Webhook Security**: HMAC-SHA256 verification middleware for webhook endpoints, with graceful degradation if secrets are not configured.

### Key Domain Entities
- **EventSchema**: Core unit capturing id, timestamp, source, type, severity, payload, message, and resolved status.
- **ProjectSchema**: For tracking projects and deriving metrics.
- **Event Sources**: slack, jira, gitlab, bitbucket, pagerduty.
- **Event Types**: log, blocker, decision, release, alert.
- **Severity Levels**: low, medium, high, critical.

### AI Agent Service (Phase 2)
- **Design**: `IAgentService` with Strategy Pattern for report generation (executive, standup, stakeholder).
- **Implementations**: `MockAgentService` and `OpenAIAgentService`.
- **Integration**: Slack command `/ops report [style] [days]` and `POST /api/agent/generate-report` endpoint.

### Security Module (Phase 2)
- **Interface**: `ISecurityAdapter` for security tool integration (Wiz, AwsInspector, ArtifactoryXray).
- **Repository**: `ISecurityRepository` for managing `SecurityFindingSchema`.
- **Endpoints**: `GET /api/security/findings`, `GET /api/security/summary`, `POST /api/webhooks/security/:tool`.

### Service Catalog (EOC Phase)
- **Purpose**: System of record for services with dependency visualization.
- **Data Model**: `ServiceSchema` (name, type, tier, health, team, dependencies) and `TeamSchema`.
- **Visualization**: Tier-based layout, SVG dependency arrows, health indicators, interactive nodes.
- **Detail View**: Service 360 view with golden signals, resource utilization, team info, and external links.
- **API Endpoints**: `GET /api/services`, `GET /api/services/:id`, `GET /api/teams`.
- **UI Routes**: `/services`, `/services/:id`.

### Operations Hub (Phase 3)
- **Functionality**: Self-service and remediation capabilities.
- **Actions**: `IActionRepository` manages actions with categories, risk levels, and dynamic forms.
- **Workflow Engine**: `IWorkflowEngine` for durable execution, supporting approval flows.
- **RBAC Security**: Role-based access (viewer, dev, sre, admin) for action execution and approvals.
- **Safe SQL Runner**: Parameterized queries with templates, input sanitization, and audit logging.
- **API Endpoints**: For actions, approvals, and SQL execution.
- **UI**: Operations Hub page (`/operations`) with tabs for catalog, approvals, executions, SQL runner.

### Context-In Console (Phase 4)
- **Layout**: Three-column desktop layout (Signal Stream, Context Workspace, Action Rail) and temporal mobile layout (Feed → Focus → Fire).
- **Components**: SignalFeed (swipeable), ContextWorkspace (dynamic rendering), ActionPanel, MobileActionDrawer, SlideToConfirm.
- **ActionResolver**: Recommends context-aware actions based on relevance scoring and RBAC filtering.

### AI Intelligence Layer (Phase 5)
- **Interface**: ChatGPT/Gemini-style chat.
- **Components**: `AIChatBar`, suggestion chips, expandable chat panel, tool call visualization.
- **LLM Architecture**: Provider-agnostic `ILLMProvider` interface.
- **Agent Tools**: Registered tools include `get_services_status`, `generate_report`, `create_jira_ticket`, `send_to_notion`, `post_to_slack`.
- **API Endpoints**: `POST /api/agent/chat`, `GET /api/agent/tools`, `GET /api/agent/conversation/:id`.
- **Schema**: `ChatMessageSchema`, `ChatRequestSchema`, `ChatResponseSchema`, `AgentToolSchema`.

## External Dependencies

### Database
- **PostgreSQL**: Primary database.

### Frontend Libraries
- **@tanstack/react-query**: Server state management.
- **shadcn/ui**: UI component library.
- **date-fns**: Date manipulation.
- **react-icons**: Icon library.

### Build Tools
- **Vite**: Frontend bundling.
- **esbuild**: Server bundling.
- **TypeScript**: Language.

### Services and APIs
- **Slack**: For human inputs and bot interactions.
- **GitLab**: For code repository events.
- **Bitbucket**: For code repository events.
- **Jira**: For issue tracking.
- **PagerDuty**: For incident management.
- **OpenAI**: For AI agent report generation (optional).
- **Wiz, AWS Inspector, Artifactory Xray**: For security tool integration.