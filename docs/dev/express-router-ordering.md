# Express Router Ordering (Golden Path)

When a router defines parameterized routes like `/:id` or `/:actionId`, **route registration order matters**.

## The failure mode

If `/:actionId` is registered before fixed-prefix routes, then requests like `/executions` can be interpreted as `{ actionId: "executions" }`, causing confusing 404s.

## Golden rule

**Register fixed-prefix routes first, and parameter routes last.**

Good:

```ts
router.get("/executions", ...);
router.get("/approvals/pending", ...);
router.get("/:actionId", ...);
```

Bad:

```ts
router.get("/:actionId", ...);
router.get("/executions", ...); // may never be hit
```

## Guardrail

Add a route test that hits the fixed-prefix paths (e.g. `/api/actions/executions`) so route shadowing is caught immediately.

