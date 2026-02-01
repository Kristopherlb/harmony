# Phase 6: Day 2 Operations & Lifecycle

## Executive Summary
Phase 6 ensures the platform is sustainable and observable at scale. Day 2 focuses on the ongoing health, cost, and eventual decommissioning of automations. By automating dashboard generation and cost analysis, observability moves from a manual task to a standard platform utility.

## Objectives
- **Zero-Configuration Observability**: Every Blueprint automatically receives a "Golden Signal" dashboard upon certification.
- **Financial Transparency**: Provide real-time and projected Total Cost of Ownership (TCO) for every automation run.
- **Atomic Decommissioning**: Ensure offboarding is as reliable as onboarding via Saga-based compensations for cleanup.

## Functional Requirements
1. **Automated Dashboard Provisioning**
   - Integrate with Grafana API to generate and update dashboards based on OCS/WCS metadata.
   - Organize dashboards by Blueprint namespace using Grafana Folders API.
2. **FinOps Analyzer**
   - Calculate marginal cost per workflow run using the Runtime Tetrad: Temporal Actions, Dagger Compute, LLM Tokens.
   - Surface total TCO in tool surfaces and workflow metadata.
3. **Lifecycle Blueprints**
   - Provide standardized offboarding templates that call WCS SDK compensation capabilities.
4. **SLO Tracking**
   - Monitor `operations.sla` targets defined in Blueprint metadata.

## Engineering Specification
### 1) GOS Dashboard Generation (Observability-as-Code)
**Service Behavior**
- Consumes Blueprint JSON and GOS-001 to produce a Grafana dashboard.
- Maps `golden.*` attributes to PromQL/LogQL queries.

**Panel Configuration**
- **Success Rate**: Completed / (Completed + Failed) per version.
- **Latency**: P99 of workflow execution duration.
- **Dependency Map**: Status of all OCS capabilities referenced by the Blueprint.

**Deployment**
- Provision dashboards with Grafana Folders API.
- Folder key equals Blueprint namespace.

### 2) FinOps Cost Analyzer (TCO Engine)
**Calculation Logic**
- Temporal: `totalActions * $0.00001`.
- Compute (Dagger): `sum(capabilityComputeSeconds * rate)`.
- Intelligence (LLM): `(inputTokens + outputTokens) * modelRate`.
- Total TCO: `Temporal + Compute + Intelligence + API Fees`.

**Outputs**
- Return per-run breakdown + total.
- Enforce non-negative input validation.

### 3) Saga-Based Decommissioning
**Requirements**
- Every provision action must have a deprovision counterpart.
- Offboarding Blueprint iterates through a resource registry and runs compensations.
- Post-cleanup verification ensures no zombie resources remain.

## Execution Plan
1. **Finalize intake artifacts** (URP-001)
   - usecase brief, acceptance tests, capability gaps.
2. **Build the FinOps cost analyzer**
   - Implement calculation engine with TDD.
3. **Design dashboard provisioning service**
   - Map `golden.*` to PromQL/LogQL and encode Grafana API payloads.
4. **Define offboarding blueprint template**
   - Standardize compensation registry and verification hooks.
5. **Wire success metrics**
   - PR automation append Grafana URL; cost accuracy tracking; 100% cleanup verification.

## Success Criteria
- **Metric 1**: Grafana URL appended to PR of every new Blueprint.
- **Metric 2**: Cost estimates within 10% accuracy of actual billing data after 100 runs.
- **Metric 3**: 100% of resources provisioned by a Commander capability are deleted during offboarding.
