/**
 * packages/core/src/wcs/approval-signal.test.ts
 * Tests for approval signal infrastructure
 */
import { describe, it, expect } from 'vitest';
import {
  createApprovalBlocks,
  createApprovalResultBlocks,
  ApprovalTimeoutError,
  ApprovalRejectedError,
  APPROVAL_ACTION_IDS,
  type ApprovalSignalPayload,
} from './approval-signal';

describe('approval-signal', () => {
  describe('APPROVAL_ACTION_IDS', () => {
    it('has approve action ID', () => {
      expect(APPROVAL_ACTION_IDS.APPROVE).toBe('approval_approve');
    });

    it('has reject action ID', () => {
      expect(APPROVAL_ACTION_IDS.REJECT).toBe('approval_reject');
    });
  });

  describe('ApprovalTimeoutError', () => {
    it('creates error with correct message', () => {
      const error = new ApprovalTimeoutError(
        'workflow-123',
        '30m',
        'Deploy to production'
      );

      expect(error.name).toBe('ApprovalTimeoutError');
      expect(error.message).toContain('30m');
      expect(error.message).toContain('Deploy to production');
      expect(error.workflowId).toBe('workflow-123');
      expect(error.timeout).toBe('30m');
      expect(error.requestReason).toBe('Deploy to production');
    });

    it('is instanceof Error', () => {
      const error = new ApprovalTimeoutError('wf', '1h', 'test');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('ApprovalRejectedError', () => {
    it('creates error with reason', () => {
      const decision: ApprovalSignalPayload = {
        decision: 'rejected',
        approverId: 'user-456',
        approverRoles: ['ops'],
        reason: 'Not ready for production',
        timestamp: '2024-01-15T10:00:00Z',
        source: 'console',
      };

      const error = new ApprovalRejectedError(decision);

      expect(error.name).toBe('ApprovalRejectedError');
      expect(error.message).toContain('user-456');
      expect(error.message).toContain('Not ready for production');
      expect(error.decision).toBe(decision);
    });

    it('handles missing reason', () => {
      const decision: ApprovalSignalPayload = {
        decision: 'rejected',
        approverId: 'user-789',
        approverRoles: [],
        timestamp: '2024-01-15T10:00:00Z',
        source: 'slack',
      };

      const error = new ApprovalRejectedError(decision);
      expect(error.message).toContain('No reason provided');
    });
  });

  describe('createApprovalBlocks', () => {
    it('creates Block Kit blocks with required fields', () => {
      const blocks = createApprovalBlocks({
        workflowId: 'wf-123',
        reason: 'Deploy v2.0.0 to production',
        requiredRoles: ['sre', 'ops-lead'],
        timeout: '30m',
        requestedBy: 'alice@example.com',
      });

      expect(Array.isArray(blocks)).toBe(true);
      expect(blocks.length).toBeGreaterThan(0);

      // Check for header
      const header = blocks.find((b: any) => b.type === 'header');
      expect(header).toBeDefined();

      // Check for actions with buttons
      const actions = blocks.find((b: any) => b.type === 'actions');
      expect(actions).toBeDefined();
      expect(actions.elements).toHaveLength(2);

      // Check approve button
      const approveBtn = actions.elements.find(
        (e: any) => e.action_id === APPROVAL_ACTION_IDS.APPROVE
      );
      expect(approveBtn).toBeDefined();
      expect(approveBtn.style).toBe('primary');
      expect(approveBtn.value).toBe('wf-123');

      // Check reject button
      const rejectBtn = actions.elements.find(
        (e: any) => e.action_id === APPROVAL_ACTION_IDS.REJECT
      );
      expect(rejectBtn).toBeDefined();
      expect(rejectBtn.style).toBe('danger');
    });

    it('includes incident context when provided', () => {
      const blocks = createApprovalBlocks({
        workflowId: 'wf-456',
        reason: 'Execute remediation',
        requiredRoles: [],
        timeout: '15m',
        requestedBy: 'bob@example.com',
        incidentId: 'INC-2024-001',
        incidentSeverity: 'P1',
      });

      // Check for incident section
      const incidentSection = blocks.find((b: any) => {
        if (b.type !== 'section' || !b.fields) return false;
        return b.fields.some((f: any) => f.text.includes('INC-2024-001'));
      });
      expect(incidentSection).toBeDefined();
    });

    it('includes required roles when specified', () => {
      const blocks = createApprovalBlocks({
        workflowId: 'wf-789',
        reason: 'Test approval',
        requiredRoles: ['admin', 'super-admin'],
        timeout: '1h',
        requestedBy: 'charlie@example.com',
      });

      // Check for context with roles
      const context = blocks.find((b: any) => b.type === 'context');
      expect(context).toBeDefined();
      expect(context.elements[0].text).toContain('admin');
      expect(context.elements[0].text).toContain('super-admin');
    });
  });

  describe('createApprovalResultBlocks', () => {
    it('creates approved result blocks', () => {
      const decision: ApprovalSignalPayload = {
        decision: 'approved',
        approverId: 'user-123',
        approverName: 'Alice Smith',
        approverRoles: ['ops'],
        timestamp: '2024-01-15T10:05:00Z',
        source: 'console',
      };

      const blocks = createApprovalResultBlocks({
        originalReason: 'Deploy to production',
        decision,
        durationMs: 300000, // 5 minutes
      });

      expect(Array.isArray(blocks)).toBe(true);

      // Check header shows approved
      const header = blocks.find((b: any) => b.type === 'header');
      expect(header).toBeDefined();
      expect(header.text.text).toContain('Approved');
    });

    it('creates rejected result blocks', () => {
      const decision: ApprovalSignalPayload = {
        decision: 'rejected',
        approverId: 'user-456',
        approverName: 'Bob Jones',
        approverRoles: ['sre'],
        reason: 'Incomplete testing',
        timestamp: '2024-01-15T10:10:00Z',
        source: 'slack',
      };

      const blocks = createApprovalResultBlocks({
        originalReason: 'Deploy to production',
        decision,
        durationMs: 60000, // 1 minute
      });

      // Check header shows rejected
      const header = blocks.find((b: any) => b.type === 'header');
      expect(header).toBeDefined();
      expect(header.text.text).toContain('Rejected');

      // Check reason is included
      const reasonSection = blocks.find(
        (b: any) => b.type === 'section' && b.text?.text?.includes('Incomplete testing')
      );
      expect(reasonSection).toBeDefined();
    });

    it('formats duration correctly', () => {
      const decision: ApprovalSignalPayload = {
        decision: 'approved',
        approverId: 'user-789',
        approverRoles: [],
        timestamp: '2024-01-15T10:00:00Z',
        source: 'api',
      };

      // Test minutes formatting
      const blocksMinutes = createApprovalResultBlocks({
        originalReason: 'Test',
        decision,
        durationMs: 120000, // 2 minutes
      });
      const minutesSection = blocksMinutes.find(
        (b: any) => b.type === 'section' && b.fields?.some((f: any) => f.text.includes('2m'))
      );
      expect(minutesSection).toBeDefined();

      // Test seconds formatting
      const blocksSeconds = createApprovalResultBlocks({
        originalReason: 'Test',
        decision,
        durationMs: 30000, // 30 seconds
      });
      const secondsSection = blocksSeconds.find(
        (b: any) => b.type === 'section' && b.fields?.some((f: any) => f.text.includes('30s'))
      );
      expect(secondsSection).toBeDefined();
    });
  });
});
