import { describe, it, expect } from 'vitest';
import { generateBlueprintSource, blueprintGeneratorSchema } from './blueprint-generator.js';

describe('Blueprint Generator', () => {
    it('generates valid blueprint source with constants', () => {
        const input = {
            name: 'test-workflow',
            description: 'A test workflow',
            domain: 'test',
            inputs: {
                user: { type: 'string', description: 'User name' },
                env: { type: 'string', constant: 'production' } // IMP-017 Constant
            }
        };

        const validated = blueprintGeneratorSchema.parse(input as any);
        const source = generateBlueprintSource(validated);

        expect(source).toContain("user: z.string().describe('User name'),");
        expect(source).not.toContain("env: z.string()"); // Constant input should NOT be in schema
        expect(source).toContain("env: \"production\""); // Constant value should be in logic
        expect(source).toContain("test-workflow");
        expect(source).toContain("testWorkflowBlueprint");
    });
});
