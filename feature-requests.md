# Feature Requests

## Proposed Skills
1. **finops-cost-analyzer**
   - **Why**: Standardize TCO calculations across workflows and ensure consistent validation rules for Temporal, Dagger, and LLM cost inputs.
   - **Pattern**: Transformer (pure calculation engine).
   - **Inputs/Outputs**: Runtime tetrad metrics → deterministic cost breakdown + total.

2. **grafana-dashboard-provisioning**
   - **Why**: Normalize Grafana dashboard creation from GOS-001 metadata with consistent foldering and panel templates.
   - **Pattern**: Connector (Grafana API integration).
   - **Inputs/Outputs**: Blueprint metadata + GOS mapping → Grafana folder + dashboard URL.

3. **offboarding-blueprint-template**
   - **Why**: Provide reusable WCS workflow template for Saga-based deprovisioning and verification of resource cleanup.
   - **Pattern**: Commander (workflow-driven remediation).
   - **Inputs/Outputs**: Resource registry snapshot → verified cleanup report.
