export type ComputeUsage = {
  capabilityId?: string;
  computeSeconds: number;
  ratePerSecond: number;
};

export type IntelligenceUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  ratePerToken: number;
};

export type RunCostInput = {
  temporalActions: number;
  compute: ComputeUsage[];
  intelligence: IntelligenceUsage[];
  apiFees?: number;
  temporalRatePerAction?: number;
};

export type RunCostBreakdown = {
  temporal: number;
  compute: number;
  intelligence: number;
  apiFees: number;
};

export type RunCostResult = {
  total: number;
  breakdown: RunCostBreakdown;
};

const DEFAULT_TEMPORAL_RATE = 0.00001;

const ensureNonNegative = (label: string, value: number) => {
  if (value < 0) {
    throw new Error(`${label} must be non-negative`);
  }
};

export const calculateRunCost = (input: RunCostInput): RunCostResult => {
  ensureNonNegative('temporalActions', input.temporalActions);
  input.compute.forEach((entry, index) => {
    ensureNonNegative(`compute[${index}].computeSeconds`, entry.computeSeconds);
    ensureNonNegative(`compute[${index}].ratePerSecond`, entry.ratePerSecond);
  });
  input.intelligence.forEach((entry, index) => {
    ensureNonNegative(`intelligence[${index}].inputTokens`, entry.inputTokens);
    ensureNonNegative(`intelligence[${index}].outputTokens`, entry.outputTokens);
    ensureNonNegative(`intelligence[${index}].ratePerToken`, entry.ratePerToken);
  });
  if (typeof input.apiFees === 'number') {
    ensureNonNegative('apiFees', input.apiFees);
  }

  const temporalRate = input.temporalRatePerAction ?? DEFAULT_TEMPORAL_RATE;
  ensureNonNegative('temporalRatePerAction', temporalRate);

  const temporal = input.temporalActions * temporalRate;
  const compute = input.compute.reduce(
    (sum, entry) => sum + entry.computeSeconds * entry.ratePerSecond,
    0,
  );
  const intelligence = input.intelligence.reduce(
    (sum, entry) =>
      sum + (entry.inputTokens + entry.outputTokens) * entry.ratePerToken,
    0,
  );
  const apiFees = input.apiFees ?? 0;

  return {
    total: temporal + compute + intelligence + apiFees,
    breakdown: {
      temporal,
      compute,
      intelligence,
      apiFees,
    },
  };
};
