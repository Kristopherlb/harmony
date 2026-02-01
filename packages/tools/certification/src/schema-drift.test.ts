import { describe, it, expect } from 'vitest';
import { detectSchemaDrift, generateSchemaSnapshot, type SchemaSnapshot } from './schema-drift.js';

const BASELINE: SchemaSnapshot = {
  version: '0.0.0',
  generatedAt: new Date(0).toISOString(),
  capabilities: [
    {
      id: 'golden.demo.echo',
      inputSchema: { type: 'object', properties: { x: { type: 'number' } }, required: ['x'] },
      outputSchema: { type: 'object', properties: { y: { type: 'number' } }, required: ['y'] },
    },
  ],
  blueprints: [
    {
      id: 'workflows.echo',
      inputSchema: { type: 'object', properties: { x: { type: 'number' } }, required: ['x'] },
    },
  ],
};

describe('detectSchemaDrift', () => {
  it('detects added and removed capabilities', () => {
    const snapshot: SchemaSnapshot = {
      ...BASELINE,
      capabilities: [
        {
          id: 'golden.demo.math-add',
          inputSchema: { type: 'object', properties: { a: { type: 'number' } } },
          outputSchema: { type: 'object', properties: { sum: { type: 'number' } } },
        },
      ],
    };

    const drift = detectSchemaDrift(snapshot, BASELINE);
    expect(drift).toEqual([
      { id: 'golden.demo.math-add', kind: 'CAPABILITY', change: 'added' },
      { id: 'golden.demo.echo', kind: 'CAPABILITY', change: 'removed' },
    ]);
  });

  it('detects removed blueprints', () => {
    const snapshot: SchemaSnapshot = {
      ...BASELINE,
      blueprints: [],
    };

    const drift = detectSchemaDrift(snapshot, BASELINE);
    expect(drift).toEqual([{ id: 'workflows.echo', kind: 'BLUEPRINT', change: 'removed' }]);
  });

  it('returns no drift when generated snapshot matches baseline ordering', () => {
    const snapshot = generateSchemaSnapshot({ version: '0.0.0', generatedAt: BASELINE.generatedAt });
    const drift = detectSchemaDrift(snapshot, snapshot);
    expect(drift).toEqual([]);
  });
});
