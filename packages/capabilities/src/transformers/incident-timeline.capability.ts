/**
 * packages/capabilities/src/transformers/incident-timeline.capability.ts
 * IMP-018: Aggregates and formats incident events into a timeline.
 */
import { z } from '@golden/schema-registry';
import type { Capability } from '@golden/core';

// --- Types ---
const timelineEventSchema = z.object({
    timestamp: z.string().describe('ISO 8601 timestamp'),
    source: z.string().describe('Source system (e.g., PagerDuty, Slack, Jira)'),
    message: z.string().describe('Event description'),
    severity: z.enum(['INFO', 'WARN', 'ERROR', 'CRITICAL']).default('INFO'),
    metadata: z.record(z.unknown()).optional(),
});

export const incidentTimelineInputSchema = z.object({
    events: z.array(timelineEventSchema).describe('List of raw events'),
    format: z.enum(['markdown', 'json', 'csv']).default('markdown'),
    title: z.string().default('Incident Timeline'),
});

export const incidentTimelineOutputSchema = z.object({
    timeline: z.string().describe('Formatted timeline output'),
});

export type IncidentTimelineInput = z.infer<typeof incidentTimelineInputSchema>;
export type IncidentTimelineOutput = z.infer<typeof incidentTimelineOutputSchema>;

// --- Logic (Pure Function) ---
export function generateTimeline(input: IncidentTimelineInput): string {
    // Sort by timestamp
    const sorted = [...input.events].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    if (input.format === 'json') {
        return JSON.stringify({ title: input.title, events: sorted }, null, 2);
    }

    if (input.format === 'csv') {
        const header = 'Timestamp,Source,Severity,Message';
        const rows = sorted.map(
            (e) => `"${e.timestamp}","${e.source}","${e.severity}","${e.message.replace(/"/g, '""')}"`
        );
        return [header, ...rows].join('\n');
    }

    // Markdown (Default)
    let md = `# ${input.title}\n\n`;
    md += '| Timestamp | Source | Severity | Message |\n';
    md += '|---|---|---|---|\n';

    for (const e of sorted) {
        // Format timestamp nicely if possible, else keep raw
        let ts = e.timestamp;
        try {
            ts = new Date(e.timestamp).toISOString().replace('T', ' ').slice(0, 19);
        } catch { }

        md += `| ${ts} | **${e.source}** | ${e.severity} | ${e.message} |\n`;
    }

    return md;
}

// --- Capability Definition ---
export const incidentTimelineCapability: Capability<
    IncidentTimelineInput,
    IncidentTimelineOutput,
    void,
    void
> = {
    metadata: {
        id: 'golden.transformers.incident-timeline',
        version: '1.0.0',
        name: 'Incident Timeline',
        description: 'Aggregates and formats incident events into a chronological timeline.',
        domain: 'transformers',
        subdomain: 'incident-timeline',
        tags: ['transformers', 'incident', 'post-mortem', 'timeline'],
        maintainer: 'platform',
    },
    schemas: {
        input: incidentTimelineInputSchema,
        output: incidentTimelineOutputSchema,
        config: z.void(),
        secrets: z.void(),
    },
    security: {
        requiredScopes: [], // Pure computation
        dataClassification: 'INTERNAL',
        networkAccess: { allowOutbound: [] },
    },
    operations: {
        isIdempotent: true,
        retryPolicy: { maxAttempts: 1, initialIntervalSeconds: 0, backoffCoefficient: 1 },
        errorMap: () => 'FATAL',
        costFactor: 'LOW',
    },
    aiHints: {
        exampleInput: {
            title: 'Incident Timeline',
            events: [
                { timestamp: '2023-10-27T10:00:00Z', source: 'PagerDuty', message: 'Alert triggered', severity: 'CRITICAL' },
                { timestamp: '2023-10-27T10:05:00Z', source: 'Slack', message: 'Acked by on-call', severity: 'INFO' },
            ],
            format: 'markdown',
        },
        exampleOutput: { timeline: '# Incident Timeline...' },
    },
    factory: (dag, context, input) => {
        // Runs in a lightweight Node container to execute the logic
        // Using simple "node -e" to run the logic without extra dependencies
        // In a real optimized setup, this logic could run in the agent process, but we stick to the Dagger pattern.
        const d = dag as any;

        // We can't ship this source code easily into the container without a build step,
        // so for this MVP we will embed the logic as a script. 
        // Wait/Refactor: To avoid duplicating logic, we will output the result directly via stdout 
        // using a simple node script that implements the same logic.

        const logicScript = `
      const input = ${JSON.stringify(input)};
      
      const sorted = input.events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      let output = '';
      if (input.format === 'json') {
        output = JSON.stringify({ title: input.title, events: sorted }, null, 2);
      } else if (input.format === 'csv') {
        const header = 'Timestamp,Source,Severity,Message';
        const rows = sorted.map(e => \`"\${e.timestamp}","\${e.source}","\${e.severity}","\${e.message.replace(/"/g, '""')}"\`);
        output = [header, ...rows].join('\\n');
      } else {
        output = \`# \${input.title}\\n\\n| Timestamp | Source | Severity | Message |\\n|---|---|---|---|\\n\`;
        for (const e of sorted) {
          let ts = e.timestamp;
          try { ts = new Date(e.timestamp).toISOString().replace('T', ' ').slice(0, 19); } catch {}
          output += \`| \${ts} | **\${e.source}** | \${e.severity} | \${e.message} |\\n\`;
        }
      }
      
      console.log(JSON.stringify({ timeline: output }));
    `;

        return d.container()
            .from('node:20-alpine')
            .withExec(['node', '-e', logicScript]);
    },
};
