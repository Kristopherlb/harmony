/**
 * packages/tools/harmony-cli/src/strategic-plan.render.ts
 *
 * Purpose: render a Strategic Planner output object as human-friendly markdown.
 */
export type RenderStrategicPlannerMarkdownOptions = {
  title?: string;
};

type MinimalOutput = {
  summary: {
    projectName: string;
    overallReadiness: string;
    averageAlignmentScore: number;
    totalGaps: number;
    criticalGaps: number;
    preWorkItems: number;
  };
  personaEvaluations: Array<{
    persona: string;
    alignmentScore: number;
    gaps: Array<{ aspect: string; gap: string; mitigation: string; priority: string }>;
    missingSkills: Array<{ skillName: string; reason: string }>;
  }>;
  gaps: Array<{ category: string; item: string; description: string; priority: string; blocksPhases?: string[]; effort: string }>;
  preWork: Array<{
    id: string;
    title: string;
    category: string;
    priority: string;
    description: string;
    deliverable: { path: string; format: string; sections?: string[] };
    blocksPhases: string[];
    effort: string;
  }>;
  successMetrics: Array<{
    persona: string;
    metric: string;
    target: string;
    measurementMethod: string;
    measurementPhase: string;
  }>;
};

function code(value: string): string {
  return `\`${value}\``;
}

function safeNumber(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

export function renderStrategicPlannerMarkdown(output: MinimalOutput, options: RenderStrategicPlannerMarkdownOptions = {}): string {
  const title = options.title ?? 'Strategic Planner Evaluation';
  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Project:** ${output.summary.projectName}`);
  lines.push(`- **Overall readiness:** ${output.summary.overallReadiness}`);
  lines.push(`- **Average alignment score:** ${safeNumber(output.summary.averageAlignmentScore)}`);
  lines.push(`- **Total gaps:** ${safeNumber(output.summary.totalGaps)}`);
  lines.push(`- **Critical gaps (P0/P1):** ${safeNumber(output.summary.criticalGaps)}`);
  lines.push(`- **Pre-work items:** ${safeNumber(output.summary.preWorkItems)}`);

  lines.push('');
  lines.push('## Persona evaluations');
  lines.push('');
  if (!output.personaEvaluations || output.personaEvaluations.length === 0) {
    lines.push('_No persona evaluations produced._');
  } else {
    for (const p of output.personaEvaluations) {
      lines.push(`### ${p.persona}`);
      lines.push('');
      lines.push(`- **Alignment score:** ${p.alignmentScore}/10`);

      if (p.gaps.length > 0) {
        lines.push('- **Gaps:**');
        for (const g of p.gaps) {
          lines.push(`  - (${g.priority}) **${g.aspect}**: ${g.gap} — _${g.mitigation}_`);
        }
      } else {
        lines.push('- **Gaps:** _none_');
      }

      if (p.missingSkills.length > 0) {
        lines.push('- **Missing skills:**');
        for (const s of p.missingSkills) {
          lines.push(`  - ${code(s.skillName)}: ${s.reason}`);
        }
      } else {
        lines.push('- **Missing skills:** _none_');
      }
      lines.push('');
    }
  }

  lines.push('## Gaps');
  lines.push('');
  if (!output.gaps || output.gaps.length === 0) {
    lines.push('_No gaps produced._');
  } else {
    for (const g of output.gaps) {
      const phases = g.blocksPhases && g.blocksPhases.length > 0 ? `; blocks: ${g.blocksPhases.join(', ')}` : '';
      lines.push(`- (${g.priority}) **${g.category}**: ${g.item} (${g.effort}${phases})`);
      lines.push(`  - ${g.description}`);
    }
  }

  lines.push('');
  lines.push('## Pre-work');
  lines.push('');
  if (!output.preWork || output.preWork.length === 0) {
    lines.push('_No pre-work items produced._');
  } else {
    for (const p of output.preWork) {
      lines.push(`- (${p.priority}) **${p.title}**`);
      lines.push(`  - **Category:** ${p.category}`);
      lines.push(`  - **Blocks:** ${p.blocksPhases.join(', ')}`);
      lines.push(`  - **Effort:** ${p.effort}`);
      lines.push(`  - **Deliverable:** ${code(p.deliverable.path)} (${p.deliverable.format})`);
      if (p.deliverable.sections && p.deliverable.sections.length > 0) {
        lines.push(`  - **Sections:** ${p.deliverable.sections.join(', ')}`);
      }
      lines.push(`  - ${p.description}`);
    }
  }

  lines.push('');
  lines.push('## Success metrics');
  lines.push('');
  if (!output.successMetrics || output.successMetrics.length === 0) {
    lines.push('_No success metrics produced._');
  } else {
    for (const m of output.successMetrics) {
      lines.push(`- **${m.persona}**: ${m.metric}`);
      lines.push(`  - **Target:** ${m.target}`);
      lines.push(`  - **Measure:** ${m.measurementMethod}`);
      lines.push(`  - **Phase:** ${m.measurementPhase}`);
    }
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}

