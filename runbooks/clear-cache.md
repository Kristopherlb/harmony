# Runbook: Clear cache (safe invalidation)

## Purpose

Perform safe cache invalidation during an incident. Prefer scoped invalidation over global flush. This runbook is designed for execution via the `golden.operations.runme-runner` capability.

## Inputs

- `CACHE_KIND`: `redis` | `http` | `cdn` (default: `redis`)
- `REDIS_HOST`: Redis host (if using redis)
- `REDIS_PORT`: Redis port (default: `6379`)
- `REDIS_KEY_PATTERN`: Pattern for scoped delete (example: `user:*`) (required for redis scoped)
- `ALLOW_DANGEROUS_FLUSHALL`: Set to `true` to allow `FLUSHALL` (default: `false`)

---

### Print config

```sh { name=print-config interactive=false }
set -euo pipefail

CACHE_KIND="${CACHE_KIND:-redis}"
REDIS_HOST="${REDIS_HOST:-}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_KEY_PATTERN="${REDIS_KEY_PATTERN:-}"
ALLOW_DANGEROUS_FLUSHALL="${ALLOW_DANGEROUS_FLUSHALL:-false}"

echo "CACHE_KIND=$CACHE_KIND"
echo "REDIS_HOST=$REDIS_HOST"
echo "REDIS_PORT=$REDIS_PORT"
echo "REDIS_KEY_PATTERN=$REDIS_KEY_PATTERN"
echo "ALLOW_DANGEROUS_FLUSHALL=$ALLOW_DANGEROUS_FLUSHALL"
```

---

### Redis: scoped invalidation by key pattern (recommended)

```sh { name=redis-scoped-delete interactive=false }
set -euo pipefail

: "${REDIS_HOST:?REDIS_HOST is required for redis operations}"
: "${REDIS_KEY_PATTERN:?REDIS_KEY_PATTERN is required for scoped delete}"

command -v redis-cli >/dev/null 2>&1 || {
  echo "redis-cli not available in this environment."
  exit 1
}

echo "Deleting keys matching: $REDIS_KEY_PATTERN"

# Note: KEYS is potentially expensive; use with caution.
# Prefer SCAN in production-sized datasets.
redis-cli -h "$REDIS_HOST" -p "${REDIS_PORT:-6379}" --raw KEYS "$REDIS_KEY_PATTERN" \
  | while read -r k; do
      [ -n "$k" ] && redis-cli -h "$REDIS_HOST" -p "${REDIS_PORT:-6379}" DEL "$k" >/dev/null
    done

echo "Done."
```

---

### Redis: full flush (dangerous; gated)

```sh { name=redis-flushall interactive=false }
set -euo pipefail

: "${REDIS_HOST:?REDIS_HOST is required for redis operations}"

ALLOW_DANGEROUS_FLUSHALL="${ALLOW_DANGEROUS_FLUSHALL:-false}"
if [ "$ALLOW_DANGEROUS_FLUSHALL" != "true" ]; then
  echo "Refusing to FLUSHALL. Set ALLOW_DANGEROUS_FLUSHALL=true to proceed."
  exit 1
fi

command -v redis-cli >/dev/null 2>&1 || {
  echo "redis-cli not available in this environment."
  exit 1
}

echo "Running FLUSHALL on $REDIS_HOST:${REDIS_PORT:-6379}"
redis-cli -h "$REDIS_HOST" -p "${REDIS_PORT:-6379}" FLUSHALL
```

