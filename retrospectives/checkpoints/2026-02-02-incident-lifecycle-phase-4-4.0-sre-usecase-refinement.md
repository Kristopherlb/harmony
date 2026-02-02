## Progress
- [x] Todo completed: Phase 4.0 SRE Use Case Refinement (URP-001 artifacts)
- [x] Added `plans/incident-lifecycle/usecase_brief.json`
- [x] Added `plans/incident-lifecycle/acceptance_tests.json`
- [x] Added `plans/incident-lifecycle/capability_gap_analysis.json`

## Learnings
- Stable, deterministic URP artifacts are already a working pattern in `plans/*/` and are easy to extend for incident lifecycle.
- The incident lifecycle suite can be framed as a single use case (`usecase.incident.lifecycle`) with scenario coverage spanning initiate/remediate/close-out/post-mortem.

## Friction
- Capability registry (`packages/capabilities/src/registry.ts`) appears out of sync with available capability implementations (e.g., Confluence/Statuspage/Kubectl/Runme exports exist but registry may omit some), which can impact MCP discoverability.

## Opportunities
- Add a small validation test that checks URP artifacts for required fields and stable ordering rules (VAL-URP-001/010/020).
- Ensure `@golden/path:sync` is run after adding new blueprints so descriptor/registry/manifest hygiene stays deterministic.

## Plan Alignment
- Plan drift: none (artifacts produced as required, in the existing `plans/*/` convention).
- Proposed plan updates:
  - Add an explicit “sync registries” step immediately after Phase 4.2–4.5 blueprint creation to avoid stale capability/blueprint registries impacting tool discovery.

## Improvements / Capabilities That Would Help Next
- A generator to scaffold URP artifacts for a new use case (directory + three JSON files + placeholder scenarios/steps).
- A CI check that fails when `packages/capabilities/src/registry.ts` is missing a file that’s exported from `packages/capabilities/index.ts`.
