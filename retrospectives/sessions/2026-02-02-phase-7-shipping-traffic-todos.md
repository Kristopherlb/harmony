## Retrospective: Phase 7 Shipping & Traffic — infra manifests + CI triggers + dogfooding validation

**Date:** 2026-02-02  
**Session Duration:** ~60–120 minutes (felt longer due to integration setup + validation loop)  
**Artifacts Produced:**
- K8s + Istio manifests:
  - `deploy/k8s/workers/worker-deployment.yaml`
  - `deploy/k8s/flagd/deployment.yaml`
  - `deploy/k8s/flagd/service.yaml`
  - `deploy/istio/virtual-service.yaml`
  - `deploy/istio/destination-rule.yaml`
- Thin CI triggers:
  - `.github/workflows/deploy.yml`
  - `.gitlab-ci.yml`
  - `.dagger/src/src/index.ts` (Temporal env overrides)
- Validation + docs:
  - `packages/tools/mcp-server/src/manifest/infrastructure-manifests.test.ts`
  - `packages/blueprints/src/e2e/dogfooding.blue-green-deploy.workflow-e2e.test.ts`
  - `runbooks/dogfooding-blue-green-deploy.md`

---

## What Went Well

### 1. TDD created deterministic guardrails for “infra-as-code”
Writing a failing test that asserts the presence and key markers of the required infra files prevented “it exists locally but not in repo” drift and gives us a stable check against accidental deletion or rename.

### 2. “Thin trigger” principle held (CI only starts blueprints)
GitHub/GitLab integration stayed minimal: CI calls Dagger, Dagger calls `runBlueprint`, and the platform executes orchestration via Temporal. This preserves the Phase 7 design principle (“everything is a capability / blueprint”).

### 3. Dagger was made environment-true for CI runners
Updating `runBlueprint()` to accept `TEMPORAL_ADDRESS` / `TEMPORAL_NAMESPACE` via env removed an implicit local-only assumption and reduced hidden coupling for real deployment environments.

---

## What Could Have Been Better

### 1. “Runtime-truth gap” (contract/discovery vs real execution) surfaced late
In the same shape as the Jira note (55–60): we can achieve **discoverability + contract stability** without achieving **runtime usefulness**.

For this work:
- We validated the orchestration and inputs (manifest paths + substitutions) in tests.
- We did not validate a full “real cluster + real kubeconfig + real Temporal + real registry” path in CI.

**Impact:** Delivered strong guarantees for orchestration correctness, but left the “deploy Harmony using Harmony” claim partially unproven in a real environment.

### 2. CI JSON quoting/escaping is a repeatable footgun
Passing JSON through workflow YAML → Dagger CLI args → shell → Node CLI is a high-friction path (spaces, quoting, escaping).

**Impact:** Extra iteration time and cognitive load; harder to make CI triggers “obviously correct.”

### 3. Traffic routing config is only partially grounded in concrete workloads
We added Istio `VirtualService`/`DestinationRule` for `harmony-mcp`, but this session did not add the stable/canary Deployments/Services that would make the routing fully actionable.

**Impact:** Routing config is correct in isolation, but incomplete as an end-to-end deployable unit.

---

## The Golden Path (If It Existed)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Add infra manifests + manifest guardrail test               │
│  Outputs: deploy/k8s/*, deploy/istio/*, infra-manifests.test.ts      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: Add thin CI triggers (file-based input)                     │
│  Outputs: deploy.yml / .gitlab-ci.yml with stable JSON passing        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: Runtime-smoke dogfooding (Kind)                              │
│  Outputs: CI-e2e that actually applies manifests + verifies rollout   │
└─────────────────────────────────────────────────────────────────────┘
```

**Estimated time with golden path:** ~45–75 minutes (vs ~60–120 minutes actual)

---

## Recommendations

### Immediate (This Sprint)

| Action | Effort | Impact |
|--------|--------|--------|
| Add a Kind-backed “runtime dogfooding” smoke test for `blueprints.deploy.blue-green` (apply flagd + sync flags + apply workers) | M | Converts dogfooding from “contract-level” to “runtime-true” |
| Change CI triggers to pass blueprint input via file or base64 (avoid inline JSON quoting) | S | Reduces repeated quoting/escaping churn |

### Near-Term (Next 2 Sprints)

| Action | Effort | Impact |
|--------|--------|--------|
| Add `deploy/k8s/harmony-mcp/` stable/canary manifests so Istio routing is fully grounded | M | Makes traffic-routing actually deployable and testable |
| Pin `flagd` image by digest + add minimal RBAC/SA defaults (ISS-001) | S–M | Improves supply-chain posture and deploy safety |

### Strategic (Roadmap)

| Action | Effort | Impact |
|--------|--------|--------|
| Standardize a “shipping/traffic golden path” generator/workflow (infra + trigger + runtime smoke) | L | Turns repeated integration chores into deterministic scaffolding |

---

## Metrics

| Metric | Value | Target | Notes |
|--------|-------|--------|-------|
| Tool calls | ~25–40 | <30 | File creation + verification + test loops |
| Clarifying questions | 0 | 0 | Plan was explicit enough for this slice |
| Artifacts produced | 10+ | n/a | Manifests + CI files + tests + runbook |
| User round-trips | 1–2 | 0–1 | Mostly execution + verification |
| Time to first green test | ~10–20 min | <10 min | Added infra guardrail test first (RED→GREEN) |

---

## Key Takeaway

> **We repeatedly hit the same pattern: contract/discovery completeness is fast, but without a runtime-smoke harness, “useful” remains unverified.**

---

## Plan Alignment (Mandatory)

- **Plan drift observed:** The plan implies “deploy Harmony using Harmony” (runtime), but the assigned tasks can be completed at a contract/discovery level unless “runtime-smoke” is explicitly required.
- **Plan update(s) to apply next time (copy/paste-ready):**

```md
### Validation Levels (Required)
- Level 1 (Contract): manifests + registry + deterministic tests (no cluster)
- Level 2 (Runtime Smoke): Kind-based apply + verify rollout (required for “dogfooding”)
- Level 3 (Staging): real cluster deploy with real secrets (optional)

### CI Trigger Input Rule
Prefer file/base64 payloads over inline JSON in workflow YAML to avoid quoting failures.
```

- **New preflight steps to add:** “Kind cluster available” check + “kubeconfig secret wiring” check for k8s capabilities.

---

## Improvements / Capabilities That Would Help Next

| Type | Proposal | Effort | Expected Impact |
|------|----------|--------|-----------------|
| Tooling | Kind-backed CI smoke harness for dogfooding deployments | M | Turns orchestration confidence into runtime confidence |
| Tooling | Standard helper to pass `--input` JSON safely (file or base64) | S | Removes YAML/CLI quoting churn |
| Docs | Shipping/traffic runbook that explicitly calls out validation levels | S | Prevents “done but not useful” misunderstandings |

---

## Follow-Up Actions

- [x] Save this retrospective under `/retrospectives/sessions/`
- [ ] Update `/retrospectives/PATTERNS.md` (see pattern proposed in this session)
- [ ] Add recommendations to `/retrospectives/IMPROVEMENTS.md` with IDs

