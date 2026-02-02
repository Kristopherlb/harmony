/**
 * packages/capabilities/src/reasoners/strategic-planner.capability.ts
 *
 * Purpose: OCS capability wrapper for Strategic Planner (Reasoner pattern) that evaluates a plan and
 * emits a strictly-typed, deterministic output for downstream workflows and MCP exposure.
 */
import { z } from '@golden/schema-registry';
import type { Capability, CapabilityContext } from '@golden/core';

import type { StrategicPlannerInput, StrategicPlannerOutput } from './strategic-planner/schemas.js';
import { strategicPlannerInputSchema, strategicPlannerOutputSchema } from './strategic-planner/schemas.js';

const configSchema = z.object({}).describe('Strategic Planner configuration (none for MVP)');
const secretsSchema = z.object({}).describe('Strategic Planner secrets (none for MVP)');

export type StrategicPlannerConfig = z.infer<typeof configSchema>;
export type StrategicPlannerSecrets = z.infer<typeof secretsSchema>;

const exampleInput: StrategicPlannerInput = {
  plan: {
    type: 'intent',
    description: 'Evaluate a multi-phase implementation plan for readiness and gaps.',
    goals: ['Deterministic execution', 'OCS compliance', 'Fast feedback via tests'],
    constraints: ['No secrets in plans', 'Prefer generators over custom scripts'],
  },
  projectContext: {
    name: 'harmony',
    domain: 'other',
    domainExpert: {
      role: 'Platform Engineer',
      concerns: ['Compliance', 'Security', 'Maintainability'],
      successCriteria: ['All schemas validated', 'Tests pass in CI'],
    },
  },
  options: {
    depth: 'standard',
    outputFormat: 'both',
    createCheckpoint: false,
    evaluations: {
      personas: true,
      gapAnalysis: true,
      preWorkIdentification: true,
      metricsDefinition: true,
    },
  },
};

const exampleOutput: StrategicPlannerOutput = {
  summary: {
    projectName: 'harmony',
    overallReadiness: 'needs-prework',
    averageAlignmentScore: 7,
    totalGaps: 2,
    criticalGaps: 1,
    preWorkItems: 2,
  },
  personaEvaluations: [
    {
      persona: 'Agent (AI Assistant)',
      alignmentScore: 7,
      gaps: [
        {
          aspect: 'Tool Discovery',
          currentState: 'MCP integration not referenced',
          gap: 'Agents need deterministic tool naming/discoverability via MCP catalogs',
          mitigation: 'Register the capability and ensure tool catalog generation includes it',
          priority: 'P2',
        },
      ],
      missingSkills: [],
    },
    {
      persona: 'Developer (Platform Contributor)',
      alignmentScore: 7,
      gaps: [
        {
          aspect: 'Fast Feedback',
          currentState: 'Contract tests not specified',
          gap: 'Without TCS-001 tests, schemas and examples can drift',
          mitigation: 'Add contract tests validating schemas and aiHints examples',
          priority: 'P1',
        },
      ],
      missingSkills: [],
    },
    {
      persona: 'End User (Platform Operator)',
      alignmentScore: 6,
      gaps: [
        {
          aspect: 'Usability',
          currentState: 'Operator runbooks not referenced',
          gap: 'Operators need a clear workflow and troubleshooting guidance',
          mitigation: 'Add minimal runbooks and link them from UI/capability outputs',
          priority: 'P2',
        },
      ],
      missingSkills: [],
    },
    {
      persona: 'Platform Engineering Leadership',
      alignmentScore: 6,
      gaps: [
        {
          aspect: 'ROI',
          currentState: 'Success metrics not referenced',
          gap: 'Leadership needs measurable targets to justify adoption',
          mitigation: 'Define success metrics per persona and how they will be measured',
          priority: 'P2',
        },
      ],
      missingSkills: [],
    },
    {
      persona: 'Domain Expert (Platform Engineer)',
      alignmentScore: 8,
      gaps: [],
      missingSkills: [],
    },
  ],
  gaps: [
    {
      category: 'testing',
      item: 'Contract tests for aiHints examples',
      description: 'Add TCS-001 contract tests validating exampleInput/exampleOutput against schemas.',
      priority: 'P1',
      blocksPhases: ['Phase 4.1'],
      effort: 'low',
    },
    {
      category: 'documentation',
      item: 'Operator-facing docs/runbooks missing',
      description: 'No runbooks/docs referenced; add minimal runbooks to reduce operator friction.',
      priority: 'P2',
      blocksPhases: ['Phase 4'],
      effort: 'low',
    },
  ],
  skillsMatrix: {
    prioritySkills: [
      { skill: 'test-driven-development', reason: 'Enforces red-green-refactor and prevents drift', readBefore: 'Phase 1' },
      { skill: 'open-capability-standard', reason: 'OCS compliance for schemas/security/aiHints', readBefore: 'Phase 1' },
      { skill: 'agent-specification-standard', reason: 'ASS-001 Reasoner patterns and safety guardrails', readBefore: 'Phase 1' },
      { skill: 'pattern-catalog-capabilities', reason: 'Reasoner baseline expectations (CPC-001)', readBefore: 'Phase 1' },
      { skill: 'testing-certification-standard', reason: 'TCS-001 contract verification requirements', readBefore: 'Phase 4.1' },
    ],
    referenceSkills: [
      { skill: 'strategic-planning-protocol', phases: ['Phase 2', 'Phase 3'] },
      { skill: 'langgraph-reasoner-patterns', phases: ['Phase 2', 'Phase 3'] },
      { skill: 'prompt-engineering', phases: ['Phase 3.1'] },
      { skill: 'golden-observability', phases: ['Backlog'] },
    ],
    missingSkills: [],
  },
  preWork: [
    {
      id: 'pw-testing-aihints-contract-tests',
      title: 'Pre-work: Contract tests for aiHints examples',
      category: 'sample-implementation',
      priority: 'P1',
      description: 'Add contract tests validating aiHints examples against input/output schemas.',
      deliverable: { path: 'packages/capabilities/src/reasoners/strategic-planner.capability.test.ts', format: 'typescript' },
      blocksPhases: ['Phase 4.1'],
      effort: 'low',
    },
    {
      id: 'pw-documentation-runbooks',
      title: 'Pre-work: Operator runbooks',
      category: 'foundation-document',
      priority: 'P2',
      description: 'Create minimal runbooks covering usage, rollback, and verification.',
      deliverable: { path: 'runbooks/', format: 'markdown', sections: ['Summary', 'Steps', 'Rollback', 'Verification'] },
      blocksPhases: ['Phase 4'],
      effort: 'low',
    },
  ],
  successMetrics: [
    {
      persona: 'Agent (AI Assistant)',
      metric: 'MCP discoverability',
      target: '100%',
      measurementMethod: 'Tool catalog manifest audit (generated vs committed)',
      measurementPhase: 'Phase 4.2',
    },
    {
      persona: 'Developer (Platform Contributor)',
      metric: 'Test coverage',
      target: '>80%',
      measurementMethod: 'Vitest coverage report in CI',
      measurementPhase: 'Phase 4.1',
    },
    {
      persona: 'End User (Platform Operator)',
      metric: 'Output completeness',
      target: 'All required sections present',
      measurementMethod: 'Schema validation + fixture-based integration test',
      measurementPhase: 'Phase 4.1',
    },
    {
      persona: 'Platform Engineering Leadership',
      metric: 'OCS compliance',
      target: '100%',
      measurementMethod: 'TCS-001 contract test suite',
      measurementPhase: 'Phase 4.1',
    },
    {
      persona: 'Domain Expert (Platform Engineer)',
      metric: 'Domain acceptance',
      target: 'Meets domain success criteria',
      measurementMethod: 'Dogfood run + domain review checklist',
      measurementPhase: 'Phase 4.3',
    },
  ],
};

export const strategicPlannerCapability: Capability<
  StrategicPlannerInput,
  StrategicPlannerOutput,
  StrategicPlannerConfig,
  StrategicPlannerSecrets
> = {
  metadata: {
    id: 'golden.reasoners.strategic-planner',
    version: '1.0.0',
    name: 'strategicPlanner',
    description: 'Evaluates implementation plans with multi-persona scoring, gap analysis, and pre-work identification.',
    domain: 'reasoners',
    subdomain: 'strategic-planner',
    tags: ['reasoner', 'planning', 'strategic-planning-protocol', 'langgraph'],
    maintainer: 'platform',
  },
  schemas: {
    input: strategicPlannerInputSchema,
    output: strategicPlannerOutputSchema,
    config: configSchema,
    secrets: secretsSchema,
  },
  security: {
    requiredScopes: ['planning:evaluate'],
    dataClassification: 'INTERNAL',
    networkAccess: { allowOutbound: [] },
  },
  operations: {
    isIdempotent: true,
    retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 1, backoffCoefficient: 1 },
    errorMap: () => 'FATAL',
    costFactor: 'MEDIUM',
  },
  aiHints: {
    exampleInput,
    exampleOutput,
    usageNotes:
      'Provide plan as {type:"file",path:"./..."} for repo-local runs or {type:"content"} / {type:"intent"} for inline evaluation. Output is JSON and must validate against schemas. Recommended node timeout budget: quick<5s, standard<15s, thorough<30s (implementation-dependent).',
  },
  factory: (dag, context: CapabilityContext<StrategicPlannerConfig, StrategicPlannerSecrets>, input: StrategicPlannerInput) => {
    void context;
    type Directory = unknown;
    type Host = { directory(path: string): Directory };
    type ContainerBuilder = {
      from(image: string): ContainerBuilder;
      withEnvVariable(key: string, value: string): ContainerBuilder;
      withDirectory(path: string, dir: Directory): ContainerBuilder;
      withWorkdir(path: string): ContainerBuilder;
      withExec(args: string[]): unknown;
    };
    type DaggerClient = { container(): ContainerBuilder; host(): Host };
    const d = dag as unknown as DaggerClient;

    const payload = input;

    return d
      .container()
      .from('node:20-alpine')
      .withDirectory('/repo', d.host().directory('.'))
      .withWorkdir('/repo')
      .withEnvVariable('INPUT_JSON', JSON.stringify(payload))
      .withExec([
        'node',
        'packages/capabilities/src/reasoners/strategic-planner/runtime/strategic-planner.runtime.mjs',
      ]);
  },
};

