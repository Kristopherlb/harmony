/**
 * packages/tools/mcp-server/src/demo/format-as-table.test.ts
 * TDD: format a structuredContent object as a markdown table.
 */
import { describe, it, expect } from 'vitest';
import { formatAsMarkdownTable } from './format-as-table.js';

describe('formatAsMarkdownTable', () => {
  it('renders flat objects', () => {
    const out = formatAsMarkdownTable({ trace_id: 't-1', ok: true, n: 3 });
    expect(out).toContain('| key | value |');
    expect(out).toContain('| trace_id | t-1 |');
    expect(out).toContain('| ok | true |');
    expect(out).toContain('| n | 3 |');
  });

  it('stringifies nested objects', () => {
    const out = formatAsMarkdownTable({ meta: { workflowId: 'wf', runId: 'run' } });
    expect(out).toContain('| meta |');
    expect(out).toContain('{"workflowId":"wf","runId":"run"}');
  });
});

