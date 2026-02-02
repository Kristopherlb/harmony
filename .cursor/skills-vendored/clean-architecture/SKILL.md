---
name: clean-architecture
description: Keep domain and application layers free of infrastructure/runtime dependencies. Use adapters to cross boundaries, and wire via composition.
---

# Clean Architecture (Harmony conventions)

Use this skill when creating new subsystems or refactoring code paths across layers.

## Layering Rules

- **Domain**: pure business logic and entities. No runtime imports (DB/HTTP/frameworks).
- **Application**: use-cases and orchestration. Still no DB clients / HTTP servers.
- **Adapters**: translate between outside world and application (HTTP handlers, DB repos).
- **Infrastructure**: concrete implementations (Postgres/Drizzle, external services).
- **Composition**: wiring and dependency injection.

## Dependency Direction

Dependencies only point inward:

Infrastructure → Adapters → Application → Domain

## Practical Guidance

- Put schemas/validation at the boundary (adapter), then pass validated types inward.
- Keep repositories as interfaces in the application layer; implement them in infra.
- Keep side effects (filesystem, network, time) behind small abstractions.

## Smell Checklist

- Domain importing `drizzle`, `pg`, `express`, `zod` at runtime.
- Application constructing DB clients directly.
- Handlers containing business rules instead of delegating to a use-case.

