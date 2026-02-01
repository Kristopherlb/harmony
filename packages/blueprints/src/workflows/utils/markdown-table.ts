/**
 * packages/blueprints/src/workflows/utils/markdown-table.ts
 * Workflow-safe markdown table formatting for blueprint outputs.
 *
 * Note: This must remain deterministic (no Date/Math.random).
 */
function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, '\\n');
}

function toCell(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return escapeCell(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  return escapeCell(JSON.stringify(value));
}

export function formatAsMarkdownTable(input: Record<string, unknown>): string {
  const keys = Object.keys(input).sort((a, b) => a.localeCompare(b));
  const lines: string[] = [];
  lines.push('| key | value |');
  lines.push('| --- | ----- |');
  for (const k of keys) {
    lines.push(`| ${escapeCell(k)} | ${toCell(input[k])} |`);
  }
  return lines.join('\n');
}

