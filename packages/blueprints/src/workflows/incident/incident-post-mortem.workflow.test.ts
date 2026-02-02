/**
 * packages/blueprints/src/workflows/incident/incident-post-mortem.workflow.test.ts
 */
import { describe, it, expect } from 'vitest';
import { IncidentPostMortemWorkflow } from './incident-post-mortem.workflow.js';

describe('IncidentPostMortemWorkflow', () => {
  const workflow = new IncidentPostMortemWorkflow();

  it('declares required WCS metadata fields', () => {
    expect(workflow.metadata.id).toBe('blueprints.incident.post-mortem');
    expect(workflow.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(workflow.metadata.owner).toBe('platform');
  });

  it('declares security requirements and classification', () => {
    expect(workflow.security.requiredRoles).toContain('incident-commander');
    expect(workflow.security.classification).toBe('CONFIDENTIAL');
  });

  it('validates minimal input', () => {
    expect(() =>
      workflow.inputSchema.parse({
        incidentId: 'INC-2024-001',
        severity: 'P2',
        slackChannel: '#inc-api',
        title: 'Post-Mortem: API Outage',
        confluence: { spaceKey: 'OPS' },
      })
    ).not.toThrow();
  });
});

