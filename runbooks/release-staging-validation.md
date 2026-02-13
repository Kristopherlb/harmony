## Purpose

Validate the Release baseline in **staging**:

GitHub webhook → Console ingress → Temporal workflow → GitHub API.

This runbook is designed to be auditable (inputs, secrets, expected outputs) and to explicitly verify **idempotency** and **trace correlation**.

## Preconditions

- Staging Console is reachable at `BASE_URL`
- Staging Console can reach:
  - Temporal (`TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE`, `TEMPORAL_TASK_QUEUE`)
  - OpenBao (`BAO_ADDR`) using a **least-priv** auth method (see `openbao-least-priv` todo)
- The release blueprint is registered:
  - `blueprints.ci.github-release`

## Required secrets (OpenBao)

These are ISS-001-style absolute paths.

- **GitHub webhook signing secret** (used by ingress verification):
  - `GITHUB_WEBHOOK_SECRET_REF=/artifacts/console/public/secrets/github.webhook_secret`
- **GitHub API token** (used by capabilities at runtime):
  - `GITHUB_TOKEN_SECRET_REF=/artifacts/console/public/secrets/github.token`

Write these into OpenBao KV v2 under your staging KV mount (commonly `secret/`).

## Console configuration (staging env vars)

Ingress (required):

- `GITHUB_WEBHOOK_SECRET_REF=/artifacts/console/public/secrets/github.webhook_secret`
- `GITHUB_TOKEN_SECRET_REF=/artifacts/console/public/secrets/github.token`

Temporal (required):

- `TEMPORAL_ADDRESS=<staging-temporal-host:7233>`
- `TEMPORAL_NAMESPACE=<namespace>`
- `TEMPORAL_TASK_QUEUE=<task-queue>`

OpenBao (required):

- `BAO_ADDR=<https://openbao.staging...>`
- `BAO_KV_MOUNT=<kv-mount>` (default in dev is `secret`)
- **Authentication**: use staging least-priv method (token/AppRole) — see `openbao-least-priv` todo.

Optional:

- `GITHUB_RELEASE_BLUEPRINT_ID=blueprints.ci.github-release` (default)

## Verify health (Temporal connectivity)

```bash
curl -sS --fail "$BASE_URL/api/workflows/health"
```

Expected: `{ "ok": true }`.

## Execute a real webhook-triggered run (two options)

### Option A: GitHub-hosted webhook (human-in-the-loop)

1. In GitHub repo settings, configure webhook:
   - **Payload URL**: `$BASE_URL/api/webhooks/github`
   - **Content type**: `application/json`
   - **Secret**: must match the value stored at `GITHUB_WEBHOOK_SECRET_REF`
   - **Events**: at least `push`
2. Trigger a push to the target repo (or use GitHub “Redeliver” for an existing delivery).
3. Observe Console response codes (or logs) and confirm a workflow run exists in Temporal.

Idempotency note:
- GitHub retry semantics typically reuse `X-GitHub-Delivery` for retries.
- This ingress uses `workflowId=release-${deliveryId}` so duplicates converge on a single run.

### Option B: Synthetic webhook verifier (deterministic + reproducible)

This is the recommended staging “execute” path because it is repeatable and proves idempotency explicitly.

1. Export your webhook secret into a local env var (do not commit it):

```bash
export BASE_URL="https://<staging-console>"
export REPO_FULL_NAME="owner/repo"
export GITHUB_WEBHOOK_SECRET="..."
```

2. Run the verifier:

```bash
node tools/scripts/release-staging-validate.mjs \
  --base-url "$BASE_URL" \
  --repo "$REPO_FULL_NAME" \
  --webhook-secret-env GITHUB_WEBHOOK_SECRET
```

Expected output:
- `ok: true`
- `idempotent: true`
- `workflowId` + `runId`
- `result` includes the blueprint output (no secrets)

## Validate trace correlation

Ingress derives:

- `workflowId = release-${deliveryId}`
- `traceId = trace-${workflowId}`

Validate correlation in your log aggregation / traces by searching for the `traceId` value.

## Troubleshooting

- **401 INVALID_SIGNATURE**:
  - `GITHUB_WEBHOOK_SECRET_REF` doesn’t match the secret used to sign the request.
  - Confirm the OpenBao value and the secret used in GitHub (or synthetic script).
- **500 GITHUB_TOKEN_SECRET_REF_REQUIRED**:
  - The Console env is missing `GITHUB_TOKEN_SECRET_REF`.
- **Workflow fails with Dagger errors**:
  - Ensure the staging worker is configured for Dagger execution and can reach Docker / your runner.
- **OPENBAO_READ_FAILED**:
  - OpenBao policy is missing read permission for the required secret paths.

