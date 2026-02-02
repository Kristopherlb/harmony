/**
 * packages/capabilities/src/reasoners/strategic-planner.capability.smoke.test.ts
 *
 * Purpose: TDD smoke test for Strategic Planner capability wrapper (OCS contract baseline).
 */
import { describe, expect, it } from 'vitest';

import { strategicPlannerCapability } from './strategic-planner.capability.js';

describe('strategicPlannerCapability (smoke)', () => {
  it('exposes OCS metadata and schemas', () => {
    expect(strategicPlannerCapability.metadata.id).toBe('golden.reasoners.strategic-planner');
    expect(strategicPlannerCapability.security.dataClassification).toBe('INTERNAL');
    expect(typeof strategicPlannerCapability.schemas.input.parse).toBe('function');
    expect(typeof strategicPlannerCapability.schemas.output.parse).toBe('function');
  });
});

