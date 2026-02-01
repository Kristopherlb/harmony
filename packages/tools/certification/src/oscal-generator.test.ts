import { describe, it, expect } from 'vitest';
import { buildOscalComponentDefinition, type OscalComponentEntry } from './oscal-generator.js';

const ENTRIES: OscalComponentEntry[] = [
  {
    id: 'golden.capability.sample',
    title: 'sample',
    description: 'Sample capability',
    type: 'CAPABILITY',
    oscalControlIds: ['AC-4', 'AU-2'],
  },
];

describe('buildOscalComponentDefinition', () => {
  it('maps oscal control IDs into implemented requirements', () => {
    const definition = buildOscalComponentDefinition(ENTRIES, { version: '1.0.0' });
    const componentDefinition = definition['component-definition'];
    expect(componentDefinition.components).toHaveLength(1);
    const [component] = componentDefinition.components;
    expect(component.control_implementations[0].implemented_requirements).toHaveLength(2);
    expect(component.control_implementations[0].implemented_requirements.map((req) => req.control_id)).toEqual([
      'AC-4',
      'AU-2',
    ]);
  });

  it('omits components with no control IDs', () => {
    const definition = buildOscalComponentDefinition([
      { id: 'empty', title: 'empty', description: 'empty', type: 'CAPABILITY', oscalControlIds: [] },
    ]);
    expect(definition['component-definition'].components).toEqual([]);
  });
});
