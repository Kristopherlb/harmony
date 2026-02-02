import { describe, it, expect } from 'vitest';
import { resolveEnforcementLevel } from './enforcement.js';
import { TenantComplianceConfig, ComplianceEnforcementLevel } from '@golden/schema-registry';

describe('resolveEnforcementLevel', () => {
    const mockConfig: TenantComplianceConfig = {
        enabled: true,
        profileId: 'test-profile',
        defaultEnforcement: 'ADVISORY',
        familyOverrides: [
            { family: 'AC', enforcement: 'BLOCKING' },
            { family: 'SC', enforcement: 'WARNING' }
        ],
        controlOverrides: [
            { controlId: 'AC-2', enforcement: 'WARNING' }, // Specific override
            { controlId: 'SC-5', enforcement: 'BLOCKING' } // Specific override
        ],
        ssp: {
            autoGenerate: true,
            approvalRequiredFamilies: [],
            stalenessCheckIntervalMinutes: 60
        }
    };

    it('should use default enforcement when no overrides match', () => {
        expect(resolveEnforcementLevel('AU-1', mockConfig)).toBe('ADVISORY');
    });

    it('should use family override when matching', () => {
        // AC family -> BLOCKING
        expect(resolveEnforcementLevel('AC-1', mockConfig)).toBe('BLOCKING');
    });

    it('should use control override when matching (ignores family)', () => {
        // AC-2 -> WARNING (overrides AC family BLOCKING)
        expect(resolveEnforcementLevel('AC-2', mockConfig)).toBe('WARNING');
    });

    it('should use control override when matching (ignores default)', () => {
        // SC-5 -> BLOCKING (overrides SC family WARNING)
        expect(resolveEnforcementLevel('SC-5', mockConfig)).toBe('BLOCKING');
    });
});
