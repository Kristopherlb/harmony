/**
 * packages/blueprints/src/workflows/incident/incident-remediate.workflow.test.ts
 */
import { describe, it, expect } from 'vitest';
import { IncidentRemediateWorkflow } from './incident-remediate.workflow.js';

describe('IncidentRemediateWorkflow', () => {
  const workflow = new IncidentRemediateWorkflow();

  it('declares required WCS metadata fields', () => {
    expect(workflow.metadata.id).toBe('blueprints.incident.remediate');
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
        remediation: { kind: 'runbook', path: 'runbooks/rollback-deployment.md' },
      })
    ).not.toThrow();
  });
});

