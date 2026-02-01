/**
 * BaseAgent: discoverTools and guardrails wiring.
 */
import { describe, it, expect } from 'vitest';
import { BaseAgent } from './base-agent';
import type { ToolRegistry } from '@golden/core';

describe('BaseAgent', () => {
  const agent = new BaseAgent({
    metadata: { id: 'agent.test', version: '1.0.0', description: 'Test agent' },
    authorizedTools: ['cap.a', 'cap.b'],
    systemPrompt: 'You are a test agent.',
    guardrails: { max_iterations: 10, token_limit: 1000 },
  });

  it('getTools returns map from registry for authorized IDs', () => {
    const registry: ToolRegistry = {
      get: (id) => (id === 'cap.a' ? async () => ({ result: 'ok' }) : undefined),
      list: () => ['cap.a'],
    };
    const tools = agent.getTools(registry);
    expect(tools.size).toBe(1);
    expect(tools.has('cap.a')).toBe(true);
  });

  it('checkIteration enforces max_iterations', () => {
    expect(agent.checkIteration(5)).toEqual({ pass: true });
    expect(agent.checkIteration(10)).toEqual({ pass: false, reason: 'MAX_ITERATIONS_EXCEEDED' });
  });

  it('checkTokens enforces token_limit', () => {
    expect(agent.checkTokens(500)).toEqual({ pass: true });
    expect(agent.checkTokens(1000)).toEqual({ pass: false, reason: 'TOKEN_LIMIT_EXCEEDED' });
  });

  it('checkRestrictedTool requires approval for RESTRICTED', () => {
    expect(agent.checkRestrictedTool('PUBLIC')).toEqual({ pass: true });
    expect(agent.checkRestrictedTool('RESTRICTED')).toEqual({
      pass: false,
      reason: 'RESTRICTED_TOOL_REQUIRES_APPROVAL',
    });
  });
});
