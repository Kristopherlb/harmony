/**
 * packages/capabilities/src/reasoners/strategic-planner/nodes/define-metrics.ts
 *
 * Purpose: produce deterministic success metrics for each persona.
 */

export type SuccessMetric = {
  persona: string;
  metric: string;
  target: string;
  measurementMethod: string;
  measurementPhase: string;
};

export type DefineMetricsInput = {
  personas: string[];
};

export async function defineMetrics(input: DefineMetricsInput): Promise<SuccessMetric[]> {
  const metrics: SuccessMetric[] = [];

  for (const persona of input.personas) {
    metrics.push(...defaultsForPersona(persona));
  }

  // Stable ordering.
  return metrics.sort((a, b) => {
    if (a.persona !== b.persona) return a.persona.localeCompare(b.persona);
    return a.metric.localeCompare(b.metric);
  });
}

function defaultsForPersona(persona: string): SuccessMetric[] {
  if (persona.startsWith('Agent')) {
    return [
      {
        persona,
        metric: 'MCP discoverability',
        target: '100%',
        measurementMethod: 'Tool catalog manifest audit (generated vs committed)',
        measurementPhase: 'Phase 4.2',
      },
    ];
  }

  if (persona.startsWith('Developer')) {
    return [
      {
        persona,
        metric: 'Test coverage',
        target: '>80%',
        measurementMethod: 'Vitest coverage report in CI',
        measurementPhase: 'Phase 4.1',
      },
    ];
  }

  if (persona.startsWith('End User')) {
    return [
      {
        persona,
        metric: 'Output completeness',
        target: 'All required sections present',
        measurementMethod: 'Schema validation + fixture-based integration test',
        measurementPhase: 'Phase 4.1',
      },
    ];
  }

  if (persona.startsWith('Platform Engineering Leadership')) {
    return [
      {
        persona,
        metric: 'OCS compliance',
        target: '100%',
        measurementMethod: 'TCS-001 contract test suite',
        measurementPhase: 'Phase 4.1',
      },
    ];
  }

  // Domain expert (or default)
  return [
    {
      persona,
      metric: 'Domain acceptance',
      target: 'Meets domain success criteria',
      measurementMethod: 'Dogfood run + domain review checklist',
      measurementPhase: 'Phase 4.3',
    },
  ];
}

