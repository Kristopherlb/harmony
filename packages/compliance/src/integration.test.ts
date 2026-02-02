import { describe, it, expect } from 'vitest';
import { ComplianceAdvisor, InvolvedCapability } from './advisor.js';
import { TenantComplianceConfig, CapabilityCompliance } from '@golden/schema-registry';

describe('ComplianceAdvisor Integration Flow', () => {
    const config: TenantComplianceConfig = {
        enabled: true,
        profileId: 'integration-test',
        defaultEnforcement: 'ADVISORY',
        familyOverrides: [],
        controlOverrides: [],
        ssp: {
            autoGenerate: false,
            approvalRequiredFamilies: [],
            stalenessCheckIntervalMinutes: 60
        }
    };

    const capA: InvolvedCapability = {
        id: 'cap-auth',
        compliance: {
            satisfiesControls: ['IA-2'],
            mappingVersion: 1
        } as CapabilityCompliance
    };

    const capB: InvolvedCapability = {
        id: 'cap-database',
        compliance: {
            satisfiesControls: ['SC-1'],
            requiresControls: ['IA-2'], // Depends on Auth
            mappingVersion: 1
        } as CapabilityCompliance
    };

    const capC: InvolvedCapability = {
        id: 'cap-rogue',
        compliance: {
            satisfiesControls: [],
            requiresControls: ['AC-2'], // Missing control
            mappingVersion: 1
        } as CapabilityCompliance
    };

    it('should pass when all requirements are satisfied', () => {
        const result = ComplianceAdvisor.check([capA, capB], config);

        expect(result.canProceed).toBe(true);
        expect(result.unsatisfiedControls).toHaveLength(0);
        expect(result.satisfiedControls).toContainEqual({
            controlId: 'IA-2',
            satisfiedBy: ['cap-auth']
        });
    });

    it('should detect gap when requirement is missing', () => {
        const result = ComplianceAdvisor.check([capB], config); // Missing capA which provides IA-2

        expect(result.unsatisfiedControls).toHaveLength(1);
        expect(result.unsatisfiedControls[0]).toMatchObject({
            controlId: 'IA-2',
            requiredBy: 'cap-database',
            enforcementLevel: 'ADVISORY'
        });
        // Should still proceed because default enforcement is ADVISORY
        expect(result.canProceed).toBe(true);
    });

    it('should block execution when enforcement is BLOCKING', () => {
        const blockingConfig: TenantComplianceConfig = {
            ...config,
            controlOverrides: [{ controlId: 'AC-2', enforcement: 'BLOCKING' }]
        };

        const result = ComplianceAdvisor.check([capC], blockingConfig); // Requires AC-2, which is missing and BLOCKING

        expect(result.canProceed).toBe(false);
        expect(result.enforcementLevel).toBe('BLOCKING');
        expect(result.unsatisfiedControls[0].controlId).toBe('AC-2');
        expect(result.blockReason).toBeDefined();
    });
});
