import { describe, it, expect } from 'vitest';
import { generateCapabilitySource, domainGeneratorSchema } from './domain-generator.js';

describe('Domain Generator', () => {
    it('generates valid capability source', () => {
        const input = {
            name: 'testCap',
            description: 'A test capability',
            domain: 'test',
            operations: ['op1', 'op2'],
            inputs: {
                field1: { type: 'string', description: 'Field 1', optional: true },
                field2: { type: 'number' }
            },
            outputs: {
                result: { type: 'record' }
            }
        };

        // Validate input against schema
        const validated = domainGeneratorSchema.parse(input as any);

        const source = generateCapabilitySource(validated);

        expect(source).toContain("field1: z.string().describe('Field 1').optional(),");
        expect(source).toContain("field2: z.number(),");
        expect(source).toContain("result: z.record(z.unknown()),");
        expect(source).toContain("op1', 'op2");
        expect(source).toContain("backoffCoefficient: 2"); // Check retry policy
    });
});
