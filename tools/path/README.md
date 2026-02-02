## @golden/path

Local Nx generators for the Golden Path monorepo.

### Quickstart

- **List generators**:

```bash
pnpm nx list @golden/path
```

- **Dry-run a generator** (recommended):

```bash
pnpm nx g @golden/path:hitl-gate --name=deployment-approval --dry-run
pnpm nx g @golden/path:context-extension --name=incident --fields=incident_id:string --fields=severity:string --dry-run
pnpm nx g @golden/path:webhook-handler --name=slack-interactive --source=slack --dry-run
```

### Sync (regenerate registries deterministically)

```bash
pnpm nx g @golden/path:sync --dry-run
pnpm nx g @golden/path:sync
```

If sync complains about a missing tool catalog artifact, regenerate it first:

```bash
pnpm nx run mcp-server:generate-tool-catalog
```

### Debugging “Nx test output is terse”

If `pnpm nx test path` fails but doesn’t show enough detail, run Vitest directly:

```bash
pnpm test:path:debug
```

### Common option patterns

- **Repeatable `--fields`**: `--fields=name:type[:optional|required]`
  - Example: `--fields=incident_id:string:required`

