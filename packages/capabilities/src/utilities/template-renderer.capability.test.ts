
/**
 * packages/capabilities/src/utilities/template-renderer.capability.test.ts
 * Tests for Template Renderer Capability.
 */
import { describe, it, expect } from 'vitest';
import { templateRendererCapability } from './template-renderer.capability.js';

describe('Template Renderer Capability', () => {
    it('has correct metadata', () => {
        expect(templateRendererCapability.metadata.id).toBe('golden.utilities.template-renderer');
        expect(templateRendererCapability.metadata.name).toBe('templateRenderer');
    });

    it('validates render input', () => {
        const validInput = {
            operation: 'render',
            template: 'Hello {{name}}',
            data: { name: 'World' },
            engine: 'handlebars'
        };
        expect(templateRendererCapability.schemas.input.safeParse(validInput).success).toBe(true);
    });

    it('validates validate input', () => {
        const validInput = {
            operation: 'validate',
            template: '{{#if condition}}yes{{/if}}',
            engine: 'handlebars'
        };
        expect(templateRendererCapability.schemas.input.safeParse(validInput).success).toBe(true);
    });

    it('rejects invalid operation', () => {
        const invalidInput = {
            operation: 'invalid-op',
        };
        expect(templateRendererCapability.schemas.input.safeParse(invalidInput).success).toBe(false);
    });
});
