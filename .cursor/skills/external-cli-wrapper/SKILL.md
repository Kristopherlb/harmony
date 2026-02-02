---
name: external-cli-wrapper
description: Pattern for wrapping external CLIs (Python, Go, Rust tools) in Dagger containers as OCS-compliant capabilities.
---

# External CLI Wrapper Pattern

Use this skill when wrapping an external CLI tool in a Dagger container to create an OCS-compliant capability.

## When to Use

- Integrating Python CLIs (Trestle, C2P, Checkov)
- Integrating Go CLIs (Trivy, Grype, Cosign, Scorecard)
- Creating COMMANDER-pattern capabilities
- Wrapping any executable that runs in a container

## Pattern Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Capability Factory                       │
│  (Pure function: Input + Config + SecretRefs → Container)   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Dagger Container                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  FROM official/tool-image:pinned-version            │    │
│  │  ENV INPUT_JSON="{...}"                             │    │
│  │  MOUNT /run/secrets/api_key                         │    │
│  │  RUN sh -c 'tool-cli $ARGS && emit JSON output'     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Instructions

### 1. Pin the Container Image Version

Always use a specific version tag, never `latest` in production:

```typescript
// ✅ Good
.from('bridgecrew/checkov:3.2.25')
.from('aquasec/trivy:0.50.1')

// ❌ Bad (unpredictable behavior)
.from('bridgecrew/checkov:latest')
```

### 2. Define Schemas with Rich Descriptions

Every field should have a `.describe()` for MCP discovery:

```typescript
const inputSchema = z.object({
  operation: z.enum(['scan', 'verify']).describe('CLI operation to execute'),
  target: z.string().describe('Target file or directory path'),
  format: z.enum(['json', 'table']).optional().describe('Output format'),
});
```

### 3. Use the Factory Template

The factory must be pure — no side effects, no network calls:

```typescript
factory: (dag, context: CapabilityContext<Config, Secrets>, input: Input) => {
  const d = dag as unknown as DaggerClient;
  
  let container = d
    .container()
    .from('tool/image:version')
    .withEnvVariable('INPUT_JSON', JSON.stringify(input))
    .withEnvVariable('OPERATION', input.operation);
  
  // Mount secrets securely
  if (context.secretRefs.apiKey) {
    container = container.withMountedSecret(
      '/run/secrets/api_key',
      context.secretRefs.apiKey
    );
  }
  
  return container.withExec(['sh', '-c', `
    # Read secrets from mounted files, never env vars
    if [ -f /run/secrets/api_key ]; then
      export API_KEY=$(cat /run/secrets/api_key)
    fi
    
    # Execute CLI and capture output
    tool-cli $ARGS | jq '{success: true, data: .}'
  `]);
}
```

### 4. Handle Output Consistently

All capabilities should emit structured JSON:

```typescript
const outputSchema = z.object({
  success: z.boolean().describe('Whether the operation succeeded'),
  operation: z.string().describe('Operation performed'),
  data: z.unknown().optional().describe('Raw tool output'),
  message: z.string().describe('Human-readable result'),
  durationMs: z.number().optional().describe('Execution time'),
});
```

### 5. Set Security Metadata

```typescript
security: {
  requiredScopes: ['security:scan'],
  dataClassification: 'INTERNAL',
  networkAccess: {
    allowOutbound: [
      'registry.example.com',  // Only what's needed
    ],
  },
  oscalControlIds: ['RA-5', 'SI-3'],  // Relevant controls
},
```

### 6. Test Pattern: Mock the Container

```typescript
describe('tool.capability', () => {
  it('constructs correct command arguments', async () => {
    const mockDag = createMockDag();
    
    toolCapability.factory(mockDag, mockContext, {
      operation: 'scan',
      target: '/app',
    });
    
    expect(mockDag.lastExecArgs).toContain('scan');
    expect(mockDag.lastExecArgs).toContain('/app');
  });
});
```

## Prior Art Examples

Reference these existing capabilities for implementation patterns:

| Capability | CLI | Language | Notes |
|------------|-----|----------|-------|
| [checkov.capability.ts](file:///Users/kristopherbowles/code/harmony/packages/capabilities/src/security/checkov.capability.ts) | Checkov | Python | IaC security scanning |
| [trivy-scanner.capability.ts](file:///Users/kristopherbowles/code/harmony/packages/capabilities/src/security/trivy-scanner.capability.ts) | Trivy | Go | Vulnerability scanning |
| [grype.capability.ts](file:///Users/kristopherbowles/code/harmony/packages/capabilities/src/security/grype.capability.ts) | Grype | Go | SBOM vulnerability matching |
| [sigstore.capability.ts](file:///Users/kristopherbowles/code/harmony/packages/capabilities/src/security/sigstore.capability.ts) | Cosign | Go | Signing and verification |
| [slsa-verifier.capability.ts](file:///Users/kristopherbowles/code/harmony/packages/capabilities/src/security/slsa-verifier.capability.ts) | slsa-verifier | Go | Provenance verification |
| [scorecard.capability.ts](file:///Users/kristopherbowles/code/harmony/packages/capabilities/src/security/scorecard.capability.ts) | Scorecard | Go | OpenSSF security scoring |

## Common Patterns

### Multi-Operation Capabilities

```typescript
const operationSchema = z.enum([
  'scan',      // Scan for issues
  'report',    // Generate report
  'verify',    // Verify artifacts
  'list',      // List available resources
]);

// In factory, switch on operation:
case 'scan': ARGS="--scan $TARGET"; break;
case 'report': ARGS="--report --format json"; break;
```

### Error Classification

```typescript
operations: {
  errorMap: (error: unknown) => {
    if (error instanceof Error) {
      if (error.message.includes('timeout')) return 'RETRYABLE';
      if (error.message.includes('rate limit')) return 'RETRYABLE';
      if (error.message.includes('not found')) return 'FATAL';
      if (error.message.includes('unauthorized')) return 'FATAL';
    }
    return 'FATAL';
  },
},
```

### Version Pinning Strategy

```typescript
// In config schema, allow version override:
const configSchema = z.object({
  imageVersion: z.string().optional()
    .describe('Override default image version (e.g., "3.2.25")'),
});

// In factory:
const version = context.config.imageVersion ?? '3.2.25';
container.from(`tool/image:${version}`);
```

## References

- [references/cli-wrapper-template.ts](file:///Users/kristopherbowles/code/harmony/.cursor/skills/external-cli-wrapper/references/cli-wrapper-template.ts) — Copy-paste template
- [Open Capability Standard](file:///Users/kristopherbowles/code/harmony/.cursor/skills/open-capability-standard/SKILL.md) — OCS patterns
- [Capability Generator](file:///Users/kristopherbowles/code/harmony/.cursor/skills/capability-generator/SKILL.md) — Code generation skill
