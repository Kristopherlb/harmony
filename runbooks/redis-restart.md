# Runbook: Restart Redis (safe, with health checks)

## Purpose

Safely restart Redis (or Redis-like) workloads with pre/post checks. This is designed to be executed via the `golden.operations.runme-runner` capability.

## Preconditions

- You have access to the target Kubernetes cluster/context.
- You have `kubectl` configured in the execution environment.
- You know the namespace and a label selector that identifies the Redis workload pods.

## Inputs

- `K8S_NAMESPACE`: Kubernetes namespace (default: `default`)
- `POD_SELECTOR`: Label selector to identify pods (example: `app=redis`)
- `ROLLING_KIND`: One of `deployment`, `statefulset` (default: `statefulset`)
- `ROLLING_NAME`: Workload name (example: `redis`)

---

### Verify access and current status

```sh { name=verify-access interactive=false }
set -euo pipefail

K8S_NAMESPACE="${K8S_NAMESPACE:-default}"
POD_SELECTOR="${POD_SELECTOR:-app=redis}"

echo "Namespace: $K8S_NAMESPACE"
echo "Selector:  $POD_SELECTOR"

kubectl get ns "$K8S_NAMESPACE" >/dev/null
kubectl get pods -n "$K8S_NAMESPACE" -l "$POD_SELECTOR" -o wide
```

---

### Capture pod list (for audit)

```sh { name=capture-pods interactive=false }
set -euo pipefail

K8S_NAMESPACE="${K8S_NAMESPACE:-default}"
POD_SELECTOR="${POD_SELECTOR:-app=redis}"

kubectl get pods -n "$K8S_NAMESPACE" -l "$POD_SELECTOR" -o name
```

---

### Rolling restart workload

```sh { name=rolling-restart interactive=false }
set -euo pipefail

K8S_NAMESPACE="${K8S_NAMESPACE:-default}"
ROLLING_KIND="${ROLLING_KIND:-statefulset}"
ROLLING_NAME="${ROLLING_NAME:-redis}"

echo "Restarting: $ROLLING_KIND/$ROLLING_NAME in namespace $K8S_NAMESPACE"

kubectl rollout restart "$ROLLING_KIND/$ROLLING_NAME" -n "$K8S_NAMESPACE"
kubectl rollout status "$ROLLING_KIND/$ROLLING_NAME" -n "$K8S_NAMESPACE" --timeout=10m
```

---

### Post-check: pods Ready

```sh { name=postcheck-ready interactive=false }
set -euo pipefail

K8S_NAMESPACE="${K8S_NAMESPACE:-default}"
POD_SELECTOR="${POD_SELECTOR:-app=redis}"

kubectl wait --for=condition=Ready pods -n "$K8S_NAMESPACE" -l "$POD_SELECTOR" --timeout=10m
kubectl get pods -n "$K8S_NAMESPACE" -l "$POD_SELECTOR" -o wide
```

