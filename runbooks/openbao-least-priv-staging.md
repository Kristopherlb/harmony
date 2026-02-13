## Purpose

Define a **least-priv OpenBao posture** for staging while keeping local dev defaults intact.

This runbook focuses on:

- **Auth**: AppRole (no long-lived dev-root tokens)
- **Policy**: read-only access scoped to specific ISS-001 secret paths
- **Runtime**: Console ingress and worker secret resolution both support AppRole

## What shipped (code support)

- Console webhook ingress (`/api/webhooks/github`) supports:
  - `BAO_TOKEN` / `VAULT_TOKEN` (preferred for local dev)
  - `BAO_ROLE_ID` + `BAO_SECRET_ID` (+ optional `BAO_AUTH_MOUNT`) for AppRole
- Worker secretRef resolver supports:
  - same AppRole env vars (via `execute-dagger-capability` → `resolveSecretRefs`)
- Both paths cache the AppRole client token in-memory (best effort, lease-aware).

## Staging environment variables

OpenBao:

- `BAO_ADDR=https://openbao.staging.example.com`
- `BAO_KV_MOUNT=secret`
- `BAO_AUTH_MOUNT=approle` (default if omitted)
- `BAO_ROLE_ID=...`
- `BAO_SECRET_ID=...`

Do **not** set `BAO_TOKEN` in staging unless you are intentionally using a short-lived token that is already least-priv.

## Secret paths (ISS-001)

These are typical staging needs for the baseline tracks:

- GitHub webhook signing secret:
  - `/artifacts/console/public/secrets/github.webhook_secret`
- GitHub token:
  - `/artifacts/console/public/secrets/github.token`
- Kubernetes kubeconfig for deploy smoke:
  - `/artifacts/console/public/secrets/staging.kubeconfig`

## Example OpenBao policy (read-only)

Create a policy allowing **read** on exactly the KV v2 data paths you need.

For KV v2 mounted at `secret/`, these APIs are used:

- `secret/data/<path>` (read)

Example (HCL):

```hcl
path "secret/data/artifacts/console/public/secrets/github.webhook_secret" {
  capabilities = ["read"]
}

path "secret/data/artifacts/console/public/secrets/github.token" {
  capabilities = ["read"]
}

path "secret/data/artifacts/console/public/secrets/staging.kubeconfig" {
  capabilities = ["read"]
}
```

## Example AppRole setup (operator workflow)

1. Create/attach the policy above (e.g., `console-staging-read-secrets`).
2. Create an AppRole (e.g., `console-staging`) and attach that policy.
3. Issue:
   - `role_id` (stable)
   - `secret_id` (rotatable)
4. Inject into staging worker + console environments as:
   - `BAO_ROLE_ID`, `BAO_SECRET_ID`

Rotation guidance:
- rotate `secret_id` periodically
- avoid distributing raw tokens

## Validation checklist

- [ ] `node tools/scripts/release-staging-validate.mjs ...` succeeds (webhook + idempotency)
- [ ] `node tools/scripts/deploy-staging-blue-green-validate.mjs ...` succeeds (kubeconfigSecretRef read + k8s apply)
- [ ] OpenBao audit logs show only read access to expected paths

## Scaffold policy/AppRole from current refs

Use the ISS-001 scaffold script to generate a deterministic starting policy from currently referenced secret paths:

```bash
node tools/scripts/generate-iss-001-policy-scaffold.mjs --out /tmp/openbao-scaffold.md
```

Useful flags:

- `--mount secret` (KV v2 mount, default `secret`)
- `--policy-name console-staging-read-secrets`
- `--role-name console-staging`
- `--source <path>` (add additional files to scan)
- `--json` (machine-readable output)

