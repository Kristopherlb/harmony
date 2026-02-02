/**
 * packages/capabilities/src/reasoners/strategic-planner/schemas.ts
 * Strategic Planner Reasoner schemas (input/output).
 *
 * Purpose: provide deterministic, well-described contracts for the Strategic Planner capability.
 */
import { z } from '@golden/schema-registry';

const planSchema = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('file'),
      path: z.string().describe('Path to a plan file (e.g., ./plans/my.plan.md)'),
    }),
    z.object({
      type: z.literal('content'),
      content: z.string().describe('Raw plan content (markdown or JSON)'),
    }),
    z.object({
      type: z.literal('intent'),
      description: z.string().describe('Natural language description of the desired plan'),
      goals: z.array(z.string()).describe('Explicit goals for the initiative'),
      constraints: z.array(z.string()).optional().describe('Optional constraints to respect'),
    }),
  ])
  .describe('Plan source');

const projectDomainSchema = z
  .enum([
    'incident-management',
    'ci-cd',
    'security',
    'observability',
    'data-platform',
    'developer-experience',
    'compliance',
    'other',
  ])
  .describe('Primary project domain');

const projectContextSchema = z
  .object({
    name: z.string().describe('Project name'),
    domain: projectDomainSchema,
    domainExpert: z
      .object({
        role: z.string().describe('Primary domain expert role'),
        concerns: z.array(z.string()).describe('Key concerns from the domain expert perspective'),
        successCriteria: z.array(z.string()).optional().describe('Optional domain success criteria'),
      })
      .optional()
      .describe('Optional domain expert persona context'),
  })
  .describe('Project context');

const depthSchema = z.enum(['quick', 'standard', 'thorough']).default('standard').describe('Evaluation depth');

const evaluationsSchema = z
  .object({
    personas: z.boolean().default(true).describe('Run multi-persona evaluation'),
    gapAnalysis: z.boolean().default(true).describe('Run gap analysis'),
    preWorkIdentification: z.boolean().default(true).describe('Identify pre-work items'),
    metricsDefinition: z.boolean().default(true).describe('Define success metrics'),
  })
  .default({})
  .describe('Optional evaluation toggles');

const optionsSchema = z
  .object({
    depth: depthSchema,
    evaluations: evaluationsSchema,
    skillsPath: z.string().optional().describe('Optional override path for skills scanning'),
    outputFormat: z.enum(['markdown', 'json', 'both']).default('both').describe('Requested output format'),
    createCheckpoint: z.boolean().default(true).describe('Whether to create a retrospective checkpoint'),
  })
  .default({})
  .describe('Planner options');

export const strategicPlannerInputSchema = z
  .object({
    plan: planSchema,
    projectContext: projectContextSchema,
    options: optionsSchema,
  })
  .describe('Strategic Planner input');

const gapPrioritySchema = z.enum(['P0', 'P1', 'P2', 'P3']).describe('Gap priority');

export const strategicPlannerOutputSchema = z
  .object({
    summary: z.object({
      projectName: z.string(),
      overallReadiness: z.enum(['ready', 'needs-prework', 'needs-rethink']),
      averageAlignmentScore: z.number(),
      totalGaps: z.number(),
      criticalGaps: z.number(),
      preWorkItems: z.number(),
    }),

    personaEvaluations: z.array(
      z.object({
        persona: z.string(),
        alignmentScore: z.number().min(1).max(10),
        gaps: z.array(
          z.object({
            aspect: z.string(),
            currentState: z.string(),
            gap: z.string(),
            mitigation: z.string(),
            priority: gapPrioritySchema,
          })
        ),
        missingSkills: z.array(
          z.object({
            skillName: z.string(),
            reason: z.string(),
          })
        ),
      })
    ),

    gaps: z.array(
      z.object({
        category: z.enum([
          'standards',
          'skills',
          'generators',
          'adrs',
          'documentation',
          'mcp-tools',
          'testing',
          'configuration',
        ]),
        item: z.string(),
        description: z.string(),
        priority: gapPrioritySchema,
        blocksPhases: z.array(z.string()).optional(),
        effort: z.enum(['low', 'medium', 'high']),
      })
    ),

    skillsMatrix: z.object({
      prioritySkills: z.array(
        z.object({
          skill: z.string(),
          reason: z.string(),
          readBefore: z.string(),
        })
      ),
      referenceSkills: z.array(
        z.object({
          skill: z.string(),
          phases: z.array(z.string()),
        })
      ),
      missingSkills: z.array(
        z.object({
          proposedName: z.string(),
          purpose: z.string(),
          createIn: z.string(),
        })
      ),
    }),

    preWork: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        category: z.enum([
          'foundation-document',
          'reference-artifact',
          'enabling-skill',
          'architecture-record',
          'sample-implementation',
        ]),
        priority: gapPrioritySchema,
        description: z.string(),
        deliverable: z.object({
          path: z.string(),
          format: z.string(),
          sections: z.array(z.string()).optional(),
        }),
        blocksPhases: z.array(z.string()),
        effort: z.enum(['low', 'medium', 'high']),
      })
    ),

    successMetrics: z.array(
      z.object({
        persona: z.string(),
        metric: z.string(),
        target: z.string(),
        measurementMethod: z.string(),
        measurementPhase: z.string(),
      })
    ),

    updatedTodos: z
      .array(
        z.object({
          id: z.string(),
          content: z.string(),
          status: z.enum(['pending', 'in_progress', 'completed']),
          isNew: z.boolean(),
        })
      )
      .optional(),

    checkpoint: z
      .object({
        path: z.string(),
        created: z.boolean(),
      })
      .optional(),
  })
  .describe('Strategic Planner output');

export type StrategicPlannerInput = z.infer<typeof strategicPlannerInputSchema>;
export type StrategicPlannerOutput = z.infer<typeof strategicPlannerOutputSchema>;

