# Runbook: API health check (comprehensive)

## Purpose

Validate API health quickly during incident response: DNS, TLS, basic liveness, and a small set of endpoint checks. This is designed for execution via the `golden.operations.runme-runner` capability.

## Inputs

- `API_BASE_URL`: Base URL (example: `https://api.example.com`)
- `HEALTH_PATH`: Health endpoint path (default: `/health`)
- `EXTRA_PATHS`: Space-separated additional paths to check (default: `/ready /live`)
- `AUTH_HEADER`: Optional Authorization header value (example: `Bearer <token>`)

---

### Validate inputs and print config

```sh { name=print-config interactive=false }
set -euo pipefail

: "${API_BASE_URL:?API_BASE_URL is required (e.g. https://api.example.com)}"

HEALTH_PATH="${HEALTH_PATH:-/health}"
EXTRA_PATHS="${EXTRA_PATHS:-/ready /live}"

echo "API_BASE_URL=$API_BASE_URL"
echo "HEALTH_PATH=$HEALTH_PATH"
echo "EXTRA_PATHS=$EXTRA_PATHS"
```

---

### DNS + TLS sanity (curl verbose)

```sh { name=dns-tls-sanity interactive=false }
set -euo pipefail

AUTH_HEADER="${AUTH_HEADER:-}"

if [ -n "$AUTH_HEADER" ]; then
  curl -sv --fail --max-time 15 -H "Authorization: $AUTH_HEADER" "$API_BASE_URL" >/dev/null
else
  curl -sv --fail --max-time 15 "$API_BASE_URL" >/dev/null
fi
```

---

### Check health endpoint

```sh { name=check-health interactive=false }
set -euo pipefail

HEALTH_PATH="${HEALTH_PATH:-/health}"
AUTH_HEADER="${AUTH_HEADER:-}"

URL="${API_BASE_URL%/}${HEALTH_PATH}"

if [ -n "$AUTH_HEADER" ]; then
  curl -sS --fail --max-time 15 -H "Authorization: $AUTH_HEADER" "$URL"
else
  curl -sS --fail --max-time 15 "$URL"
fi
echo
```

---

### Check additional endpoints (ready/live/etc.)

```sh { name=check-extra-paths interactive=false }
set -euo pipefail

EXTRA_PATHS="${EXTRA_PATHS:-/ready /live}"
AUTH_HEADER="${AUTH_HEADER:-}"

for p in $EXTRA_PATHS; do
  URL="${API_BASE_URL%/}${p}"
  echo "GET $URL"
  if [ -n "$AUTH_HEADER" ]; then
    curl -sS --fail --max-time 15 -H "Authorization: $AUTH_HEADER" "$URL" >/dev/null
  else
    curl -sS --fail --max-time 15 "$URL" >/dev/null
  fi
  echo "OK"
done
```

