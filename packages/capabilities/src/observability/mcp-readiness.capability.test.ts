/**
 * packages/capabilities/src/observability/mcp-readiness.capability.test.ts
 * TCS-001 contract verification for MCP Readiness capability.
 */
import { describe, it, expect } from 'vitest';
import { mcpReadinessCapability } from './mcp-readiness.capability.js';

describe('mcpReadinessCapability', () => {
  describe('TCS-001 contract verification', () => {
    it('validates aiHints examples against input schema', () => {
      expect(() =>
        mcpReadinessCapability.schemas.input.parse(mcpReadinessCapability.aiHints!.exampleInput)
      ).not.toThrow();
    });

    it('validates aiHints examples against output schema', () => {
      expect(() =>
        mcpReadinessCapability.schemas.output.parse(mcpReadinessCapability.aiHints!.exampleOutput)
      ).not.toThrow();
    });

    it('has required OCS metadata fields', () => {
      expect(mcpReadinessCapability.metadata.id).toBe('golden.observability.mcp-readiness');
      expect(mcpReadinessCapability.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(mcpReadinessCapability.metadata.name).toBe('mcpReadiness');
      expect(mcpReadinessCapability.metadata.description).toBeTruthy();
      expect(mcpReadinessCapability.metadata.tags).toContain('observability');
      expect(mcpReadinessCapability.metadata.tags).toContain('mcp');
    });
  });

  describe('factory', () => {
    it('builds a Dagger container with MCP URL and timeout', () => {
      const calls: { env: Array<{ key: string; value: string }>; exec: string[][]; from: string[] } = {
        env: [],
        exec: [],
        from: [],
      };
      const fakeDag = {
        container() {
          const builder = {
            from(image: string) {
              calls.from.push(image);
              return builder;
            },
            withEnvVariable(key: string, value: string) {
              calls.env.push({ key, value });
              return builder;
            },
            withExec(args: string[]) {
              calls.exec.push(args);
              return builder;
            },
          };
          return builder;
        },
      };

      mcpReadinessCapability.factory(fakeDag, { config: {}, secretRefs: {} }, { baseUrl: 'http://localhost:5000' });

      expect(calls.from).toContain('alpine:latest');
      expect(calls.env.find((e) => e.key === 'MCP_URL')?.value).toBe('http://localhost:5000/api/mcp/tools');
      expect(calls.exec.length).toBe(1);
      expect(calls.exec[0].join(' ')).toContain('curl');
      expect(calls.exec[0].join(' ')).toContain('$MCP_URL');
    });
  });
});
