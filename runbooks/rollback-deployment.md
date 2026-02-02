# Runbook: Roll back a Kubernetes deployment

## Purpose

Safely roll back a Kubernetes Deployment or StatefulSet to a previous revision, with pre/post checks. This runbook is designed for execution via the `golden.operations.runme-runner` capability.

## Inputs

- `K8S_NAMESPACE`: Kubernetes namespace (default: `default`)
- `KIND`: `deployment` | `statefulset` (default: `deployment`)
- `NAME`: Workload name (required)
- `REVISION`: Optional specific revision to roll back to (if omitted, rolls back one revision)

---

### Validate inputs and show rollout history

```sh { name=show-history interactive=false }
set -euo pipefail

K8S_NAMESPACE="${K8S_NAMESPACE:-default}"
KIND="${KIND:-deployment}"
: "${NAME:?NAME is required}"

kubectl rollout history "$KIND/$NAME" -n "$K8S_NAMESPACE"
```

---

### Roll back workload

```sh { name=rollback interactive=false }
set -euo pipefail

K8S_NAMESPACE="${K8S_NAMESPACE:-default}"
KIND="${KIND:-deployment}"
: "${NAME:?NAME is required}"
REVISION="${REVISION:-}"

if [ -n "$REVISION" ]; then
  echo "Rolling back $KIND/$NAME to revision $REVISION"
  kubectl rollout undo "$KIND/$NAME" -n "$K8S_NAMESPACE" --to-revision="$REVISION"
else
  echo "Rolling back $KIND/$NAME by one revision"
  kubectl rollout undo "$KIND/$NAME" -n "$K8S_NAMESPACE"
fi

kubectl rollout status "$KIND/$NAME" -n "$K8S_NAMESPACE" --timeout=10m
```

---

### Post-check: list pods and events

```sh { name=postcheck interactive=false }
set -euo pipefail

K8S_NAMESPACE="${K8S_NAMESPACE:-default}"
: "${NAME:?NAME is required}"

kubectl get pods -n "$K8S_NAMESPACE" -o wide
kubectl get events -n "$K8S_NAMESPACE" --sort-by=.metadata.creationTimestamp | tail -n 50
```

