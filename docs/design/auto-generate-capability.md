# Design: Auto-Generate Capability from Spec

> **Status:** Concept / Future Work  
> **Related ADR:** ADR-001 (OSCAL Compass Integration)

## Problem Statement

Creating a new CLI wrapper capability requires:

1. Understanding the CLI's commands and options
2. Manually writing Zod schemas for input/output
3. Copying and adapting the factory template
4. Adding tests and documentation

For a tool with many commands, this can take hours of repetitive work.

## Proposed Solution

An auto-generator that produces capability code from:
- **OpenAPI specs** (for REST APIs)
- **CLI `--help` output** (for command-line tools)
- **GraphQL schemas** (for GraphQL APIs)

## Input Formats

### CLI Help Output

```bash
trestle --help

Usage: trestle [OPTIONS] COMMAND [ARGS]...

Commands:
  init         Initialize a trestle workspace
  author       Author OSCAL documents
  validate     Validate OSCAL documents
  import       Import OSCAL documents
  export       Export OSCAL documents
  assemble     Assemble OSCAL documents
```

### OpenAPI Spec

```yaml
openapi: 3.0.0
info:
  title: Example API
  version: 1.0.0
paths:
  /items:
    get:
      operationId: listItems
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
      responses:
        200:
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ItemList'
```

### GraphQL Schema

```graphql
type Query {
  items(limit: Int): [Item!]!
}

type Item {
  id: ID!
  name: String!
}
```

## Output

Generated capability file with:

```typescript
// Auto-generated from: trestle --help
// Generated: 2026-02-01T00:00:00Z

import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

const operationSchema = z.enum([
  'init',
  'author',
  'validate',
  'import',
  'export',
  'assemble',
]).describe('Trestle operation');

const inputSchema = z.object({
  operation: operationSchema,
  workspace: z.string().optional().describe('Trestle workspace directory'),
  // ... extracted parameters
}).describe('Trestle input');

// ... rest of capability
```

## Generation Strategies

### Strategy 1: CLI Parser

1. Run `tool --help` and capture output
2. Parse command/subcommand structure
3. For each command, run `tool COMMAND --help`
4. Extract parameters, types, and descriptions
5. Generate Zod schemas

**Challenges:**
- Help output formats vary widely
- Type inference is imprecise
- Cannot discover response schemas

### Strategy 2: OpenAPI/GraphQL

1. Fetch spec from URL or file
2. Parse with standard libraries
3. Map to Zod schemas
4. Generate CONNECTOR pattern capability

**Libraries:**
- `openapi-typescript` for OpenAPI → TypeScript
- `graphql-codegen` for GraphQL → TypeScript

### Strategy 3: LLM-Assisted

1. Provide CLI help or API docs to LLM
2. Prompt for Zod schema generation
3. Human reviews and corrects output
4. LLM learns from corrections

**Trade-offs:**
- Faster prototyping
- May need manual cleanup
- Non-deterministic

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Capability Generator CLI                         │
│                                                                     │
│  nx generate capability --from=cli --tool=trestle                   │
│  nx generate capability --from=openapi --spec=./openapi.yaml        │
│  nx generate capability --from=graphql --schema=./schema.graphql    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Spec Parsers                                │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │  CLI Parser │  │ OpenAPI     │  │ GraphQL     │                 │
│  │  (help2man) │  │ Parser      │  │ Parser      │                 │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                 │
│         │                │                │                         │
│         └────────────────┼────────────────┘                         │
│                          ▼                                          │
│                  ┌───────────────┐                                  │
│                  │ Unified Spec  │                                  │
│                  │ (operations,  │                                  │
│                  │  params,      │                                  │
│                  │  types)       │                                  │
│                  └───────┬───────┘                                  │
└──────────────────────────┼──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Code Generator                                  │
│                                                                     │
│  - Select template (COMMANDER, CONNECTOR)                           │
│  - Generate Zod schemas from spec                                   │
│  - Generate factory from template                                   │
│  - Generate test stubs                                              │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Output Files                                 │
│                                                                     │
│  - packages/capabilities/src/{category}/{tool}.capability.ts        │
│  - packages/capabilities/src/{category}/{tool}.capability.test.ts   │
└─────────────────────────────────────────────────────────────────────┘
```

## MVP Scope

For initial implementation, focus on:

1. **OpenAPI → CONNECTOR** — Most structured, well-defined
2. **Simple CLI → COMMANDER** — Parse common help formats

Defer GraphQL and complex CLIs to later iterations.

## Success Criteria

- [ ] Generate working capability from OpenAPI spec
- [ ] Generate working capability from simple CLI help
- [ ] Generated code compiles without manual edits
- [ ] Generated code passes linting
- [ ] Developer only needs to fill in 10-20% of logic

## Estimated Effort

- OpenAPI generator: 1 week
- CLI parser (simple): 1 week
- CLI parser (complex): 2 weeks
- GraphQL generator: 3 days

## Similar Tools

- [openapi-generator](https://github.com/OpenAPITools/openapi-generator) — Multi-language OpenAPI codegen
- [graphql-code-generator](https://the-guild.dev/graphql/codegen) — GraphQL schema to code
- [commander.js](https://github.com/tj/commander.js) — Node.js CLI framework (for reference)

## References

- [Capability Generator Skill](file:///Users/kristopherbowles/code/harmony/.cursor/skills/capability-generator/SKILL.md)
- [External CLI Wrapper Pattern](file:///Users/kristopherbowles/code/harmony/.cursor/skills/external-cli-wrapper/SKILL.md)
- [Open Capability Standard](file:///Users/kristopherbowles/code/harmony/.cursor/skills/open-capability-standard/SKILL.md)
