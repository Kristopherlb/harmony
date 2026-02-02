/**
 * packages/blueprints/src/workflows/incident/incident-remediate.logic.test.ts
 */
import { describe, it, expect } from 'vitest';
import { runIncidentRemediate } from './incident-remediate.logic.js';

describe('runIncidentRemediate', () => {
  it('requests approval before executing remediation runbook', async () => {
    const calls: Array<{ capId: string; input: any }> = [];
    const executeById = async (capId: string, input: any) => {
      calls.push({ capId, input });
      if (capId === 'golden.connectors.slack') return { ok: true };
      if (capId === 'golden.operations.runme-runner') return { success: true, message: 'ok', cells: [], totalDurationMs: 1 };
      return { success: true };
    };
    const approvals: string[] = [];
    const requestApproval = async (reason: string) => {
      approvals.push(reason);
      return { approved: true as const };
    };

    const result = await runIncidentRemediate(
      { executeById, requestApproval, nowMs: 1_706_982_400_000 },
      {
        incidentId: 'INC-2024-001',
        severity: 'P2',
        slackChannel: '#inc-api',
        remediation: {
          kind: 'runbook',
          path: 'runbooks/rollback-deployment.md',
          cells: ['verify-context', 'rollback-deployment', 'verify-health'],
        },
      }
    );

    expect(approvals[0]).toContain('INC-2024-001');
    const capIds = calls.map((c) => c.capId);
    expect(capIds).toEqual(['golden.connectors.slack', 'golden.operations.runme-runner', 'golden.connectors.slack']);
    expect(result.status).toBe('COMPLETED');
    expect(result.approval.wasRequired).toBe(true);
    expect(result.approval.wasApproved).toBe(true);
  });

  it('does not execute remediation when approval is rejected', async () => {
    const calls: Array<{ capId: string; input: any }> = [];
    const executeById = async (capId: string, input: any) => {
      calls.push({ capId, input });
      return { ok: true };
    };
    const requestApproval = async (_reason: string) => ({ approved: false as const, reason: 'No' });

    const result = await runIncidentRemediate(
      { executeById, requestApproval, nowMs: 1_706_982_400_000 },
      {
        incidentId: 'INC-2024-001',
        severity: 'P2',
        slackChannel: '#inc-api',
        remediation: { kind: 'runbook', path: 'runbooks/rollback-deployment.md' },
      }
    );

    expect(calls.map((c) => c.capId)).toEqual(['golden.connectors.slack']);
    expect(result.status).toBe('REJECTED');
    expect(result.approval.wasApproved).toBe(false);
    expect(result.remediation.executed).toBe(false);
  });
});

