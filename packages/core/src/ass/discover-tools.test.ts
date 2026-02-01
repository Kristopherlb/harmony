/**
 * packages/core/src/ass/discover-tools.test.ts
 * TDD: discoverTools with mock registry (AIP).
 */
import { describe, it, expect } from 'vitest';
import { discoverTools, type ToolRegistry, type ToolFn } from './discover-tools';

describe('discoverTools', () => {
  it('resolves known IDs to tool functions', async () => {
    const toolFn: ToolFn = async () => ({ result: 'ok', trace_id: 'tr-1' });
    const registry: ToolRegistry = {
      get: (id) => (id === 'cap.echo' ? toolFn : undefined),
      list: () => ['cap.echo'],
    };
    const map = discoverTools(registry, ['cap.echo']);
    expect(map.size).toBe(1);
    const fn = map.get('cap.echo');
    expect(fn).toBeDefined();
    const out = await fn!({});
    expect(out.result).toBe('ok');
    expect(out.trace_id).toBe('tr-1');
  });

  it('omits IDs not in registry', () => {
    const registry: ToolRegistry = { get: () => undefined, list: () => [] };
    const map = discoverTools(registry, ['cap.missing', 'cap.other']);
    expect(map.size).toBe(0);
  });
});
