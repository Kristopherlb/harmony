/**
 * packages/blueprints/src/workflows/incident/incident-close-out.workflow.test.ts
 */
import { describe, it, expect } from 'vitest';
import { IncidentCloseOutWorkflow } from './incident-close-out.workflow.js';

describe('IncidentCloseOutWorkflow', () => {
  const workflow = new IncidentCloseOutWorkflow();

  it('declares required WCS metadata fields', () => {
    expect(workflow.metadata.id).toBe('blueprints.incident.close-out');
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
        resolutionSummary: 'Resolved.',
        correlation: {},
      })
    ).not.toThrow();
  });
});

