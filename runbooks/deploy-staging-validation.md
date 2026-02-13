## Purpose

Validate the Deploy baseline in **staging**:

`blueprints.deploy.blue-green` executes against a staging cluster using `kubeconfigSecretRef`, and the run is observable and rollback-capable.

This runbook includes a reproducible “start + wait for result” script.

## Preconditions

- Staging Console is reachable at `BASE_URL`
- Staging Console + worker can reach:
  - Temporal
  - OpenBao (least-priv auth; see `openbao-least-priv` todo)
  - Kubernetes API (via kubeconfig secretRef)
- Staging worker is configured for **runtime-true** capability execution (Dagger enabled)

## Required secrets (OpenBao)

Store a kubeconfig in OpenBao KV v2 and reference it via ISS-001 absolute path:

- `KUBECONFIG_SECRET_REF=/artifacts/console/public/secrets/staging.kubeconfig`

The worker must have **read** access to this path.

## Execute a staging run (recommended: synthetic, deterministic)

1. Export required vars:

```bash
export BASE_URL="https://<staging-console>"
export KUBECONFIG_SECRET_REF="/artifacts/console/public/secrets/staging.kubeconfig"
```

2. Run the staging validator:

```bash
node tools/scripts/deploy-staging-blue-green-validate.mjs \
  --base-url "$BASE_URL" \
  --kubeconfig-secret-ref "$KUBECONFIG_SECRET_REF" \
  --namespace default \
  --version "v0.0.0-staging-smoke" \
  --image-ref "nginx:1.25-alpine"
```

Expected output:
- `ok: true`
- `workflowId`
- `result.success: true`

Notes:
- This path uses `skipBuild=true` and inline manifests so the staging run does not depend on repo-path mounting inside containers.

## Optional: induced-failure rollback validation

If you need to validate rollback paths, run a second test that intentionally fails after an apply and confirm:
- the workflow ends in FAILED
- rollback operations were executed (e.g., rollout restart)

(This is best validated with a dedicated staging harness once `openbao-least-priv` is in place and workers are fully observable.)

## Troubleshooting

- **`OPENBAO_READ_FAILED`**:
  - OpenBao policy is missing read permission for kubeconfig secretRef.
- **`DAGGER_E2E_DISABLED`**:
  - Worker is not configured for Dagger-backed capability execution.
- **K8s apply errors**:
  - Verify kubeconfig has cluster reachability from the worker environment.

