import { describe, it, expect } from 'vitest';
import { generateTimeline, incidentTimelineInputSchema } from './incident-timeline.capability.js';

describe('Incident Timeline Capability', () => {
    const mockEvents = [
        { timestamp: '2023-10-27T10:05:00Z', source: 'Slack', message: 'Acked', severity: 'INFO' as const },
        { timestamp: '2023-10-27T10:00:00Z', source: 'PagerDuty', message: 'Triggered', severity: 'CRITICAL' as const },
        { timestamp: '2023-10-27T10:10:00Z', source: 'Jira', message: 'Ticket Created', severity: 'WARN' as const },
    ];

    it('sorts events chronologically', () => {
        const output = generateTimeline({
            events: mockEvents,
            format: 'json',
            title: 'Test',
        });
        const json = JSON.parse(output);
        expect(json.events[0].source).toBe('PagerDuty');
        expect(json.events[1].source).toBe('Slack');
        expect(json.events[2].source).toBe('Jira');
    });

    it('formats as markdown', () => {
        const output = generateTimeline({
            events: mockEvents,
            format: 'markdown',
            title: 'Incident Report',
        });

        expect(output).toContain('# Incident Report');
        expect(output).toContain('| Timestamp | Source | Severity | Message |');
        // PagerDuty should be first
        const lines = output.split('\n');
        const pdLine = lines.find(l => l.includes('PagerDuty'));
        const slLine = lines.find(l => l.includes('Slack'));
        expect(output.indexOf(pdLine!)).toBeLessThan(output.indexOf(slLine!));
    });

    it('validates schema', () => {
        const input = {
            events: [{ timestamp: 'invalid', source: 'S', message: 'M' }]
        };
        // Should parse but Zod string format might not catch invalid date strings by default unless refined
        // schema uses vanilla string() so it passes structure, logic handles date parsing
        const parsed = incidentTimelineInputSchema.safeParse(input);
        expect(parsed.success).toBe(true);
    });
});
