## Purpose

Validate “dogfooding”: Harmony deploys Harmony **using its own Blueprints + Capabilities** (no bespoke CI logic).

This runbook focuses on:
- `blueprints.deploy.blue-green` (deploy orchestration)
- `golden.k8s.apply` (Kubernetes apply with `${...}` substitutions)
- `golden.flags.flagd-sync` (flagd ConfigMap sync)
- `golden.temporal.version-manager` (worker Build ID lifecycle)

## Prerequisites

- **Temporal reachable** from the runner (set `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE`, `TASK_QUEUE`)
- **Kubernetes reachable** by `golden.k8s.apply` and `golden.flags.flagd-sync` (provide kubeconfig via capability secrets)
- **flagd deployed** in the target namespace:
  - Apply `deploy/k8s/flagd/deployment.yaml`
  - Apply `deploy/k8s/flagd/service.yaml`
- **Worker image buildable** by `golden.ci.container-builder`

## Inputs

- **Version**: use a SemVer tag (e.g. `v2.0.0`)
- **Registry**: e.g. `ghcr.io/<org-or-user>`
- **Namespace**: e.g. `default` or `production`

## Execute (GitHub Actions)

- Push a tag `v*` to trigger `.github/workflows/deploy.yml`.
- Ensure these secrets exist in the repo:
  - `TEMPORAL_ADDRESS`
  - `TEMPORAL_NAMESPACE`
  - `TASK_QUEUE`

The workflow calls Dagger which calls `runBlueprint`, which starts:
- `blueprints.ci.release-pipeline`
- then `blueprints.deploy.blue-green`

## Execute (GitLab CI)

- Create a tag to trigger `.gitlab-ci.yml` `deploy` stage.
- Provide masked variables in GitLab:
  - `TEMPORAL_ADDRESS`
  - `TEMPORAL_NAMESPACE`
  - `TASK_QUEUE`

## What “success” looks like

- **Temporal**:
  - new Build ID registered as default (the tag/version)
  - optional drain completes for prior Build ID (if provided)
- **Kubernetes**:
  - `harmony-worker-${BUILD_ID}` Deployment exists and becomes available
  - `flagd` Deployment is running and has a `flagd-flags` ConfigMap
- **Flags**:
  - `deploy/flagd/flags.json` is synced into `flagd-flags` (via `golden.flags.flagd-sync`)

## Troubleshooting

- **Blueprint start fails**: confirm `TEMPORAL_ADDRESS` is correct and reachable from the CI runner.
- **K8s apply fails**: confirm kubeconfig secret wiring for `golden.k8s.apply`.
- **flagd not serving flags**: confirm `flagd-flags` ConfigMap exists and `flagd` pods have `/etc/flagd/flags.json`.

## Local runtime smoke (Kind) — IMP-023

This is a **runtime-true** local smoke that exercises real capabilities against a Kind cluster:
- `golden.flags.flagd-sync` (sync flags into ConfigMap using inline JSON)
- `golden.k8s.apply` (apply worker deployment YAML using inline manifests)

Prereqs:
- `docker`, `kubectl`, `kind`
- OpenBao + Temporal running locally (`docker-compose up -d openbao temporal postgres`)

Run:

```bash
pnpm --filter @golden/blueprints run bundle-workflows
ENABLE_DAGGER_E2E=1 pnpm --filter @golden/blueprints exec tsx scripts/run-kind-dogfood-blue-green.ts
```


