/**
 * packages/blueprints/src/workflows/incident/incident-close-out.logic.test.ts
 */
import { describe, it, expect } from 'vitest';
import { runIncidentCloseOut } from './incident-close-out.logic.js';

describe('runIncidentCloseOut', () => {
  it('requests approval before resolving incidents', async () => {
    const calls: Array<{ capId: string; input: any }> = [];
    const executeById = async (capId: string, input: any) => {
      calls.push({ capId, input });
      return { success: true };
    };
    const approvals: string[] = [];
    const requestApproval = async (reason: string) => {
      approvals.push(reason);
      return { approved: true as const };
    };

    const result = await runIncidentCloseOut(
      { executeById, requestApproval },
      {
        incidentId: 'INC-2024-001',
        severity: 'P2',
        slackChannel: '#inc-api',
        resolutionSummary: 'Rolled back deploy.',
        correlation: {
          pagerdutyIncidentId: 'PD1',
          statuspageIncidentId: 'SP1',
          statuspagePageId: 'PAGE1',
        },
      }
    );

    expect(approvals[0]).toContain('close-out');
    expect(calls.map((c) => c.capId)).toEqual([
      'golden.connectors.slack',
      'golden.connectors.statuspage',
      'golden.connectors.pagerduty',
    ]);
    expect(result.status).toBe('COMPLETED');
    expect(result.approval.wasApproved).toBe(true);
  });

  it('returns REJECTED and does not resolve incidents when approval rejected', async () => {
    const calls: Array<{ capId: string; input: any }> = [];
    const executeById = async (capId: string, input: any) => {
      calls.push({ capId, input });
      return { ok: true };
    };
    const requestApproval = async (_reason: string) => ({ approved: false as const, reason: 'No' });

    const result = await runIncidentCloseOut(
      { executeById, requestApproval },
      {
        incidentId: 'INC-2024-001',
        severity: 'P2',
        slackChannel: '#inc-api',
        resolutionSummary: 'Done.',
        correlation: { pagerdutyIncidentId: 'PD1', statuspageIncidentId: 'SP1' },
      }
    );

    expect(calls.map((c) => c.capId)).toEqual(['golden.connectors.slack']);
    expect(result.status).toBe('REJECTED');
  });
});

