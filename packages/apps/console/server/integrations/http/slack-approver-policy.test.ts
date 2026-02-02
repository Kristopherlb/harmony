import { describe, it, expect } from 'vitest';
import { buildSlackApprovalSignalPayload, resolveApproverFromSlackUserId } from './slack-approver-policy';

describe('slack-approver-policy', () => {
  it('returns empty roles when user is not mapped', () => {
    const resolved = resolveApproverFromSlackUserId({
      slackUserId: 'U_NOT_MAPPED',
      policy: { version: '1.0.0', users: {} },
    });
    expect(resolved.approverRoles).toEqual([]);
  });

  it('returns roles when user is mapped', () => {
    const resolved = resolveApproverFromSlackUserId({
      slackUserId: 'U123',
      policy: {
        version: '1.0.0',
        users: {
          U123: { roles: ['incident-approver', 'incident-responder'] },
        },
      },
    });
    expect(resolved.approverRoles).toEqual(['incident-approver', 'incident-responder']);
  });

  it('builds ApprovalSignalPayload using mapped approverId/approverName when present', () => {
    const payload = buildSlackApprovalSignalPayload({
      decision: 'approved',
      slackUserId: 'U123',
      slackUserName: 'Slack Name',
      slackUserUsername: 'slackuser',
      policy: {
        version: '1.0.0',
        users: {
          U123: {
            roles: ['incident-approver'],
            approverId: 'user:alice',
            approverName: 'alice',
          },
        },
      },
      timestamp: '2026-02-02T00:00:00.000Z',
    });

    expect(payload.approverId).toBe('user:alice');
    expect(payload.approverName).toBe('alice');
    expect(payload.approverRoles).toEqual(['incident-approver']);
    expect(payload.source).toBe('slack');
  });

  it('falls back to slack user identity when no mapping is present', () => {
    const payload = buildSlackApprovalSignalPayload({
      decision: 'rejected',
      slackUserId: 'U999',
      slackUserName: 'Slack Name',
      slackUserUsername: 'slackuser',
      policy: { version: '1.0.0', users: {} },
      reason: 'Rejected via Slack',
      timestamp: '2026-02-02T00:00:00.000Z',
    });

    expect(payload.approverId).toBe('U999');
    expect(payload.approverName).toBe('Slack Name');
    expect(payload.approverRoles).toEqual([]);
    expect(payload.reason).toBe('Rejected via Slack');
  });
});

