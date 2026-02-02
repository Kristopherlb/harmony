/**
 * packages/schema-registry/src/registry.test.ts
 * Tests for the Schema Registry schemas.
 */
import { describe, it, expect } from 'vitest';
import { sbomSchema } from './sbom.js';
import { vexDocumentSchema } from './vex.js';
import { slsaProvenanceSchema } from './slsa.js';

describe('Schema Registry', () => {
    describe('SBOM Schema', () => {
        it('validates a minimal CycloneDX SBOM', () => {
            const validSbom = {
                bomFormat: 'CycloneDX',
                specVersion: '1.4',
                version: 1,
                components: [
                    {
                        type: 'library',
                        name: 'test-lib',
                        version: '1.0.0',
                        purl: 'pkg:npm/test-lib@1.0.0'
                    }
                ]
            };
            const result = sbomSchema.safeParse(validSbom);
            expect(result.success).toBe(true);
        });

        it('validates a valid SPDX SBOM structure', () => {
            const validSbom = {
                bomFormat: 'SPDX',
                specVersion: '2.3',
                components: []
            };
            const result = sbomSchema.safeParse(validSbom);
            expect(result.success).toBe(true);
        });
    });

    describe('VEX Schema', () => {
        it('validates a valid VEX document', () => {
            const validVex = {
                '@context': 'https://openvex.dev/ns/v0.2.0',
                '@id': 'vex-123',
                author: 'Unit Test',
                timestamp: new Date().toISOString(),
                statements: [
                    {
                        vulnerability: { name: 'CVE-2023-12345' },
                        products: [{ product_id: 'pkg:npm/vulnerable-lib@1.0.0' }],
                        status: 'not_affected',
                        justification: 'component_not_present'
                    }
                ]
            };
            const result = vexDocumentSchema.safeParse(validVex);
            if (!result.success) console.error(JSON.stringify(result.error, null, 2));
            expect(result.success).toBe(true);
        });
    });

    describe('SLSA Schema', () => {
        it('validates a valid SLSA provenance', () => {
            const validSlsa = {
                _type: 'https://in-toto.io/Statement/v1',
                subject: [{ name: 'artifact', digest: { sha256: 'abcdef' } }],
                predicateType: 'https://slsa.dev/provenance/v1',
                predicate: {
                    buildDefinition: {
                        buildType: 'https://github.com/slsa-framework/slsa-github-generator',
                        externalParameters: { repository: 'custom/repo' }
                    },
                    runDetails: {
                        builder: { id: 'https://github.com/slsa-framework/slsa-github-generator' }
                    }
                }
            };
            const result = slsaProvenanceSchema.safeParse(validSlsa);
            if (!result.success) console.error(JSON.stringify(result.error, null, 2));
            expect(result.success).toBe(true);
        });
    });
});
