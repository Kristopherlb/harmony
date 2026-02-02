/**
 * packages/core/src/context/incident-context.test.ts
 * Tests for incident context helpers
 */
import { describe, it, expect } from 'vitest';
import type { GoldenContext } from './golden-context';
import {
  generateIncidentId,
  createIncidentGoldenContext,
  extractIncidentContext,
  updateIncidentContext,
  generateIncidentChannelName,
  buildIncidentSummary,
  isHighPriority,
  getApprovalTimeoutForSeverity,
  type IncidentContext,
} from './incident-context';

describe('incident-context', () => {
  const baseGoldenContext: GoldenContext = {
    app_id: 'test-app',
    environment: 'production',
    initiator_id: 'user-123',
    trace_id: 'trace-abc',
  };

  const sampleIncident: IncidentContext = {
    incident_id: 'INC-2024-001',
    severity: 'P1',
    title: 'API Gateway Outage',
    channel: 'C12345678',
    pagerduty_id: 'PD123',
    statuspage_id: 'SP456',
    started_at: '2024-01-15T10:00:00Z',
    impacted_services: ['api-gateway', 'auth-service'],
  };

  describe('generateIncidentId', () => {
    it('generates ID with default prefix', () => {
      const id = generateIncidentId({ sequence: 42 });
      expect(id).toMatch(/^INC-\d{4}-042$/);
    });

    it('generates ID with custom prefix', () => {
      const id = generateIncidentId({ prefix: 'SEC', sequence: 1 });
      expect(id).toMatch(/^SEC-\d{4}-001$/);
    });

    it('generates ID with custom year', () => {
      const id = generateIncidentId({ year: 2025, sequence: 100 });
      expect(id).toBe('INC-2025-100');
    });

    it('pads sequence number to 3 digits', () => {
      expect(generateIncidentId({ year: 2024, sequence: 1 })).toBe('INC-2024-001');
      expect(generateIncidentId({ year: 2024, sequence: 10 })).toBe('INC-2024-010');
      expect(generateIncidentId({ year: 2024, sequence: 100 })).toBe('INC-2024-100');
    });
  });

  describe('createIncidentGoldenContext', () => {
    it('merges incident context into golden context', () => {
      const result = createIncidentGoldenContext(baseGoldenContext, sampleIncident);

      // Base fields preserved
      expect(result.app_id).toBe('test-app');
      expect(result.environment).toBe('production');
      expect(result.initiator_id).toBe('user-123');
      expect(result.trace_id).toBe('trace-abc');

      // Incident fields added
      expect(result.incident_id).toBe('INC-2024-001');
      expect(result.incident_severity).toBe('P1');
      expect(result.incident_title).toBe('API Gateway Outage');
      expect(result.incident_channel).toBe('C12345678');
      expect(result.pagerduty_incident_id).toBe('PD123');
      expect(result.statuspage_incident_id).toBe('SP456');
      expect(result.incident_started_at).toBe('2024-01-15T10:00:00Z');
      expect(result.impacted_services).toEqual(['api-gateway', 'auth-service']);
    });

    it('does not modify original context', () => {
      createIncidentGoldenContext(baseGoldenContext, sampleIncident);
      expect(baseGoldenContext.incident_id).toBeUndefined();
    });
  });

  describe('extractIncidentContext', () => {
    it('extracts incident context from enriched golden context', () => {
      const enriched = createIncidentGoldenContext(baseGoldenContext, sampleIncident);
      const extracted = extractIncidentContext(enriched);

      expect(extracted).toBeDefined();
      expect(extracted!.incident_id).toBe('INC-2024-001');
      expect(extracted!.severity).toBe('P1');
      expect(extracted!.title).toBe('API Gateway Outage');
      expect(extracted!.impacted_services).toEqual(['api-gateway', 'auth-service']);
    });

    it('returns undefined for context without incident', () => {
      const result = extractIncidentContext(baseGoldenContext);
      expect(result).toBeUndefined();
    });

    it('provides defaults for missing optional fields', () => {
      const minimalContext: GoldenContext = {
        ...baseGoldenContext,
        incident_id: 'INC-2024-002',
      };
      const extracted = extractIncidentContext(minimalContext);

      expect(extracted).toBeDefined();
      expect(extracted!.severity).toBe('P4');
      expect(extracted!.title).toBe('INC-2024-002');
      expect(extracted!.impacted_services).toEqual([]);
    });
  });

  describe('updateIncidentContext', () => {
    it('updates specific incident fields', () => {
      const enriched = createIncidentGoldenContext(baseGoldenContext, sampleIncident);
      const updated = updateIncidentContext(enriched, {
        channel: 'C99999999',
        statuspage_id: 'SP789',
      });

      expect(updated.incident_channel).toBe('C99999999');
      expect(updated.statuspage_incident_id).toBe('SP789');
      // Other fields unchanged
      expect(updated.incident_id).toBe('INC-2024-001');
      expect(updated.pagerduty_incident_id).toBe('PD123');
    });

    it('does not modify original context', () => {
      const enriched = createIncidentGoldenContext(baseGoldenContext, sampleIncident);
      updateIncidentContext(enriched, { channel: 'C99999999' });
      expect(enriched.incident_channel).toBe('C12345678');
    });
  });

  describe('generateIncidentChannelName', () => {
    it('generates channel name from incident ID', () => {
      expect(generateIncidentChannelName('INC-2024-001')).toBe('inc-2024-001');
    });

    it('includes service name when provided', () => {
      expect(generateIncidentChannelName('INC-2024-001', 'api-gateway')).toBe('inc-2024-001-api-gateway');
    });

    it('sanitizes service name', () => {
      expect(generateIncidentChannelName('INC-2024-001', 'API Gateway!')).toBe('inc-2024-001-api-gateway-');
      expect(generateIncidentChannelName('INC-2024-001', 'test_service')).toBe('inc-2024-001-test-service');
    });

    it('truncates long service names', () => {
      const longService = 'this-is-a-very-long-service-name-that-exceeds-limit';
      const result = generateIncidentChannelName('INC-2024-001', longService);
      expect(result.length).toBeLessThanOrEqual(33); // inc-2024-001- (13) + 20
    });
  });

  describe('buildIncidentSummary', () => {
    it('builds summary with all fields', () => {
      const summary = buildIncidentSummary(sampleIncident);
      expect(summary).toBe('[P1] INC-2024-001: API Gateway Outage (Services: api-gateway, auth-service)');
    });

    it('handles empty impacted services', () => {
      const incident: IncidentContext = {
        ...sampleIncident,
        impacted_services: [],
      };
      const summary = buildIncidentSummary(incident);
      expect(summary).toContain('Services: Unknown');
    });
  });

  describe('isHighPriority', () => {
    it('returns true for P1', () => {
      expect(isHighPriority({ ...sampleIncident, severity: 'P1' })).toBe(true);
    });

    it('returns true for P2', () => {
      expect(isHighPriority({ ...sampleIncident, severity: 'P2' })).toBe(true);
    });

    it('returns false for P3', () => {
      expect(isHighPriority({ ...sampleIncident, severity: 'P3' })).toBe(false);
    });

    it('returns false for P4', () => {
      expect(isHighPriority({ ...sampleIncident, severity: 'P4' })).toBe(false);
    });
  });

  describe('getApprovalTimeoutForSeverity', () => {
    it('returns 5m for P1', () => {
      expect(getApprovalTimeoutForSeverity('P1')).toBe('5m');
    });

    it('returns 15m for P2', () => {
      expect(getApprovalTimeoutForSeverity('P2')).toBe('15m');
    });

    it('returns 30m for P3', () => {
      expect(getApprovalTimeoutForSeverity('P3')).toBe('30m');
    });

    it('returns 1h for P4', () => {
      expect(getApprovalTimeoutForSeverity('P4')).toBe('1h');
    });
  });
});
