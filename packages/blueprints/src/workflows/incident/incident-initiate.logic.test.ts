/**
 * packages/blueprints/src/workflows/incident/incident-initiate.logic.test.ts
 */
import { describe, it, expect } from 'vitest';
import { runIncidentInitiate } from './incident-initiate.logic.js';

describe('runIncidentInitiate', () => {
  it('executes Slack announcement and returns incident identifiers', async () => {
    const calls: Array<{ capId: string; input: unknown }> = [];
    const executeById = async (capId: string, input: unknown) => {
      calls.push({ capId, input });
      if (capId === 'golden.connectors.slack') return { ok: true, channel: 'C1', ts: '1.23' };
      return { success: true };
    };

    const result = await runIncidentInitiate(
      {
        executeById,
        nowMs: 1_706_982_400_000, // 2024-02-01T00:00:00Z
        uuid: () => 'uuid-1',
      },
      {
        title: 'API Outage',
        severity: 'P1',
        slackChannel: '#inc-api',
        notifyPagerDuty: false,
        createStatuspageIncident: false,
      }
    );

    expect(calls.map((c) => c.capId)).toEqual(['golden.connectors.slack']);
    expect(result.incidentId).toMatch(/^INC-2024-/);
    expect(result.notifications.slackAnnouncementPosted).toBe(true);
  });

  it('conditionally creates PagerDuty and Statuspage incidents when enabled', async () => {
    const calls: Array<{ capId: string; input: any }> = [];
    const executeById = async (capId: string, input: any) => {
      calls.push({ capId, input });
      if (capId === 'golden.connectors.slack') return { ok: true, channel: 'C1', ts: '1.23' };
      if (capId === 'golden.connectors.pagerduty') return { success: true, incident: { id: 'PD1' } };
      if (capId === 'golden.connectors.statuspage') return { success: true, incident: { id: 'SP1' } };
      return { success: true };
    };

    const result = await runIncidentInitiate(
      {
        executeById,
        nowMs: 1_706_982_400_000,
        uuid: () => 'uuid-2',
      },
      {
        title: 'API Outage',
        severity: 'P2',
        slackChannel: '#inc-api',
        summary: 'HTTP 500 spike',
        notifyPagerDuty: true,
        createStatuspageIncident: true,
        pagerduty: { serviceId: 'SVC1' },
        statuspage: { pageId: 'PAGE1' },
      }
    );

    expect(calls.map((c) => c.capId)).toEqual([
      'golden.connectors.slack',
      'golden.connectors.pagerduty',
      'golden.connectors.statuspage',
    ]);
    expect(calls.find((c) => c.capId === 'golden.connectors.pagerduty')?.input.operation).toBe('create-incident');
    expect(calls.find((c) => c.capId === 'golden.connectors.statuspage')?.input.operation).toBe('create-incident');
    expect(result.correlation.pagerdutyIncidentId).toBe('PD1');
    expect(result.correlation.statuspageIncidentId).toBe('SP1');
  });
});

