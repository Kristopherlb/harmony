/**
 * packages/capabilities/src/security/security-insights.capability.test.ts
 * Tests for Security Insights Capability.
 */
import { describe, it, expect } from 'vitest';
import { securityInsightsCapability } from './security-insights.capability.js';

describe('Security Insights Capability', () => {
    it('has correct metadata', () => {
        expect(securityInsightsCapability.metadata.id).toBe('golden.security.security-insights');
        expect(securityInsightsCapability.metadata.name).toBe('securityInsights');
    });

    it('validates generate input', () => {
        const validInput = {
            operation: 'generate',
            projectName: 'Test Project',
            securityContacts: [{ type: 'email', value: 'security@example.com' }]
        };
        expect(securityInsightsCapability.schemas.input.safeParse(validInput).success).toBe(true);
    });

    it('validates parse input', () => {
        const validInput = {
            operation: 'parse',
            fileContent: 'schema-version: 1.0.0'
        };
        expect(securityInsightsCapability.schemas.input.safeParse(validInput).success).toBe(true);
    });

    it('validates validate input', () => {
        const validInput = {
            operation: 'validate',
            filePath: '/path/to/SECURITY-INSIGHTS.yml'
        };
        expect(securityInsightsCapability.schemas.input.safeParse(validInput).success).toBe(true);
    });

    it('rejects invalid operation', () => {
        const invalidInput = {
            operation: 'invalid-op',
        };
        expect(securityInsightsCapability.schemas.input.safeParse(invalidInput).success).toBe(false);
    });
});
