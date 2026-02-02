/**
 * packages/capabilities/src/reasoners/strategic-planner/nodes/define-metrics.test.ts
 *
 * Purpose: TDD for per-persona success metrics generation.
 */
import { describe, expect, it } from 'vitest';

import { defineMetrics } from './define-metrics.js';

describe('defineMetrics', () => {
  it('returns at least one metric per persona', async () => {
    const metrics = await defineMetrics({
      personas: [
        'Agent (AI Assistant)',
        'Developer (Platform Contributor)',
        'End User (Platform Operator)',
        'Platform Engineering Leadership',
        'Domain Expert (Project-Specific)',
      ],
    });

    const byPersona = new Map<string, number>();
    for (const m of metrics) {
      byPersona.set(m.persona, (byPersona.get(m.persona) ?? 0) + 1);
      expect(typeof m.metric).toBe('string');
      expect(typeof m.target).toBe('string');
      expect(typeof m.measurementMethod).toBe('string');
      expect(typeof m.measurementPhase).toBe('string');
    }

    for (const p of [
      'Agent (AI Assistant)',
      'Developer (Platform Contributor)',
      'End User (Platform Operator)',
      'Platform Engineering Leadership',
      'Domain Expert (Project-Specific)',
    ]) {
      expect((byPersona.get(p) ?? 0) > 0).toBe(true);
    }
  });
});

