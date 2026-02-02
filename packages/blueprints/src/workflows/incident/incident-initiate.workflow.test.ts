/**
 * packages/blueprints/src/workflows/incident/incident-initiate.workflow.test.ts
 */
import { describe, it, expect } from 'vitest';
import { IncidentInitiateWorkflow } from './incident-initiate.workflow.js';

describe('IncidentInitiateWorkflow', () => {
  const workflow = new IncidentInitiateWorkflow();

  it('declares required WCS metadata fields', () => {
    expect(workflow.metadata.id).toBe('blueprints.incident.initiate');
    expect(workflow.metadata.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(workflow.metadata.owner).toBe('platform');
    expect(Array.isArray(workflow.metadata.tags)).toBe(true);
  });

  it('declares security requirements and classification', () => {
    expect(workflow.security.requiredRoles).toContain('incident-commander');
    expect(workflow.security.classification).toBe('CONFIDENTIAL');
  });

  it('validates minimal input', () => {
    expect(() =>
      workflow.inputSchema.parse({
        title: 'API Outage',
        severity: 'P1',
        slackChannel: '#inc-api',
      })
    ).not.toThrow();
  });

  it('defaults optional booleans to false', () => {
    const parsed = workflow.inputSchema.parse({
      title: 'API Outage',
      severity: 'P1',
      slackChannel: '#inc-api',
    }) as any;
    expect(parsed.notifyPagerDuty).toBe(false);
    expect(parsed.createStatuspageIncident).toBe(false);
  });
});

