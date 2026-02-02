/**
 * packages/blueprints/src/workflows/incident/incident-post-mortem.logic.test.ts
 */
import { describe, it, expect } from 'vitest';
import { runIncidentPostMortem } from './incident-post-mortem.logic.js';

describe('runIncidentPostMortem', () => {
  it('requests approval before creating Confluence page', async () => {
    const calls: Array<{ capId: string; input: any }> = [];
    const executeById = async (capId: string, input: any) => {
      calls.push({ capId, input });
      if (capId === 'golden.connectors.confluence') {
        return { success: true, page: { id: '1', webUrl: 'https://example/wiki/1' }, message: 'ok' };
      }
      if (capId === 'golden.connectors.slack') return { ok: true };
      return { success: true };
    };
    const approvals: string[] = [];
    const requestApproval = async (reason: string) => {
      approvals.push(reason);
      return { approved: true as const };
    };

    const result = await runIncidentPostMortem(
      { executeById, requestApproval },
      {
        incidentId: 'INC-2024-001',
        severity: 'P2',
        slackChannel: '#inc-api',
        title: 'Post-Mortem: API Outage',
        confluence: { spaceKey: 'OPS', parentId: '123', labels: ['incident', 'post-mortem'] },
      }
    );

    expect(approvals[0]).toContain('post-mortem');
    expect(calls.map((c) => c.capId)).toEqual(['golden.connectors.confluence', 'golden.connectors.slack']);
    expect(result.status).toBe('COMPLETED');
    expect(result.postmortem.confluencePageCreated).toBe(true);
    expect(result.postmortem.pageUrl).toBe('https://example/wiki/1');
  });

  it('does not create Confluence page when approval rejected', async () => {
    const calls: Array<{ capId: string; input: any }> = [];
    const executeById = async (capId: string, input: any) => {
      calls.push({ capId, input });
      return { ok: true };
    };
    const requestApproval = async (_reason: string) => ({ approved: false as const, reason: 'No' });

    const result = await runIncidentPostMortem(
      { executeById, requestApproval },
      {
        incidentId: 'INC-2024-001',
        severity: 'P2',
        slackChannel: '#inc-api',
        title: 'Post-Mortem: API Outage',
        confluence: { spaceKey: 'OPS' },
      }
    );

    expect(calls).toEqual([]);
    expect(result.status).toBe('REJECTED');
  });
});

