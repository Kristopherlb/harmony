# Runbook: Reset database connection pool (safe pattern)

## Purpose

Safely reset application DB connection pools by restarting app pods (preferred) or triggering an app-specific admin endpoint. This is designed for execution via the `golden.operations.runme-runner` capability.

## Inputs

- `K8S_NAMESPACE`: Kubernetes namespace (default: `default`)
- `APP_SELECTOR`: Label selector for the app pods (example: `app=api-gateway`)
- `ROLLING_KIND`: `deployment` or `statefulset` (default: `deployment`)
- `ROLLING_NAME`: Workload name (example: `api-gateway`)
- `OPTIONAL_ADMIN_URL`: Optional admin endpoint to reset pools (example: `https://api.example.com/admin/db/pool/reset`)
- `AUTH_HEADER`: Optional Authorization header for admin endpoint (example: `Bearer <token>`)

---

### Pre-check: show pods

```sh { name=precheck-pods interactive=false }
set -euo pipefail

K8S_NAMESPACE="${K8S_NAMESPACE:-default}"
APP_SELECTOR="${APP_SELECTOR:-app=api-gateway}"

echo "Namespace: $K8S_NAMESPACE"
echo "Selector:  $APP_SELECTOR"

kubectl get pods -n "$K8S_NAMESPACE" -l "$APP_SELECTOR" -o wide
```

---

### Option A (preferred): rolling restart the application workload

```sh { name=rolling-restart-app interactive=false }
set -euo pipefail

K8S_NAMESPACE="${K8S_NAMESPACE:-default}"
ROLLING_KIND="${ROLLING_KIND:-deployment}"
ROLLING_NAME="${ROLLING_NAME:-api-gateway}"

echo "Restarting: $ROLLING_KIND/$ROLLING_NAME in namespace $K8S_NAMESPACE"

kubectl rollout restart "$ROLLING_KIND/$ROLLING_NAME" -n "$K8S_NAMESPACE"
kubectl rollout status "$ROLLING_KIND/$ROLLING_NAME" -n "$K8S_NAMESPACE" --timeout=10m
```

---

### Option B: call admin endpoint (only if available)

```sh { name=admin-endpoint-reset interactive=false }
set -euo pipefail

OPTIONAL_ADMIN_URL="${OPTIONAL_ADMIN_URL:-}"
AUTH_HEADER="${AUTH_HEADER:-}"

if [ -z "$OPTIONAL_ADMIN_URL" ]; then
  echo "OPTIONAL_ADMIN_URL not set; skipping admin endpoint reset."
  exit 0
fi

echo "POST $OPTIONAL_ADMIN_URL"

if [ -n "$AUTH_HEADER" ]; then
  curl -sS --fail --max-time 20 -X POST -H "Authorization: $AUTH_HEADER" "$OPTIONAL_ADMIN_URL"
else
  curl -sS --fail --max-time 20 -X POST "$OPTIONAL_ADMIN_URL"
fi
echo
```

---

### Post-check: pods Ready

```sh { name=postcheck-ready interactive=false }
set -euo pipefail

K8S_NAMESPACE="${K8S_NAMESPACE:-default}"
APP_SELECTOR="${APP_SELECTOR:-app=api-gateway}"

kubectl wait --for=condition=Ready pods -n "$K8S_NAMESPACE" -l "$APP_SELECTOR" --timeout=10m
kubectl get pods -n "$K8S_NAMESPACE" -l "$APP_SELECTOR" -o wide
```

